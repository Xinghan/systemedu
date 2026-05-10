"""Async SQLite checkpointer with WAL pragmas (spec 014 §10.1).

The SQLite checkpoint DB is intentionally separate from the main
`systemedu.db` to keep checkpoint writes from contending with app
queries. WAL mode lets reads and writes happen concurrently.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import aiosqlite
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver


@asynccontextmanager
async def open_sqlite_checkpointer(db_path: str) -> AsyncIterator[AsyncSqliteSaver]:
    """Async context manager yielding a WAL-enabled AsyncSqliteSaver.

    Usage:
        async with open_sqlite_checkpointer(path) as saver:
            graph = builder.compile(checkpointer=saver)
    """
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA synchronous=NORMAL")
        await conn.commit()
        saver = AsyncSqliteSaver(conn)
        await saver.setup()
        yield saver


__all__ = ["open_sqlite_checkpointer"]
