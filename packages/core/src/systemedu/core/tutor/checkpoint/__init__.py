"""LangGraph checkpoint backend selection (spec 014 §10).

`get_checkpointer(cfg)` returns an async context manager yielding a
LangGraph checkpointer, routed to SQLite or Postgres based on
`cfg.checkpoint_backend`. Postgres is stubbed until spec 016.

Usage:
    async with get_checkpointer(cfg) as saver:
        graph = builder.compile(checkpointer=saver)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from systemedu.core.config import TutorConfig

from .sqlite_saver import open_sqlite_checkpointer


@asynccontextmanager
async def get_checkpointer(cfg: TutorConfig) -> AsyncIterator[object]:
    """Route to sqlite/postgres checkpointer per cfg.checkpoint_backend."""
    backend = cfg.checkpoint_backend
    if backend == "sqlite":
        async with open_sqlite_checkpointer(cfg.checkpoint_sqlite_path) as saver:
            yield saver
    elif backend == "postgres":
        from .pg_saver import open_pg_checkpointer

        async with open_pg_checkpointer(cfg.postgres_url) as saver:
            yield saver
    else:
        raise ValueError(f"Unknown checkpoint_backend: {backend!r}")


__all__ = ["get_checkpointer", "open_sqlite_checkpointer"]
