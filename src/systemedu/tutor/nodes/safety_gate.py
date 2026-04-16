"""Safety gate node — Phase 1 no-op.

Final: regex-prefilters sensitive topics and short-circuits to
output_stream via `_safety_triggered` flag (T5.x). For now returns
empty dict so the main graph always proceeds to memory_inject.
"""

from __future__ import annotations

from systemedu.tutor.state import TutorState


async def safety_gate_node(state: TutorState) -> dict:
    return {}
