"""Shared helpers for the six built-in skills (spec 014 T3.4-T3.9).

Each skill's subgraph is a single `generate_response` node by default:
renders memory + prompt body, calls the LLM, appends the AIMessage,
bumps `turn_count`, writes a `summary` line. Skills that need more
sophisticated state (like socratic's breakthrough tracking) override
`build_subgraph` directly.

We keep this intentionally small — Phase 3 ships text-only skills.
Tool integration lands in Phase 4 once `@tutor_tool` exists.
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from .base import SkillBase


class SimpleSkillState(TypedDict, total=False):
    """Minimal per-turn skill state shared by text-only skills."""

    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int
    summary: str
    last_step: str
    # Free-form slot for skill-specific data (e.g. questions_asked)
    extra: dict[str, Any]
    # Memory snapshot handed in by the main graph
    memory: dict[str, Any]


def render_memory_block(memory: dict[str, Any] | None) -> str:
    """Produce a short prose block the skill's LLM prompt can embed."""
    if not memory:
        return "(no memory available)"
    parts: list[str] = []
    for key, label in (
        ("l1_profile", "学生画像"),
        ("l2_project_ctx", "项目进度"),
        ("l3_knode_state", "当前卡点"),
        ("l3_knode_content", "当前课程内容"),
        ("l5_skill_ctx", "上一个策略"),
    ):
        val = memory.get(key)
        if val:
            parts.append(f"## {label}\n{val}")
    recall = memory.get("l4_semantic_recall") or []
    if recall:
        parts.append(
            "## 相关历史对话\n" + "\n".join(f"- {s}" for s in recall[:3])
        )
    return "\n\n".join(parts) if parts else "(memory empty)"


def _last_student_message(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
    return ""


async def call_llm(llm: Any, system: str, user: str) -> str:
    """Run the LLM with a (system, user) pair and return plain text.

    Accepts LangChain BaseChatModel and test fakes interchangeably.
    """
    resp = await llm.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=user),
    ])
    if hasattr(resp, "content"):
        c = resp.content
        return c if isinstance(c, str) else str(c)
    return str(resp)


def build_simple_skill_subgraph(
    skill: SkillBase,
    llm: Any,
    *,
    summary_prefix: str = "",
):
    """Generic single-node subgraph: LLM-in → AIMessage-out.

    The LLM receives the skill's SKILL.md body as system prompt, plus
    the rendered memory + last student message as the user block.
    """

    async def generate_response(state: SimpleSkillState) -> dict:
        messages = state.get("messages") or []
        memory_block = render_memory_block(state.get("memory"))
        user_block = (
            f"{memory_block}\n\n"
            f"## 当前学生消息\n{_last_student_message(messages)}"
        )
        reply = await call_llm(llm, skill.config.body or skill.config.description, user_block)
        turn = (state.get("turn_count") or 0) + 1
        summary = f"{summary_prefix}turn={turn}" if summary_prefix else f"turn={turn}"
        return {
            "messages": [AIMessage(content=reply)],
            "turn_count": turn,
            "summary": summary,
            "last_step": f"reply_{turn}",
        }

    g = StateGraph(SimpleSkillState)
    g.add_node("generate_response", generate_response)
    g.add_edge(START, "generate_response")
    g.add_edge("generate_response", END)
    return g.compile()


# ---------------------------------------------------------------------------
# Tool-calling loop (spec 043 P1)
# ---------------------------------------------------------------------------
_FENCE_OPEN = "<tool_output"
_FENCE_CLOSE = "</tool_output>"


def _neutralize_fence_markers(content: str) -> str:
    """Defang any `<tool_output …>` / `</tool_output>` literals in a payload.

    Red-team finding (spec 043 T1.4): a malicious tool payload can embed a
    fake `</tool_output>` to *close the fence early*, so everything after
    it reads as a top-level instruction ("fence escape"). Verified against
    a real Qwen model — the `fake_tool_result` attack leaked the canary
    with naive fencing. We break the tag by inserting a zero-width space
    after the angle bracket, so the model sees inert text, not a delimiter,
    while a human reading the log still recognises it.
    """
    zwsp = "​"
    return (
        content
        .replace(_FENCE_CLOSE, f"<{zwsp}/tool_output>")
        .replace(_FENCE_OPEN, f"<{zwsp}tool_output")
    )


