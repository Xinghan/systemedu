"""Direct-instruction skill (spec 014 T3.5).

Two-step subgraph: first the LLM gives a structured explanation, on
subsequent turns (turn_count >= 1) it switches to practice-push mode
— drafts a short check question and marks `should_push_exercise` so
the main graph's output_stream can surface it as a practice card.
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from systemedu.core.tutor.skills._common import call_llm, render_memory_block
from systemedu.core.tutor.skills.base import SkillBase


class DirectInstructionState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int
    stage: str  # "explain" -> "check"
    should_push_exercise: bool
    summary: str
    last_step: str
    memory: dict[str, Any]


def _last_student(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
    return ""


class DirectInstructionSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        body = self.config.body or self.config.description

        async def respond(state: DirectInstructionState) -> dict:
            messages = state.get("messages") or []
            turn = (state.get("turn_count") or 0) + 1
            memory = render_memory_block(state.get("memory"))
            stage = "explain" if turn == 1 else "check"
            if stage == "explain":
                user_block = (
                    f"{memory}\n\n"
                    f"## 学生问题\n{_last_student(messages)}\n\n"
                    "请按 `结论 / 机制 / 例子` 三段式讲解，共不超过 200 字。"
                )
            else:
                user_block = (
                    f"{memory}\n\n"
                    f"## 学生最新回应\n{_last_student(messages)}\n\n"
                    "请出一道简短的检验题（单项选择或填空），"
                    "不要给答案。"
                )
            reply = await call_llm(llm, body, user_block)
            return {
                "messages": [AIMessage(content=reply)],
                "turn_count": turn,
                "stage": stage,
                "should_push_exercise": stage == "check",
                "summary": f"{stage} (turn {turn})",
                "last_step": f"{stage}_{turn}",
            }

        g = StateGraph(DirectInstructionState)
        g.add_node("respond", respond)
        g.add_edge(START, "respond")
        g.add_edge("respond", END)
        return g.compile()


SKILL_CLASS = DirectInstructionSkill
__all__ = ["DirectInstructionSkill", "SKILL_CLASS"]
