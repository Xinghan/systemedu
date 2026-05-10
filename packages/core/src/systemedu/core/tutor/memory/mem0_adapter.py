"""Async adapter around `systemedu.core.memory.client` (spec 014 T2.6).

`MemoryInjector._l4_semantic_recall` expects an async `search(...)`
method, but the existing Mem0 helpers in `systemedu.core.memory.client` are
sync. This module wraps them with `asyncio.to_thread` so the L4 call
doesn't block the event loop.

Keep this thin — all filtering / limit logic stays in the layer, not
here. If Mem0 is disabled globally, `retrieve_memories` already
returns []; the adapter surfaces that as an empty list.
"""

from __future__ import annotations

import asyncio
from typing import Any

from systemedu.core.memory.client import retrieve_memories


class Mem0AsyncAdapter:
    """Adapter that matches MemoryInjector's _Mem0Client protocol.

    Usage::

        injector = MemoryInjector(
            db_session_factory=SessionLocal,
            mem0_client=Mem0AsyncAdapter(),
        )
    """

    async def search(
        self,
        query: str,
        *,
        user_id: str,
        filters: dict[str, Any] | None = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        project_id: str | None = None
        if filters:
            project_id = filters.get("project_name") or filters.get("project_id")

        def _call() -> list[str]:
            return retrieve_memories(
                user_id=user_id,
                query=query,
                project_id=project_id,
                limit=limit,
            )

        memories = await asyncio.to_thread(_call)
        return [{"memory": m} for m in memories]


__all__ = ["Mem0AsyncAdapter"]
