"""Error-diagnosis skill (spec 014 T3.7, tool loop spec 043 P2).

Tool-calling skill built on `create_agent` (spec 043 T1.8): the LLM diagnoses a
wrong answer (concept / calc / strategy), can re-check it with `grade_submission`,
and pulls a targeted follow-up with `get_practice_exercises` — the formative
loop (spec 043 P2 判分反哺). `grade_submission` is a write tool, so it is gated
by HumanInTheLoopMiddleware (the graph pauses for the student's confirmation
before a submission is graded/recorded).

The old hand-rolled single-node subgraph is gone; the diagnose→verify→re-teach
flow and the concept/calc/strategy classification now live in SKILL.md and the
model follows them through the tool loop. The `error_type` skill-state field
(nothing in the runtime consumed it — the router decides off memory + messages)
was dropped with it.
"""

from __future__ import annotations

from typing import Any

from systemedu.core.tutor.skills._common import build_agent_subgraph
from systemedu.core.tutor.skills.base import SkillBase


class ErrorDiagnosisSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        return build_agent_subgraph(
            self, llm, tools, summary_prefix="error-diag ", ground_knowledge=True,
        )


SKILL_CLASS = ErrorDiagnosisSkill
__all__ = ["ErrorDiagnosisSkill", "SKILL_CLASS"]
