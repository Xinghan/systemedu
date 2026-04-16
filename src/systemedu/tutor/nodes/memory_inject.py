"""Memory injection node — Phase 1 no-op.

Final: parallel asyncio.gather of 5 recall layers into a
MemorySnapshot (T2.x). For now returns an empty dict.
"""

from __future__ import annotations

from systemedu.tutor.state import TutorState


async def memory_inject_node(state: TutorState) -> dict:
    return {}
