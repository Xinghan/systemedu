"""spec 020: planner 改 streaming 后单测.

mock 一个支持 astream 的 fake LLM, 断言:
1. planner.process 把 astream 收到的所有 chunk 拼起来后能解析 JSON
2. 最终 returns 的是合法的 milestones JSON
"""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import yaml

from systemedu.core import config as cfg_mod


@pytest.fixture
def isolated_config(tmp_path: Path, monkeypatch):
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({
        "llm": {
            "default": "creative",
            "providers": {
                "creative": {
                    "base_url": "https://x/v1",
                    "api_key": "sk-test",
                    "model": "test-model",
                    "temperature": 0.4,
                },
            },
        },
    }, default_flow_style=False), encoding="utf-8")
    monkeypatch.setattr(cfg_mod, "CONFIG_FILE", cfg_path)
    cfg_mod.reset_config()
    return cfg_path


class FakeLLM:
    """支持 astream + ainvoke 的 fake LLM, 用预设 chunk 序列回放."""

    def __init__(self, outline_chunks: list[str], expand_chunks: list[str]):
        self._calls = 0
        self._outline_chunks = outline_chunks
        self._expand_chunks = expand_chunks
        self.captured_messages: list = []

    def astream(self, messages):
        self.captured_messages.append(messages)
        chunks = self._outline_chunks if self._calls == 0 else self._expand_chunks
        self._calls += 1

        async def _gen():
            for c in chunks:
                yield SimpleNamespace(content=c)
        return _gen()


def test_astream_to_text_concatenates_chunks() -> None:
    """spec 020 helper: _astream_to_text 应把所有 chunk 拼起来."""
    import asyncio
    from systemedu.agents.builtin.planner import _astream_to_text

    class _LLM:
        def astream(self, _msgs):
            async def _gen():
                for s in ["hello ", "wor", "ld"]:
                    yield SimpleNamespace(content=s)
            return _gen()

    text = asyncio.run(_astream_to_text(_LLM(), []))
    assert text == "hello world"


def test_astream_to_text_skips_empty_content() -> None:
    """reasoning model 偶尔 yield 空 chunk (delta.role only), 应跳过."""
    import asyncio
    from systemedu.agents.builtin.planner import _astream_to_text

    class _LLM:
        def astream(self, _msgs):
            async def _gen():
                for s in ["", "a", None, "b"]:
                    yield SimpleNamespace(content=s)
            return _gen()

    text = asyncio.run(_astream_to_text(_LLM(), []))
    assert text == "ab"


def test_planner_process_uses_streaming(isolated_config) -> None:
    """planner.process 应通过 astream 收 chunk, 不是 ainvoke."""
    import asyncio
    from systemedu.agents.builtin.planner import PlannerAgent
    from systemedu.agents.base import AgentConfig

    # outline + expand 两步 mock 输出
    outline_full = '```json\n{"milestones":[{"title":"M1","description":"d","topic_groups":[{"group_name":"G","is_parallel":true,"topics":["t1"]}]}]}\n```'
    expand_full = '```json\n{"milestones":[{"title":"M1","description":"d","order":0,"knodes":[{"title":"t1","summary":"s","difficulty_level":3,"content_type":"text","acceptance_type":"quiz","estimated_minutes":15,"xp_reward":35,"order":0,"prerequisite_indices":[]}]}]}\n```'

    fake = FakeLLM(
        outline_chunks=[outline_full[:50], outline_full[50:]],
        expand_chunks=[expand_full[:80], expand_full[80:160], expand_full[160:]],
    )
    captured_kwargs: dict = {}

    def fake_get_llm(*, provider=None, streaming=None, max_retries=None, **kw):
        captured_kwargs["streaming"] = streaming
        captured_kwargs["max_retries"] = max_retries
        return fake

    with patch("systemedu.agents.builtin.planner.get_llm", side_effect=fake_get_llm):
        agent = PlannerAgent(AgentConfig(name="planner", type="builtin:planner"))
        result = asyncio.run(agent.process(
            "项目标题：测试\n项目描述：测试描述",
            context={"user_age": 9, "target_nodes": 5},
        ))

    # spec 020: planner 必须用 streaming=True + max_retries=0
    assert captured_kwargs["streaming"] is True
    assert captured_kwargs["max_retries"] == 0

    # astream 被调了 2 次 (outline + expand)
    assert fake._calls == 2

    # returns 是合法 JSON
    import json
    parsed = json.loads(result)
    assert "milestones" in parsed
    assert len(parsed["milestones"]) == 1
    assert parsed["milestones"][0]["knodes"][0]["title"] == "t1"


def test_planner_process_handles_chunked_json(isolated_config) -> None:
    """JSON 被切到多 chunk (包括 markdown ``` 标记被切断), 拼回后能解析."""
    import asyncio
    from systemedu.agents.builtin.planner import PlannerAgent
    from systemedu.agents.base import AgentConfig

    outline_full = '```json\n{"milestones":[{"title":"M1","description":"d","topic_groups":[{"group_name":"G","is_parallel":true,"topics":["t1"]}]}]}\n```'
    expand_full = '```json\n{"milestones":[{"title":"M1","description":"d","order":0,"knodes":[{"title":"t1","summary":"s","difficulty_level":3,"content_type":"text","acceptance_type":"quiz","estimated_minutes":15,"xp_reward":35,"order":0,"prerequisite_indices":[]}]}]}\n```'

    # 故意把 json 切到非常细的 chunk
    def chunk_by(s, n):
        return [s[i:i+n] for i in range(0, len(s), n)]

    fake = FakeLLM(
        outline_chunks=chunk_by(outline_full, 5),
        expand_chunks=chunk_by(expand_full, 7),
    )

    with patch("systemedu.agents.builtin.planner.get_llm", return_value=fake):
        agent = PlannerAgent(AgentConfig(name="planner", type="builtin:planner"))
        result = asyncio.run(agent.process(
            "项目标题：测试\n项目描述：测试描述",
            context={"user_age": 9, "target_nodes": 5},
        ))

    import json
    parsed = json.loads(result)
    assert parsed["milestones"][0]["knodes"][0]["title"] == "t1"
