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


__all__ = [
    "SimpleSkillState",
    "render_memory_block",
    "call_llm",
    "build_simple_skill_subgraph",
    "build_tool_loop_subgraph",
]
