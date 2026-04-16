"""Skill router node — Phase 1 no-op.

Final: LLM-driven continue/switch/exit decision with max_turns
bound (T3.x). For now returns an empty skill_decision that routes
directly to output_stream (see graph.py route_to_skill fallback).
"""

from __future__ import annotations

from systemedu.tutor.state import TutorState


async def skill_router_node(state: TutorState) -> dict:
    return {}
