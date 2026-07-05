"""Direct-instruction skill (spec 014 T3.5, tool loop spec 043 P1/1C).

Tool-calling skill built on `create_agent` (spec 043 T1.8): the LLM explains
structured content, pushes a check exercise via `get_practice_exercises`, and
— once the student answers correctly — may call the write tool `complete_node`
to mark the knode done. `complete_node` is gated by HumanInTheLoopMiddleware, so
the graph pauses for the student's confirmation before it runs (spec 043 1C).

The old hand-rolled explain→check turn machine is gone; the "结论/机制/例子 then
push a check question then complete on correct" flow now lives in SKILL.md and
the model follows it through the tool loop. `should_push_exercise` (a skill-state
flag nothing in the runtime consumed) was dropped with it.
"""

from __future__ import annotations

from typing import Any

from systemedu.core.tutor.skills._common import build_agent_subgraph
from systemedu.core.tutor.skills.base import SkillBase


class DirectInstructionSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        return build_agent_subgraph(self, llm, tools, summary_prefix="direct ")


SKILL_CLASS = DirectInstructionSkill
__all__ = ["DirectInstructionSkill", "SKILL_CLASS"]
