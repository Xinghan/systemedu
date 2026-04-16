"""Confirmation handler node — Phase 1 no-op.

Final: processes user's approved/rejected response to a pending
write-tool call (T5.x). For now returns an empty partial state so the
reducer leaves state untouched.
"""

from __future__ import annotations

from systemedu.tutor.state import TutorState


async def confirm_handler_node(state: TutorState) -> dict:
    return {}
