"""Socratic-questioning skill (spec 014 T3.4).

Leads the student to their own answer via question ladders. The
subgraph tracks `questions_asked` and `stuck_streak` so we can detect
the "2 rounds stuck" signal and adjust difficulty, and surfaces an
`escalation_hint` on the final turn for the router.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from systemedu.core.tutor.skills._common import call_llm, render_memory_block
from systemedu.core.tutor.skills.base import SkillBase


class SocraticState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int
    questions_asked: list[str]
    stuck_streak: int
    progress: Literal["exploring", "converging", "breakthrough", "stuck"]
    escalation_hint: str | None
    summary: str
    last_step: str
    memory: dict[str, Any]


_EARLY_EXIT_MARKERS = ("直接告诉我", "告诉答案", "别问了", "给答案")


def _last_student_text(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
    return ""


def _student_wants_answer(text: str) -> bool:
    return any(marker in text for marker in _EARLY_EXIT_MARKERS)


def _looks_stuck(text: str) -> bool:
    """Heuristic for 'I don't know' style replies."""
    stuck_markers = ("不知道", "没头绪", "不会", "没想法", "想不出")
    return any(m in text for m in stuck_markers)


class SocraticSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        body = self.config.body or self.config.description

        async def assess(state: SocraticState) -> dict:
            text = _last_student_text(state.get("messages") or [])
            stuck = state.get("stuck_streak") or 0
            if _looks_stuck(text):
                stuck += 1
            else:
                stuck = 0
            progress: str
            if _student_wants_answer(text):
                progress = "breakthrough"  # treat as exit-worthy signal
            elif stuck >= 2:
                progress = "stuck"
            else:
                progress = "exploring"
            return {"stuck_streak": stuck, "progress": progress}

        async def ask_question(state: SocraticState) -> dict:
            messages = state.get("messages") or []
            user_text = _last_student_text(messages)
            memory = render_memory_block(state.get("memory"))
            stuck = state.get("stuck_streak") or 0
            hint = ""
            if stuck >= 1:
                hint = "\n\n注意：学生在连续卡壳，请降低问题难度或换一种切入（类比/反例）。"
            user_block = (
                f"{memory}\n\n"
                f"## 学生消息\n{user_text}\n\n"
                f"## 当前进度\nturn={state.get('turn_count') or 0 + 1}{hint}\n\n"
                "请只提出 **一个** 问题，不要给出答案。"
            )
            reply = await call_llm(llm, body, user_block)
            turn = (state.get("turn_count") or 0) + 1
            return {
                "messages": [AIMessage(content=reply)],
                "questions_asked": (state.get("questions_asked") or []) + [reply],
                "turn_count": turn,
                "summary": f"question {turn}",
                "last_step": f"ask_{turn}",
            }

        async def set_escalation(state: SocraticState) -> dict:
            turn = (state.get("turn_count") or 0) + 1
            hint = "学生连续 2 轮卡壳，建议切换到 scaffolding（拆解前置）或 direct-instruction（直接讲解）。"
            return {
                "escalation_hint": hint,
                "messages": [AIMessage(content=hint)],
                "turn_count": turn,
                "summary": f"escalation (turn {turn})",
                "last_step": "set_escalation",
                "progress": "stuck",
            }

        def route_after_assess(state: SocraticState) -> str:
            progress = state.get("progress", "exploring")
            if progress == "stuck":
                return "set_escalation"
            return "ask_question"

        g = StateGraph(SocraticState)
        g.add_node("assess", assess)
        g.add_node("ask_question", ask_question)
        g.add_node("set_escalation", set_escalation)
        g.add_edge(START, "assess")
        g.add_conditional_edges(
            "assess",
            route_after_assess,
            {"ask_question": "ask_question", "set_escalation": "set_escalation"},
        )
        g.add_edge("ask_question", END)
        g.add_edge("set_escalation", END)
        return g.compile()

    def summarize_state(self, skill_state: dict[str, Any]) -> str:
        turn = skill_state.get("turn_count", 0)
        progress = skill_state.get("progress", "exploring")
        asked = len(skill_state.get("questions_asked") or [])
        lines = [
            f"- 当前策略: socratic-questioning (turn {turn}, progress={progress})",
            f"- 已问 {asked} 个问题",
        ]
        hint = skill_state.get("escalation_hint")
        if hint:
            lines.append(f"- escalation: {hint}")
        return "\n".join(lines)


SKILL_CLASS = SocraticSkill

__all__ = ["SocraticSkill", "SKILL_CLASS"]
