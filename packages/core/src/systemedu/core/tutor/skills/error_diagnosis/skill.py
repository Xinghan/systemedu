"""Error-diagnosis skill (spec 014 T3.7).

Asks the LLM to emit a short diagnosis + `error_type` in [concept,
calc, strategy]. Strips the type out of the response and stores it
in `skill_state` so the router can switch to scaffolding / reflection
as described in SKILL.md.
"""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from systemedu.core.tutor.skills._common import call_llm, render_memory_block
from systemedu.core.tutor.skills.base import SkillBase


ErrorType = Literal["concept", "calc", "strategy", "unknown"]


class ErrorDiagnosisState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int
    error_type: ErrorType
    summary: str
    last_step: str
    memory: dict[str, Any]


_ERROR_TYPE_RE = re.compile(r"error_type\s*[:：]\s*(concept|calc|strategy)", re.I)


def _last_student(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
    return ""


def _parse_error_type(reply: str) -> ErrorType:
    m = _ERROR_TYPE_RE.search(reply)
    if not m:
        return "unknown"
    return m.group(1).lower()  # type: ignore[return-value]


class ErrorDiagnosisSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        body = self.config.body or self.config.description

        async def diagnose(state: ErrorDiagnosisState) -> dict:
            messages = state.get("messages") or []
            memory = render_memory_block(state.get("memory"))
            user_block = (
                f"{memory}\n\n"
                f"## 学生错误答案\n{_last_student(messages)}\n\n"
                "请先给出一段简短诊断（不超过 60 字），"
                "然后在最后一行写 `error_type: concept|calc|strategy`。"
            )
            reply = await call_llm(llm, body, user_block)
            err = _parse_error_type(reply)
            turn = (state.get("turn_count") or 0) + 1
            return {
                "messages": [AIMessage(content=reply)],
                "turn_count": turn,
                "error_type": err,
                "summary": f"diagnosed {err}",
                "last_step": f"diagnose_{turn}",
            }

        g = StateGraph(ErrorDiagnosisState)
        g.add_node("diagnose", diagnose)
        g.add_edge(START, "diagnose")
        g.add_edge("diagnose", END)
        return g.compile()


SKILL_CLASS = ErrorDiagnosisSkill
__all__ = ["ErrorDiagnosisSkill", "SKILL_CLASS"]
