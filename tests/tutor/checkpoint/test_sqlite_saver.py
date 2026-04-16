"""Tests for SQLite checkpoint wrapper (spec 014 T1.4)."""

from __future__ import annotations

import aiosqlite
import pytest
from langgraph.checkpoint.base import Checkpoint, CheckpointMetadata

from systemedu.core.config import TutorConfig
from systemedu.tutor.checkpoint import get_checkpointer, open_sqlite_checkpointer


@pytest.fixture
def ckpt_path(tmp_path):
    return str(tmp_path / "checkpoints.db")


class TestSqliteSaverPragmas:
    """WAL + synchronous=NORMAL must be enabled on the underlying conn."""

    async def test_wal_mode_enabled(self, ckpt_path):
        async with open_sqlite_checkpointer(ckpt_path) as saver:
            # saver.conn is the underlying aiosqlite.Connection
            async with saver.conn.execute("PRAGMA journal_mode") as cur:
                row = await cur.fetchone()
            assert row[0].lower() == "wal"

    async def test_synchronous_normal(self, ckpt_path):
        async with open_sqlite_checkpointer(ckpt_path) as saver:
            async with saver.conn.execute("PRAGMA synchronous") as cur:
                row = await cur.fetchone()
            # synchronous=NORMAL -> returns integer 1
            assert row[0] == 1

    async def test_parent_dir_autocreate(self, tmp_path):
        deep = tmp_path / "a" / "b" / "c" / "ck.db"
        assert not deep.parent.exists()
        async with open_sqlite_checkpointer(str(deep)):
            pass
        assert deep.parent.exists()
        assert deep.exists()


class TestSqliteSaverPersistence:
    """put/get/list basic operations + same thread_id retrievable by step."""

    async def test_put_then_get_tuple(self, ckpt_path):
        async with open_sqlite_checkpointer(ckpt_path) as saver:
            config = {"configurable": {"thread_id": "t1", "checkpoint_ns": ""}}
            cp: Checkpoint = {
                "v": 1,
                "id": "cp-1",
                "ts": "2026-04-16T00:00:00+00:00",
                "channel_values": {"messages": ["hi"]},
                "channel_versions": {"messages": 1},
                "versions_seen": {},
                "pending_sends": [],
            }
            meta: CheckpointMetadata = {"source": "loop", "step": 0,
                                        "writes": {}, "parents": {}}
            new_cfg = await saver.aput(config, cp, meta, new_versions={"messages": 1})
            assert new_cfg["configurable"]["thread_id"] == "t1"

            got = await saver.aget_tuple(new_cfg)
            assert got is not None
            assert got.checkpoint["id"] == "cp-1"
            assert got.checkpoint["channel_values"]["messages"] == ["hi"]

    async def test_list_returns_multiple_steps(self, ckpt_path):
        async with open_sqlite_checkpointer(ckpt_path) as saver:
            cfg = {"configurable": {"thread_id": "t1", "checkpoint_ns": ""}}
            for step in range(3):
                cp: Checkpoint = {
                    "v": 1,
                    "id": f"cp-{step}",
                    "ts": f"2026-04-16T00:00:0{step}+00:00",
                    "channel_values": {"n": step},
                    "channel_versions": {"n": step + 1},
                    "versions_seen": {},
                    "pending_sends": [],
                }
                meta: CheckpointMetadata = {"source": "loop", "step": step,
                                            "writes": {}, "parents": {}}
                cfg = await saver.aput(cfg, cp, meta, new_versions={"n": step + 1})

            items = [t async for t in saver.alist(
                {"configurable": {"thread_id": "t1", "checkpoint_ns": ""}})]
            assert len(items) == 3
            # Newest first by default
            assert items[0].checkpoint["id"] == "cp-2"
            assert items[-1].checkpoint["id"] == "cp-0"

    async def test_isolated_thread_ids(self, ckpt_path):
        """Two thread_ids don't leak checkpoints into each other."""
        async with open_sqlite_checkpointer(ckpt_path) as saver:
            for tid in ("alpha", "beta"):
                cfg = {"configurable": {"thread_id": tid, "checkpoint_ns": ""}}
                cp: Checkpoint = {
                    "v": 1,
                    "id": f"cp-{tid}",
                    "ts": "2026-04-16T00:00:00+00:00",
                    "channel_values": {"owner": tid},
                    "channel_versions": {"owner": 1},
                    "versions_seen": {},
                    "pending_sends": [],
                }
                meta: CheckpointMetadata = {"source": "loop", "step": 0,
                                            "writes": {}, "parents": {}}
                await saver.aput(cfg, cp, meta, new_versions={"owner": 1})

            alpha_items = [t async for t in saver.alist(
                {"configurable": {"thread_id": "alpha", "checkpoint_ns": ""}})]
            beta_items = [t async for t in saver.alist(
                {"configurable": {"thread_id": "beta", "checkpoint_ns": ""}})]
            assert len(alpha_items) == 1
            assert len(beta_items) == 1
            assert alpha_items[0].checkpoint["channel_values"]["owner"] == "alpha"
            assert beta_items[0].checkpoint["channel_values"]["owner"] == "beta"


class TestCheckpointerRouter:
    """get_checkpointer(cfg) routes by cfg.checkpoint_backend."""

    async def test_sqlite_backend(self, ckpt_path):
        cfg = TutorConfig(
            checkpoint_backend="sqlite",
            checkpoint_sqlite_path=ckpt_path,
        )
        async with get_checkpointer(cfg) as saver:
            # Smoke: WAL enabled via the real sqlite path
            async with saver.conn.execute("PRAGMA journal_mode") as cur:
                row = await cur.fetchone()
            assert row[0].lower() == "wal"

    async def test_postgres_backend_raises_not_implemented(self):
        cfg = TutorConfig(
            checkpoint_backend="postgres",
            postgres_url="postgres://localhost/foo",
        )
        with pytest.raises(NotImplementedError, match="spec 016"):
            async with get_checkpointer(cfg):
                pass

    async def test_unknown_backend_rejected_by_pydantic(self):
        """Pydantic Literal blocks invalid backends at construction."""
        with pytest.raises(Exception):  # ValidationError
            TutorConfig(checkpoint_backend="dynamodb")  # type: ignore[arg-type]
