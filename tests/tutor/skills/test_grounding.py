"""Content grounding + hallucination check (spec 043 T2.10 / T2.11).

- check_knode_grounding: flags knode-id citations absent from injected content.
- knowledge skills append GROUNDING_INSTRUCTION to their prompt; question-asking
  skills do NOT.
- the simple-subgraph fallback also grounds (append instruction + warn).
"""

from __future__ import annotations

import logging

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from systemedu.core.tutor.skills._common import (
    GROUNDING_INSTRUCTION,
    build_simple_skill_subgraph,
    check_knode_grounding,
    warn_if_ungrounded,
)


# ---------------------------------------------------------------------------
# check_knode_grounding
# ---------------------------------------------------------------------------
class TestCheckKnodeGrounding:
    def test_flags_fabricated_id(self):
        bad = check_knode_grounding(
            "你可以看 M07 那一节", {"l3_knode_content": "M04 讲了 PM2.5"}
        )
        assert bad == ["M07"]

    def test_grounded_id_not_flagged(self):
        assert check_knode_grounding(
            "回到 M04 我们说的", {"l3_knode_content": "M04 讲了 PM2.5"}
        ) == []

    def test_no_citation_empty(self):
        assert check_knode_grounding("你答得很好", {"l3_knode_content": "M04"}) == []

    def test_multiple_ids_partial(self):
        bad = check_knode_grounding(
            "见 M04 和 M09 和 S3",
            {"l3_knode_content": "M04 内容", "l2_project_ctx": "项目含 S3"},
        )
        # M04 (in l3) and S3 (in l2) grounded; M09 fabricated
        assert bad == ["M09"]

    def test_empty_reply(self):
        assert check_knode_grounding("", {"l3_knode_content": "M04"}) == []

    def test_citation_with_no_memory_is_flagged(self):
        # Nothing to ground against → any cite is suspicious.
        assert check_knode_grounding("参考 M07", None) == ["M07"]

    def test_ordinary_words_not_matched(self):
        # No bare-letter+digits tokens → nothing flagged.
        assert check_knode_grounding(
            "力等于质量乘加速度，很简单。", {"l3_knode_content": ""}
        ) == []


class TestWarnIfUngrounded:
    def test_logs_warning_on_fabricated(self, caplog):
        with caplog.at_level(logging.WARNING):
            warn_if_ungrounded(
                "看 M07", {"l3_knode_content": "M04"}, skill="direct-instruction"
            )
        assert any("M07" in r.message for r in caplog.records)

    def test_no_warning_when_grounded(self, caplog):
        with caplog.at_level(logging.WARNING):
            warn_if_ungrounded(
                "看 M04", {"l3_knode_content": "M04"}, skill="direct-instruction"
            )
        assert not caplog.records


# ---------------------------------------------------------------------------
# Prompt-append behaviour: knowledge skills ground, question skills don't
# ---------------------------------------------------------------------------
class _RecordingLLM:
    def __init__(self):
        self.calls: list[tuple[str, str]] = []

    async def ainvoke(self, messages):
        sys_text = next(
            (m.content for m in messages if isinstance(m, SystemMessage)), ""
        )
        usr_text = next(
            (m.content for m in messages if isinstance(m, HumanMessage)), ""
        )
        self.calls.append((sys_text, usr_text))
        return AIMessage(content="好的。")


class _Skill:
    def __init__(self, name: str):
        class _cfg:
            pass
        _cfg.name = name
        _cfg.body = "你是导师"
        _cfg.description = name
        self.config = _cfg


@pytest.mark.asyncio
async def test_simple_subgraph_grounded_appends_instruction():
    llm = _RecordingLLM()
    sub = build_simple_skill_subgraph(_Skill("direct-instruction"), llm, ground_knowledge=True)
    await sub.ainvoke({"messages": [HumanMessage(content="什么是 PM2.5?")], "memory": {}})
    system_prompt = llm.calls[0][0]
    assert "内容依据" in system_prompt
    assert GROUNDING_INSTRUCTION.strip()[:6] in system_prompt


@pytest.mark.asyncio
async def test_simple_subgraph_ungrounded_omits_instruction():
    llm = _RecordingLLM()
    sub = build_simple_skill_subgraph(_Skill("socratic-questioning"), llm, ground_knowledge=False)
    await sub.ainvoke({"messages": [HumanMessage(content="为什么?")], "memory": {}})
    system_prompt = llm.calls[0][0]
    assert "内容依据" not in system_prompt


@pytest.mark.asyncio
async def test_simple_subgraph_grounded_warns_on_fabricated(caplog):
    """A grounded skill whose reply cites a fabricated knode id logs a warning."""

    class _FabLLM(_RecordingLLM):
        async def ainvoke(self, messages):
            await super().ainvoke(messages)
            return AIMessage(content="这个在 M99 讲过。")

    llm = _FabLLM()
    sub = build_simple_skill_subgraph(_Skill("direct-instruction"), llm, ground_knowledge=True)
    with caplog.at_level(logging.WARNING):
        await sub.ainvoke({
            "messages": [HumanMessage(content="哪节讲的?")],
            "memory": {"l3_knode_content": "M04 讲了 PM2.5"},
        })
    assert any("M99" in r.message for r in caplog.records)
