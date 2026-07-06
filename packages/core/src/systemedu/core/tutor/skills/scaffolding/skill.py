"""Scaffolding skill (spec 014 T3.6, tool loop spec 043 P1).

Tool-calling skill: the LLM can pull the prerequisite list / knode content
via its whitelisted tools while reasoning off the L3 knode_state in memory.
Built on `create_agent` (spec 043 T1.8) so official middleware (tool-call
limit, later HITL / model fallback) applies.
"""

from __future__ import annotations

from typing import Any

from systemedu.core.tutor.skills._common import build_agent_subgraph
from systemedu.core.tutor.skills.base import SkillBase


class ScaffoldingSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        return build_agent_subgraph(
            self, llm, tools, summary_prefix="scaffolding ", ground_knowledge=True,
        )


SKILL_CLASS = ScaffoldingSkill
__all__ = ["ScaffoldingSkill", "SKILL_CLASS"]
