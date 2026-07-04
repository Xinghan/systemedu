"""create_agent-based skill subgraph (spec 043 T1.8).

T1.8 收敛手写 tool loop 为 `langchain.agents.create_agent` 子图。这组测试锁定
迁移后的**对外契约必须与 `build_tool_loop_subgraph` 一致**：

- 输入 `{messages, memory}`，输出 messages 里含最终纯文本 AIMessage；
- tool_call → 执行(经注入的 provider)→ 结果回灌 → 再答；
- ToolMessage 被 spotlight(`<tool_output>` 定界）后才喂回模型；
- memory 经 dynamic system prompt 到达模型；
- provider 参数(parallel_tool_calls=False / DashScope enable_thinking）注入 bind_tools；
- 无 tools / 不可 bind 的 LLM → 退回 simple 单节点子图。

fake LLM 记录它每次实际收到的 messages，以便断言 spotlight + system prompt
真的发生在「模型看到的输入」上，而不只在输出 state 上。
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from systemedu.core.tutor.skills._common import build_agent_subgraph
from systemedu.core.tutor.tools import (
    ToolContext,
    build_default_registry,
    push_tool_context,
)


class _FakeSkill:
    class config:
        name = "scaffolding"
        body = "你是脚手架老师"
        description = "scaffolding"
        tools = ["get_knode_content"]


class _FakeProvider:
    """Minimal TutorDataProvider — records the call, returns fixed content."""

    def __init__(self):
        self.called_with = None

    async def get_knode_content(self, project, knode):
        self.called_with = (project, knode)
        return {"found": True, "knode": knode, "title": "光合作用", "content": "植物用光造糖"}


class _RecordingLLM:
    """Fake chat model that records every batch of messages the agent sends it.

    1st invoke → a tool_call; 2nd invoke → a plain-text answer. Also records
    the kwargs create_agent passed to `bind_tools` so we can assert provider
    params were injected via model_settings.
    """

    def __init__(self, *, base_url: str | None = None):
        self._calls = 0
        self.seen_batches: list[list] = []
        self.bind_kwargs: list[dict] = []
        # sniffed by is_dashscope_llm
        if base_url is not None:
            self.openai_api_base = base_url

    def bind_tools(self, tools, **kwargs):
        self.bind_kwargs.append(kwargs)
        return self

    # create_agent probes these; return self so the runnable stays this fake
    def bind(self, **kwargs):
        return self

    def with_config(self, *a, **k):
        return self

    async def ainvoke(self, messages, **kwargs):
        self._calls += 1
        self.seen_batches.append(list(messages))
        if self._calls == 1:
            return AIMessage(
                content="",
                tool_calls=[{
                    "name": "get_knode_content",
                    "args": {"project_name": "mars", "knode_id": "M01"},
                    "id": "call_1",
                }],
            )
        return AIMessage(content="根据课程内容, 光合作用是植物用光造糖。")


@pytest.mark.asyncio
async def test_agent_subgraph_executes_tool_and_returns_final_text():
    provider = _FakeProvider()
    tools = build_default_registry().filter_by_whitelist(["get_knode_content"])
    assert len(tools) == 1

    llm = _RecordingLLM()
    sub = build_agent_subgraph(_FakeSkill(), llm, tools)

    ctx = ToolContext(user_id="u1", data=provider)
    with push_tool_context(ctx):
        out = await sub.ainvoke({
            "messages": [HumanMessage(content="什么是光合作用?")],
            "memory": {"l3_knode_state": "卡在光反应"},
        })

    # tool actually invoked with LLM-supplied args (context-forced user_id wins,
    # but project/knode come from the model)
    assert provider.called_with == ("mars", "M01")

    # final assistant message is plain text (no tool_calls)
    ai = [m for m in out["messages"] if isinstance(m, AIMessage) and not m.tool_calls]
    assert ai and "光合作用" in ai[-1].content

    # a ToolMessage exists and is spotlighted in the returned state
    tool_msgs = [m for m in out["messages"] if isinstance(m, ToolMessage)]
    assert tool_msgs and tool_msgs[0].content.startswith("<tool_output")


@pytest.mark.asyncio
async def test_agent_subgraph_spotlights_before_model_and_injects_memory():
    """The model's 2nd-pass input must carry (a) a spotlighted ToolMessage and
    (b) a system prompt built from memory — proving both behaviors moved to the
    create_agent stack, not just the output state."""
    provider = _FakeProvider()
    tools = build_default_registry().filter_by_whitelist(["get_knode_content"])
    llm = _RecordingLLM()
    sub = build_agent_subgraph(_FakeSkill(), llm, tools)

    with push_tool_context(ToolContext(user_id="u1", data=provider)):
        await sub.ainvoke({
            "messages": [HumanMessage(content="什么是光合作用?")],
            "memory": {"l3_knode_state": "卡在光反应"},
        })

    assert len(llm.seen_batches) == 2, "expected one tool round then a final answer"
    second = llm.seen_batches[1]

    # (a) system prompt carries skill body + memory
    sys = [m for m in second if isinstance(m, SystemMessage)]
    assert sys, "model should receive a system prompt on the 2nd pass"
    assert "脚手架" in sys[0].content
    assert "卡在光反应" in sys[0].content

    # (b) the tool message the model re-reads is fenced
    tms = [m for m in second if isinstance(m, ToolMessage)]
    assert tms and tms[0].content.startswith("<tool_output")


def test_agent_subgraph_injects_dashscope_params():
    """DashScope LLM → bind_tools gets parallel_tool_calls=False + enable_thinking."""
    tools = build_default_registry().filter_by_whitelist(["get_knode_content"])
    llm = _RecordingLLM(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")
    # building the subgraph binds tools eagerly is NOT guaranteed; the bind
    # happens at model-call time. Drive one turn to trigger it.
    import asyncio

    provider = _FakeProvider()
    sub = build_agent_subgraph(_FakeSkill(), llm, tools)

    async def _run():
        with push_tool_context(ToolContext(user_id="u1", data=provider)):
            await sub.ainvoke({
                "messages": [HumanMessage(content="q")],
                "memory": {},
            })

    asyncio.run(_run())
    assert llm.bind_kwargs, "create_agent should have bound tools"
    kw = llm.bind_kwargs[0]
    assert kw.get("parallel_tool_calls") is False
    assert kw.get("extra_body") == {"enable_thinking": False}


def test_agent_subgraph_non_dashscope_omits_enable_thinking():
    """A non-DashScope OpenAI-compatible LLM must NOT get extra_body (would be
    rejected as an unknown field), but still gets parallel_tool_calls=False."""
    import asyncio

    tools = build_default_registry().filter_by_whitelist(["get_knode_content"])
    llm = _RecordingLLM(base_url="https://api.openai.com/v1")
    provider = _FakeProvider()
    sub = build_agent_subgraph(_FakeSkill(), llm, tools)

    async def _run():
        with push_tool_context(ToolContext(user_id="u1", data=provider)):
            await sub.ainvoke({"messages": [HumanMessage(content="q")], "memory": {}})

    asyncio.run(_run())
    kw = llm.bind_kwargs[0]
    assert kw.get("parallel_tool_calls") is False
    assert "extra_body" not in kw


@pytest.mark.asyncio
async def test_agent_subgraph_falls_back_without_bindable_llm():
    """No tools / a fake LLM lacking bind_tools → simple single-node subgraph."""

    class _PlainLLM:
        async def ainvoke(self, messages):
            return AIMessage(content="纯文本回答")

    sub = build_agent_subgraph(_FakeSkill(), _PlainLLM(), [])
    out = await sub.ainvoke({"messages": [HumanMessage(content="hi")], "memory": {}})
    ai = [m for m in out["messages"] if isinstance(m, AIMessage)]
    assert ai and ai[-1].content == "纯文本回答"


@pytest.mark.asyncio
async def test_agent_subgraph_run_limit_caps_runaway_loop():
    """A model that *always* tool-calls must be stopped by ToolCallLimitMiddleware
    instead of looping forever."""
    provider = _FakeProvider()
    tools = build_default_registry().filter_by_whitelist(["get_knode_content"])

    class _AlwaysToolLLM(_RecordingLLM):
        async def ainvoke(self, messages, **kwargs):
            self._calls += 1
            self.seen_batches.append(list(messages))
            return AIMessage(
                content="",
                tool_calls=[{
                    "name": "get_knode_content",
                    "args": {"project_name": "p", "knode_id": "k"},
                    "id": f"call_{self._calls}",
                }],
            )

    llm = _AlwaysToolLLM()
    sub = build_agent_subgraph(_FakeSkill(), llm, tools, run_limit=3)

    with push_tool_context(ToolContext(user_id="u1", data=provider)):
        out = await sub.ainvoke({"messages": [HumanMessage(content="q")], "memory": {}})

    # It must terminate (not hang / not recurse past the cap). The exact number
    # of model calls is bounded by the run_limit; assert it stopped well short of
    # a runaway and produced *some* terminal state.
    assert llm._calls <= 5, f"run_limit should cap the loop, saw {llm._calls} calls"
    assert out.get("messages"), "subgraph must return a state even when capped"


# ===========================================================================
# Main-graph integration — create_agent subgraph under `_wrap_subgraph`
# ===========================================================================
# The subgraph unit tests above drive `build_agent_subgraph` in isolation.
# This one runs the FULL tutor graph so we prove the create_agent subgraph
# honours the main graph's state contract: memory flows in, only the final
# plain-text AIMessage flows back out (no intermediate tool-calling
# AIMessage / ToolMessage leaks into the student conversation), and the
# middleware-owned state keys don't corrupt `skill_state`.

from pathlib import Path

_SKILLS_ROOT = (
    Path(__file__).resolve().parents[2]
    / "packages" / "core" / "src" / "systemedu" / "core" / "tutor" / "skills"
)


class _RouterAndToolLLM:
    """One fake serving both roles in the main graph.

    - Router turn (a lone HumanMessage containing 教学策略调度器) → route to
      scaffolding.
    - Scaffolding turn (create_agent stack: has a SystemMessage) → emit one
      tool_call, then a plain-text answer.
    Exposes `bind_tools` so the skill takes the create_agent path (not the
    simple-subgraph fallback).
    """

    def __init__(self):
        self._skill_calls = 0

    def bind_tools(self, tools, **kwargs):
        return self

    def bind(self, **kwargs):
        return self

    def with_config(self, *a, **k):
        return self

    async def ainvoke(self, messages, **kwargs):
        from langchain_core.messages import SystemMessage as _Sys

        has_system = any(isinstance(m, _Sys) for m in messages)
        joined = " ".join(
            (m.content if isinstance(m.content, str) else str(m.content)) for m in messages
        )
        if not has_system and "教学策略调度器" in joined:
            return AIMessage(
                content='{"action": "switch", "target_skill": "scaffolding", "reason": "t"}'
            )
        # scaffolding (create_agent) path
        self._skill_calls += 1
        if self._skill_calls == 1:
            return AIMessage(
                content="",
                tool_calls=[{
                    "name": "get_knode_content",
                    "args": {"project_name": "mars", "knode_id": "M01"},
                    "id": "call_1",
                }],
            )
        return AIMessage(content="先看懂光合作用, 我们一步步来。")


@pytest.mark.asyncio
async def test_full_graph_scaffolding_create_agent_path():
    from systemedu.core.tutor.graph import build_tutor_graph
    from systemedu.core.tutor.skills import SkillLoader

    loader = SkillLoader([_SKILLS_ROOT])
    loader.scan()

    provider = _FakeProvider()
    llm = _RouterAndToolLLM()
    graph = build_tutor_graph(loader=loader, llm=llm)

    with push_tool_context(ToolContext(user_id="u-alice", data=provider)):
        result = await graph.ainvoke({
            "user_id": "u-alice",
            "session_id": "s-1",
            "project_name": "mars",
            "knode_id": "M01",
            "messages": [HumanMessage(content="什么是光合作用?")],
        })

    # routed to scaffolding and it ran the tool
    assert result["active_skill"] == "scaffolding"
    assert provider.called_with == ("mars", "M01")

    # Exactly one student-facing AIMessage — the final plain text. No empty
    # tool-calling AIMessage, no ToolMessage leaked into the main conversation.
    from langchain_core.messages import ToolMessage as _TM

    ai_msgs = [m for m in result["messages"] if isinstance(m, AIMessage)]
    assert len(ai_msgs) == 1, f"expected 1 final AIMessage, got {len(ai_msgs)}"
    assert "光合作用" in ai_msgs[0].content
    assert not any(isinstance(m, _TM) for m in result["messages"]), "no ToolMessage in main convo"
    assert all(not getattr(m, "tool_calls", None) for m in ai_msgs), "no tool_calls leak"