def _spotlight_tool_messages(messages: list[BaseMessage]) -> None:
    """Wrap ToolMessage content in `<tool_output>` delimiters in place.

    Spotlighting (spec 043 T1.4): tool results are untrusted data, not
    instructions. Fencing them makes prompt-injection inside a tool
    payload (e.g. a malicious knode body saying "ignore previous
    instructions") legible to the model as *data*, blunting indirect
    injection. The payload's own fence markers are neutralized first so a
    smuggled `</tool_output>` can't escape the fence. Idempotent — skips
    messages already fenced.
    """
    for m in messages:
        if not isinstance(m, ToolMessage):
            continue
        content = m.content if isinstance(m.content, str) else str(m.content)
        if content.startswith(_FENCE_OPEN):
            continue
        safe = _neutralize_fence_markers(content)
        m.content = f'<tool_output tool="{m.name}">\n{safe}\n</tool_output>'


def build_tool_loop_subgraph(
    skill: SkillBase,
    llm: Any,
    tools: list[Any],
    *,
    summary_prefix: str = "",
):
    """Build a bind_tools -> agent -> ToolNode loop subgraph.

    The agent node renders memory + the skill body as system prompt,
    invokes the tool-bound LLM, and appends its (possibly tool-calling)
    AIMessage. `tools_condition` routes to ToolNode while the LLM keeps
    emitting tool_calls; once it answers in plain text the loop ends.

    Falls back to the simple single-node subgraph when `tools` is empty
    or the LLM can't bind tools (e.g. a test fake without bind_tools).
    """
    bind = getattr(llm, "bind_tools", None)
    if not tools or not callable(bind):
        return build_simple_skill_subgraph(skill, llm, summary_prefix=summary_prefix)

    # spec 043 T1.3: bind with provider-aware params (parallel_tool_calls
    # off for all OpenAI-compatible models; enable_thinking off for
    # DashScope/Qwen). Validated against a real Qwen model.
    from systemedu.core.tutor.tools.binding import bind_tutor_tools

    llm_with_tools = bind_tutor_tools(llm, tools)
    body = skill.config.body or skill.config.description
    tool_node = ToolNode(tools, handle_tool_errors=True)

    async def agent(state: SimpleSkillState) -> dict:
        messages = list(state.get("messages") or [])
        # Spotlight any tool outputs already in the running list before
        # the model reads them again.
        _spotlight_tool_messages(messages)
        memory_block = render_memory_block(state.get("memory"))
        sys_text = f"{body}\n\n## 学生上下文\n{memory_block}"
        convo: list[BaseMessage] = [SystemMessage(content=sys_text), *messages]
        resp = await llm_with_tools.ainvoke(convo)
        turn = (state.get("turn_count") or 0) + 1
        has_calls = bool(getattr(resp, "tool_calls", None))
        summary = f"{summary_prefix}turn={turn}" if summary_prefix else f"turn={turn}"
        return {
            "messages": [resp],
            "turn_count": turn,
            "summary": summary,
            "last_step": ("tool_call" if has_calls else f"reply_{turn}"),
        }

    g = StateGraph(SimpleSkillState)
    g.add_node("agent", agent)
    g.add_node("tools", tool_node)
    g.add_edge(START, "agent")
    g.add_conditional_edges("agent", tools_condition)
    g.add_edge("tools", "agent")
    return g.compile()


# ---------------------------------------------------------------------------
# create_agent-based subgraph (spec 043 T1.8)
# ---------------------------------------------------------------------------
# T1.8 收敛「模型调用 + 工具循环」为官方 `langchain.agents.create_agent`，以拿
# 到 middleware 体系（HITL / ToolCallLimit / ModelFallback / PII …）。相比手写
# 的 `build_tool_loop_subgraph`，行为等价但可挂 middleware：
#
#   - memory → system prompt：`@dynamic_prompt` 读 state["memory"]，复用
#     `render_memory_block`，与手写路径的 system 文案一致；
#   - spotlighting + provider 参数：一个 `@wrap_model_call` 在**每次调模型前**
#     (1) 把 request.messages 里的 ToolMessage 用 `<tool_output>` 定界（复用
#     `_spotlight_tool_messages`，含 fence-escape 中和），(2) 把
#     `tutor_tool_bind_kwargs(llm)` 注入 request.model_settings，让 create_agent
#     的 bind_tools 透传 parallel_tool_calls=False / DashScope enable_thinking；
#   - `ToolCallLimitMiddleware(run_limit=…)` 防儿童场景失控循环。
#
# create_agent 的默认 AgentState 只有 messages；我们扩一个带 `memory` 的
# state_schema，主图 `_wrap_subgraph` 把 memory 塞进子图 input。输出 state 的
# messages 里含中间 tool-calling AIMessage + ToolMessage + 最终纯文本
# AIMessage——`_wrap_subgraph` 只挑最终纯文本回主图，与手写路径完全一致。


