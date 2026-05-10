"""Reflection-prompt skill (spec 014 T3.9).

Two-phase: (1) ask reflection questions, (2) when the student gives a
coherent self-summary, suggest `complete_node` with confirm=True.
Detection of "coherent summary" is delegated to the LLM — we ask it to
return a `ready_to_complete: yes|no` marker that we parse.
"""

from __future__ import annotations

import re
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from systemedu.core.tutor.skills._common import call_llm, render_memory_block
from systemedu.core.tutor.skills.base import SkillBase


class ReflectionPromptState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int
    ready_to_complete: bool
    summary: str
    last_step: str
    memory: dict[str, Any]


_READY_RE = re.compile(r"ready_to_complete\s*[:：]\s*(yes|no)", re.I)


def _last_student(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
    return ""


class ReflectionPromptSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        body = self.config.body or self.config.description

        async def prompt(state: ReflectionPromptState) -> dict:
            messages = state.get("messages") or []
            memory = render_memory_block(state.get("memory"))
            user_block = (
                f"{memory}\n\n"
                f"## 学生消息\n{_last_student(messages)}\n\n"
                "请一次只问一个反思问题（不超过 40 字），"
                "然后在最后一行写 `ready_to_complete: yes|no`。"
                "yes 表示学生已经能清晰自述理解并建议 complete_node。"
            )
            reply = await call_llm(llm, body, user_block)
            m = _READY_RE.search(reply)
            ready = bool(m and m.group(1).lower() == "yes")
            turn = (state.get("turn_count") or 0) + 1
            return {
                "messages": [AIMessage(content=reply)],
                "turn_count": turn,
                "ready_to_complete": ready,
                "summary": "ready_for_complete" if ready else f"reflect {turn}",
                "last_step": f"reflect_{turn}",
            }

        g = StateGraph(ReflectionPromptState)
        g.add_node("prompt", prompt)
        g.add_edge(START, "prompt")
        g.add_edge("prompt", END)
        return g.compile()


SKILL_CLASS = ReflectionPromptSkill
__all__ = ["ReflectionPromptSkill", "SKILL_CLASS"]
