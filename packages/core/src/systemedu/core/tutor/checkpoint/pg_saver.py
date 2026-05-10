"""Postgres checkpointer stub (spec 016 scope).

Planned migration when Gateway horizontally scales (2+ instances),
daily concurrent sessions > 500, or checkpoint DB > 20 GB.

Implementation plan:
    pip install langgraph-checkpoint-postgres psycopg[binary]
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    async with AsyncPostgresSaver.from_conn_string(url) as saver:
        await saver.setup()
        yield saver
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator


@asynccontextmanager
async def open_pg_checkpointer(pg_url: str | None) -> AsyncIterator[object]:
    """Placeholder — raises NotImplementedError until spec 016."""
    raise NotImplementedError(
        "Postgres checkpoint backend is reserved for spec 016 "
        "(see design §10.2 迁移准备)."
    )
    # Unreachable; keeps the contextmanager decorator type-correct.
    yield None  # pragma: no cover


__all__ = ["open_pg_checkpointer"]
