"""Tests for FactExtractionWorker (spec 014 T2.5).

Uses a fake clock + fake sleep so ticks are synchronous and no wall
time passes. A FakeLLM returns canned JSON so FactExtractor runs end
to end against a real SQLite.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.core.storage.db import (
    Base,
    ChatMessage,
    ChatSession,
    PendingFactExtraction,
    StudentFact,
)
from systemedu.core.tutor.memory import FactExtractor
from systemedu.core.tutor.worker import FactExtractionWorker


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def engine(tmp_path):
    eng = create_engine(
        f"sqlite:///{tmp_path / 'worker.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def session_factory(engine):
    return sessionmaker(bind=engine)


@dataclass
class _FakeAIMessage:
    content: str


class FakeLLM:
    def __init__(self, response_text: str = "[]"):
        self.response_text = response_text
        self.call_count = 0

    async def ainvoke(self, messages):
        self.call_count += 1
        return _FakeAIMessage(content=self.response_text)


class FailingLLM:
    """Always raises — used to trigger extractor failure."""

    def __init__(self):
        self.call_count = 0

    async def ainvoke(self, messages):
        self.call_count += 1
        raise RuntimeError("llm boom")


class FakeClock:
    def __init__(self, start: datetime):
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, delta: timedelta) -> None:
        self.now += delta


async def noop_sleep(_seconds: float) -> None:
    return None


def _seed_session_with_messages(
    session_factory,
    *,
    session_id: str,
    user_id: str,
    project: str = "P1",
    knode: str = "k10",
    messages: list[tuple[str, str]] | None = None,
    messages_at: datetime | None = None,
):
    """Insert a ChatSession + messages and return the db so caller can enqueue."""
    db = session_factory()
    try:
        db.add(ChatSession(
            id=session_id, agent_name="tutor", project_name=project,
            user_id=user_id, knode_id=knode,
        ))
        db.flush()
        msgs = messages or [("user", "hi"), ("assistant", "hello")]
        for role, content in msgs:
            m = ChatMessage(session_id=session_id, role=role, content=content)
            if messages_at is not None:
                m.created_at = messages_at
            db.add(m)
        db.commit()
    finally:
        db.close()


def _build_extractor_factory(llm):
    def _factory(db):
        return FactExtractor(db, llm)
    return _factory


# ---------------------------------------------------------------------------
# Startup zombie reap
# ---------------------------------------------------------------------------
class TestStartupReap:
    @pytest.mark.asyncio
    async def test_reaps_zombies_on_start(self, session_factory):
        """start() must call reap_zombies before spawning the loop.

        We isolate the reap step so the subsequent loop doesn't
        immediately claim the reaped row.
        """
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))
        db = session_factory()
        # started_at is compared against real datetime.utcnow() inside
        # the DAO, so set it far enough in the past regardless of the
        # wall clock.
        zombie = PendingFactExtraction(
            session_id="s-zombie", user_id="u1",
            last_message_at=clock.now,
            status="processing",
            started_at=datetime(2000, 1, 1),
        )
        db.add(zombie)
        db.commit()
        db.close()

        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FakeLLM()),
            clock=clock,
            sleep=noop_sleep,
        )
        # call the startup reap directly — we don't need the loop for
        # this assertion and starting it would immediately re-claim the
        # pending row.
        await w._reap_zombies_on_startup()

        db = session_factory()
        try:
            row = db.query(PendingFactExtraction).one()
            assert row.status == "pending"
            assert row.started_at is None
        finally:
            db.close()
        assert w.stats.zombies_reaped == 1


# ---------------------------------------------------------------------------
# 2h fallback enqueue
# ---------------------------------------------------------------------------
class TestFallbackEnqueue:
    @pytest.mark.asyncio
    async def test_enqueues_stale_session(self, session_factory):
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))
        old = clock.now - timedelta(hours=3)
        _seed_session_with_messages(
            session_factory,
            session_id="s-stale", user_id="u1",
            messages_at=old,
        )

        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FakeLLM("[]")),
            clock=clock, sleep=noop_sleep,
        )
        await w.tick()

        db = session_factory()
        try:
            pending = db.query(PendingFactExtraction).one()
            assert pending.session_id == "s-stale"
            # the stale session was enqueued and then claimed + processed
            # in the same tick, so status is "done" by now
            assert pending.status == "done"
        finally:
            db.close()
        assert w.stats.enqueued_by_fallback == 1
        assert w.stats.extracted == 1

    @pytest.mark.asyncio
    async def test_does_not_double_enqueue(self, session_factory):
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))
        old = clock.now - timedelta(hours=3)
        _seed_session_with_messages(
            session_factory,
            session_id="s1", user_id="u1",
            messages_at=old,
        )
        # a pending row already exists
        db = session_factory()
        db.add(PendingFactExtraction(
            session_id="s1", user_id="u1",
            last_message_at=old, status="pending",
        ))
        db.commit()
        db.close()

        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FakeLLM("[]")),
            clock=clock, sleep=noop_sleep,
        )
        # pretend fallback scan only (don't let tick claim + drain)
        n = await asyncio.to_thread(w._enqueue_fallback)
        assert n == 0

    @pytest.mark.asyncio
    async def test_fresh_session_not_enqueued(self, session_factory):
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))
        recent = clock.now - timedelta(minutes=5)
        _seed_session_with_messages(
            session_factory,
            session_id="s-fresh", user_id="u1",
            messages_at=recent,
        )

        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FakeLLM("[]")),
            clock=clock, sleep=noop_sleep,
        )
        n = await asyncio.to_thread(w._enqueue_fallback)
        assert n == 0


# ---------------------------------------------------------------------------
# Batch claim + extraction
# ---------------------------------------------------------------------------
class TestTickExtraction:
    @pytest.mark.asyncio
    async def test_extracts_and_marks_done(self, session_factory):
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))
        _seed_session_with_messages(
            session_factory,
            session_id="s1", user_id="u1",
            messages=[("user", "我懂了坡度的原理")],
        )
        db = session_factory()
        db.add(PendingFactExtraction(
            session_id="s1", user_id="u1",
            last_message_at=clock.now,
        ))
        db.commit()
        db.close()

        fact_json = json.dumps([{
            "category": "knowledge",
            "content": "理解坡度",
            "confidence": 0.8,
            "knode_id": "k10",
        }])
        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FakeLLM(fact_json)),
            clock=clock, sleep=noop_sleep,
        )
        await w.tick()

        db = session_factory()
        try:
            assert db.query(StudentFact).count() == 1
            row = db.query(PendingFactExtraction).one()
            assert row.status == "done"
        finally:
            db.close()
        assert w.stats.extracted == 1

    @pytest.mark.asyncio
    async def test_respects_batch_size(self, session_factory):
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))
        # 8 sessions + 8 pending rows
        for i in range(8):
            _seed_session_with_messages(
                session_factory,
                session_id=f"s{i}", user_id="u1",
            )
            db = session_factory()
            db.add(PendingFactExtraction(
                session_id=f"s{i}", user_id="u1",
                last_message_at=clock.now,
            ))
            db.commit()
            db.close()

        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FakeLLM("[]")),
            clock=clock, sleep=noop_sleep,
            batch_size=5,
        )
        await w.tick()

        db = session_factory()
        try:
            done = db.query(PendingFactExtraction).filter_by(status="done").count()
            pending = db.query(PendingFactExtraction).filter_by(
                status="pending",
            ).count()
        finally:
            db.close()
        assert done == 5
        assert pending == 3

        # a second tick clears the remaining 3
        await w.tick()
        db = session_factory()
        try:
            assert db.query(PendingFactExtraction).filter_by(
                status="done",
            ).count() == 8
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Failure handling
# ---------------------------------------------------------------------------
class TestFailure:
    @pytest.mark.asyncio
    async def test_failed_extraction_increments_retry(self, session_factory):
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))
        _seed_session_with_messages(
            session_factory,
            session_id="s-fail", user_id="u1",
        )
        db = session_factory()
        db.add(PendingFactExtraction(
            session_id="s-fail", user_id="u1",
            last_message_at=clock.now,
        ))
        db.commit()
        db.close()

        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FailingLLM()),
            clock=clock, sleep=noop_sleep,
        )
        await w.tick()

        db = session_factory()
        try:
            row = db.query(PendingFactExtraction).one()
            assert row.retry_count == 1
            assert row.status == "pending"  # back to pending for retry
            assert row.error_msg and "boom" in row.error_msg
        finally:
            db.close()
        assert w.stats.failed == 1

    @pytest.mark.asyncio
    async def test_three_failures_mark_failed(self, session_factory):
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))
        _seed_session_with_messages(
            session_factory,
            session_id="s-bad", user_id="u1",
        )
        db = session_factory()
        db.add(PendingFactExtraction(
            session_id="s-bad", user_id="u1",
            last_message_at=clock.now,
        ))
        db.commit()
        db.close()

        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FailingLLM()),
            clock=clock, sleep=noop_sleep,
        )
        for _ in range(3):
            await w.tick()

        db = session_factory()
        try:
            row = db.query(PendingFactExtraction).one()
            assert row.retry_count == 3
            assert row.status == "failed"
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Start / stop lifecycle
# ---------------------------------------------------------------------------
class TestLifecycle:
    @pytest.mark.asyncio
    async def test_stop_halts_loop(self, session_factory):
        clock = FakeClock(datetime(2026, 4, 16, 12, 0))

        sleeps = []

        async def recording_sleep(seconds):
            sleeps.append(seconds)
            await asyncio.sleep(0)  # yield so _stopping flag can be checked

        w = FactExtractionWorker(
            db_session_factory=session_factory,
            extractor_factory=_build_extractor_factory(FakeLLM("[]")),
            clock=clock, sleep=recording_sleep,
            scan_interval=0.0,
        )
        await w.start()
        # let it run a few ticks
        await asyncio.sleep(0.01)
        await w.stop()
        assert w.stats.ticks > 0
        # task cleared so start/stop cycle is clean
        assert w._task is None
