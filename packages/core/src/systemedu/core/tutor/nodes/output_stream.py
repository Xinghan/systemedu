"""Output stream node — Phase 1 no-op.

Final: emits SSE events (token/tool_call/escalation/...) to the
gateway (T4.x). For now returns an empty dict so graph runs END-ward.
"""

from __future__ import annotations

from systemedu.core.tutor.state import TutorState


async def output_stream_node(state: TutorState) -> dict:
    return {}
