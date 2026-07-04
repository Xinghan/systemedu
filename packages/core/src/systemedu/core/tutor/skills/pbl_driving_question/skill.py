"""PBL driving-question skill (spec 014 T3.8, tool loop spec 043 P1).

Tool-calling skill built on `create_agent` (spec 043 T1.8).
"""

from __future__ import annotations

from typing import Any

from systemedu.core.tutor.skills._common import build_agent_subgraph
from systemedu.core.tutor.skills.base import SkillBase


class PblDrivingQuestionSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        return build_agent_subgraph(self, llm, tools, summary_prefix="pbl ")


SKILL_CLASS = PblDrivingQuestionSkill
__all__ = ["PblDrivingQuestionSkill", "SKILL_CLASS"]