def build_agent_subgraph(
    skill: SkillBase,
    llm: Any,
    tools: list[Any],
    *,
    summary_prefix: str = "",
    run_limit: int = 8,
):
    """Build a `create_agent`-backed tool-loop subgraph for a skill.

    Behaviour-compatible with `build_tool_loop_subgraph` (same input
    `{messages, memory}`, same "only final plain-text AIMessage reaches
    the student" contract) but built on the official agent so middleware
    can be layered on. Falls back to the simple single-node subgraph when
    `tools` is empty or the LLM can't bind tools (test fakes / local
    wrappers without `bind_tools`).

    Args:
        skill: the owning skill (its `config.body` becomes the prompt base).
        llm: chat model (OpenAI-compatible in prod; fakes in tests).
        tools: resolved `BaseTool` objects (already whitelist-filtered).
        summary_prefix: prefix for the L5 `summary` line.
        run_limit: max tool calls per run before the loop is force-stopped.
    """
    bind = getattr(llm, "bind_tools", None)
    if not tools or not callable(bind):
        return build_simple_skill_subgraph(skill, llm, summary_prefix=summary_prefix)

    from langchain.agents import create_agent
    from langchain.agents.middleware import (
        AgentState,
        HumanInTheLoopMiddleware,
        ModelRequest,
        ModelResponse,
        ToolCallLimitMiddleware,
        dynamic_prompt,
        wrap_model_call,
    )

    from systemedu.core.tutor.tools.binding import tutor_tool_bind_kwargs
    from systemedu.core.tutor.tools.decorator import get_tool_meta

    body = skill.config.body or skill.config.description
    bind_kwargs = tutor_tool_bind_kwargs(llm)

    # spec 043 T1.9/1C: write-class tools (progress/grade/escalate) pause the
    # graph for student confirmation before they run. We pick them off the
    # tool's own `access` metadata so the whitelist stays the single source of
    # truth — no hand-maintained name list to drift. approve → tool runs;
    # reject → tool skipped, a synthetic ToolMessage tells the model why.
    interrupt_on = {
        t.name: {"allowed_decisions": ["approve", "reject"]}
        for t in tools
        if (m := get_tool_meta(t)) is not None and m.access == "write"
    }

    class _AgentSkillState(AgentState, total=False):
        # Handed in by the main graph's `_wrap_subgraph`; read by the
        # dynamic prompt. `total=False` so callers may omit it.
        memory: dict[str, Any]

    @dynamic_prompt
    def _memory_prompt(request: ModelRequest) -> str:
        memory_block = render_memory_block(request.state.get("memory"))
        return f"{body}\n\n## 学生上下文\n{memory_block}"

    @wrap_model_call
    async def _spotlight_and_params(
        request: ModelRequest,
        handler: Any,
    ) -> ModelResponse:
        # Fence any tool outputs already in the batch before the model
        # re-reads them (indirect-injection defence, spec 043 T1.4).
        _spotlight_tool_messages(request.messages)
        # Forward Qwen/OpenAI tool-calling params through create_agent's
        # bind_tools via model_settings (spec 043 T1.3).
        if bind_kwargs:
            request.model_settings.update(bind_kwargs)
        return await handler(request)

    middleware: list[Any] = [
        _memory_prompt,
        _spotlight_and_params,
        # exit_behavior="end": hard-stop the run once run_limit tool calls
        # are reached (child-safety: a misbehaving model that never stops
        # tool-calling must not loop to the recursion limit). Safe here
        # because parallel_tool_calls=False guarantees one call per turn —
        # "end" raises NotImplementedError only on parallel pending calls.
        ToolCallLimitMiddleware(run_limit=run_limit, exit_behavior="end"),
    ]
    # Only add HITL when this skill actually holds a write tool — a middleware
    # with an empty interrupt_on still adds an after_model hop for nothing.
    if interrupt_on:
        middleware.append(HumanInTheLoopMiddleware(interrupt_on=interrupt_on))

    return create_agent(
        llm,
        tools=tools,
        state_schema=_AgentSkillState,
        middleware=middleware,
    )


__all__ = [
    "SimpleSkillState",
    "render_memory_block",
    "call_llm",
    "build_simple_skill_subgraph",
    "build_tool_loop_subgraph",
    "build_agent_subgraph",
]
