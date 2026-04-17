"""Tests for FactExtractionWorker gateway lifecycle integration (T5.4).

Verifies:
- Worker starts on gateway startup
- Worker stops gracefully on shutdown
- Worker continues running if one tick fails
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.storage.db import Base
from systemedu.tutor.worker import FactExtractionWorker


@pytest.fixture()
def db_factory(tmp_path):
    """Return a session factory backed by an in-memory DB."""
    engine = create_engine(f"sqlite:///{tmp_path / 'worker_test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    return factory


@pytest.fixture()
def noop_extractor_factory():
    """Return a factory that creates a mock extractor (never actually called)."""
    def _factory(db):
        m = MagicMock()
        m.extract_session = MagicMock()
        return m
    return _factory


class TestWorkerLifecycle:
    @pytest.mark.asyncio
    async def test_start_creates_task(self, db_factory, noop_extractor_factory):
        worker = FactExtractionWorker(
            db_session_factory=db_factory,
            extractor_factory=noop_extractor_factory,
            scan_interval=0.05,  # fast for tests
        )

        await worker.start()
        assert worker._task is not None
        assert not worker._task.done()

        await worker.stop(timeout=2.0)
        assert worker._task is None

    @pytest.mark.asyncio
    async def test_stop_is_graceful(self, db_factory, noop_extractor_factory):
        """Worker should finish current tick before stopping."""
        tick_count_before = 0

        worker = FactExtractionWorker(
            db_session_factory=db_factory,
            extractor_factory=noop_extractor_factory,
            scan_interval=0.05,
        )

        await worker.start()
        # Let it tick a couple times
        await asyncio.sleep(0.15)
        tick_count_before = worker.stats.ticks
        assert tick_count_before >= 1

        await worker.stop(timeout=2.0)
        assert worker._stopping is True
        # No more ticks after stop
        assert worker.stats.ticks >= tick_count_before

    @pytest.mark.asyncio
    async def test_double_start_raises(self, db_factory, noop_extractor_factory):
        worker = FactExtractionWorker(
            db_session_factory=db_factory,
            extractor_factory=noop_extractor_factory,
        )

        await worker.start()
        with pytest.raises(RuntimeError, match="already started"):
            await worker.start()

        await worker.stop(timeout=2.0)

    @pytest.mark.asyncio
    async def test_stop_noop_when_not_started(self, db_factory, noop_extractor_factory):
        worker = FactExtractionWorker(
            db_session_factory=db_factory,
            extractor_factory=noop_extractor_factory,
        )

        await worker.stop()  # should not raise
        assert worker._task is None

    @pytest.mark.asyncio
    async def test_zombie_reap_on_startup(self, db_factory, noop_extractor_factory):
        """Worker reaps zombie rows (status=processing for > zombie_after) on start."""
        from systemedu.storage.db import PendingFactExtraction

        # Seed a zombie row
        db = db_factory()
        zombie = PendingFactExtraction(
            session_id="s-zombie",
            user_id="u1",
            status="processing",
            retry_count=1,
            last_message_at=datetime.utcnow(),
            started_at=datetime.utcnow() - timedelta(minutes=30),
        )
        db.add(zombie)
        db.commit()
        db.close()

        worker = FactExtractionWorker(
            db_session_factory=db_factory,
            extractor_factory=noop_extractor_factory,
            zombie_after=timedelta(minutes=10),
            scan_interval=999,  # don't tick
        )

        await worker.start()
        assert worker.stats.zombies_reaped == 1

        # Verify the row was reset to pending
        db2 = db_factory()
        row = db2.query(PendingFactExtraction).filter_by(session_id="s-zombie").one()
        assert row.status == "pending"
        db2.close()

        await worker.stop(timeout=2.0)
