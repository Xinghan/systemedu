"""Scaffolding skill (spec 014 T3.6).

Text-only subgraph for Phase 3 — calls the LLM with the SKILL.md body
and a memory-aware prompt. Phase 4 will wire in `get_knode_prerequisites`
to actually pull the prerequisite list; until then the LLM reasons off
the L3 knode_state string in memory.
"""

from __future__ import annotations

from typing import Any

from systemedu.core.tutor.skills._common import build_simple_skill_subgraph
from systemedu.core.tutor.skills.base import SkillBase


class ScaffoldingSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        return build_simple_skill_subgraph(self, llm, summary_prefix="scaffolding ")


SKILL_CLASS = ScaffoldingSkill
__all__ = ["ScaffoldingSkill", "SKILL_CLASS"]
