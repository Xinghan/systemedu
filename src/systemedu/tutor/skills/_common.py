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

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

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


__all__ = [
    "SimpleSkillState",
    "render_memory_block",
    "call_llm",
    "build_simple_skill_subgraph",
]
