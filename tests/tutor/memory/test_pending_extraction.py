"""Tests for PendingFactExtractionDAO (spec 014 T2.4)."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.storage.db import Base, PendingFactExtraction
from systemedu.tutor.memory import PendingFactExtractionDAO


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def dao(db):
    return PendingFactExtractionDAO(db)


class TestEnqueue:
    def test_initial_enqueue(self, dao, db):
        row = dao.enqueue(
            session_id="sess-1",
            user_id="u1",
            last_message_at=datetime(2026, 4, 16, 10, 0),
        )
        db.commit()
        assert row.status == "pending"
        assert row.retry_count == 0

    def test_enqueue_idempotent(self, dao, db):
        dao.enqueue(session_id="s1", user_id="u1",
                    last_message_at=datetime(2026, 4, 16, 10, 0))
        db.commit()
        dao.enqueue(session_id="s1", user_id="u1",
                    last_message_at=datetime(2026, 4, 16, 11, 0))
        db.commit()

        rows = db.query(PendingFactExtraction).all()
        assert len(rows) == 1
        # Second enqueue bumps last_message_at
        assert rows[0].last_message_at == datetime(2026, 4, 16, 11, 0)

    def test_enqueue_preserves_status_on_reenqueue(self, dao, db):
        """If worker claimed a row, re-enqueue should NOT reset it to pending."""
        row = dao.enqueue(session_id="s1", user_id="u1",
                          last_message_at=datetime(2026, 4, 16, 10, 0))
        db.commit()
        claimed = dao.claim_pending()
        db.commit()
        assert claimed[0].status == "processing"

        dao.enqueue(session_id="s1", user_id="u1",
                    last_message_at=datetime(2026, 4, 16, 12, 0))
        db.commit()
        db.refresh(row)
        assert row.status == "processing"  # not reset
        assert row.last_message_at == datetime(2026, 4, 16, 12, 0)


class TestClaimPending:
    def test_claim_transitions_to_processing(self, dao, db):
        dao.enqueue(session_id="s1", user_id="u1",
                    last_message_at=datetime.utcnow())
        db.commit()

        claimed = dao.claim_pending()
        db.commit()
        assert len(claimed) == 1
        assert claimed[0].status == "processing"
        assert claimed[0].started_at is not None

    def test_claim_respects_limit(self, dao, db):
        for i in range(8):
            dao.enqueue(session_id=f"s{i}", user_id="u1",
                        last_message_at=datetime.utcnow())
        db.commit()

        claimed = dao.claim_pending(limit=5)
        db.commit()
        assert len(claimed) == 5

    def test_claim_oldest_first(self, dao, db):
        # Enqueue 3 rows with distinct enqueued_at via controlled inserts
        for i in range(3):
            row = PendingFactExtraction(
                session_id=f"s{i}",
                user_id="u1",
                last_message_at=datetime.utcnow(),
                enqueued_at=datetime(2026, 4, 1, i, 0),
            )
            db.add(row)
        db.commit()

        claimed = dao.claim_pending(limit=2)
        db.commit()
        assert [r.session_id for r in claimed] == ["s0", "s1"]

    def test_claim_skips_processing_and_done(self, dao, db):
        r1 = dao.enqueue(session_id="s1", user_id="u1",
                         last_message_at=datetime.utcnow())
        r2 = dao.enqueue(session_id="s2", user_id="u1",
                         last_message_at=datetime.utcnow())
        db.commit()

        # First claim takes both
        dao.claim_pending()
        db.commit()

        # Second claim finds nothing — both processing
        second = dao.claim_pending()
        assert second == []

    def test_claim_skips_max_retries_exhausted(self, dao, db):
        row = PendingFactExtraction(
            session_id="s1",
            user_id="u1",
            last_message_at=datetime.utcnow(),
            status="pending",
            retry_count=3,  # at cap
        )
        db.add(row)
        db.commit()

        assert dao.claim_pending(max_retries=3) == []

    def test_claim_none_when_empty(self, dao):
        assert dao.claim_pending() == []


class TestMarkDone:
    def test_mark_done_sets_completed(self, dao, db):
        row = dao.enqueue(session_id="s1", user_id="u1",
                          last_message_at=datetime.utcnow())
        db.commit()
        dao.claim_pending()
        db.commit()

        dao.mark_done(row.id)
        db.commit()

        db.refresh(row)
        assert row.status == "done"
        assert row.completed_at is not None


class TestMarkFailed:
    def test_first_failure_reverts_to_pending(self, dao, db):
        row = dao.enqueue(session_id="s1", user_id="u1",
                          last_message_at=datetime.utcnow())
        db.commit()
        dao.claim_pending()
        db.commit()

        dao.mark_failed(row.id, error_msg="LLM timeout")
        db.commit()

        db.refresh(row)
        assert row.status == "pending"
        assert row.retry_count == 1
        assert row.error_msg == "LLM timeout"
        assert row.started_at is None

    def test_third_failure_marks_failed(self, dao, db):
        row = dao.enqueue(session_id="s1", user_id="u1",
                          last_message_at=datetime.utcnow())
        db.commit()

        for i in range(3):
            # Claim and fail repeatedly — after each failure the row
            # goes back to pending until retry_count hits 3.
            dao.claim_pending()
            db.commit()
            dao.mark_failed(row.id, error_msg=f"attempt {i+1}")
            db.commit()

        db.refresh(row)
        assert row.retry_count == 3
        assert row.status == "failed"
        assert row.completed_at is not None


class TestReapZombies:
    def test_reaps_stuck_processing(self, dao, db):
        stuck = PendingFactExtraction(
            session_id="s1",
            user_id="u1",
            last_message_at=datetime.utcnow(),
            status="processing",
            started_at=datetime.utcnow() - timedelta(minutes=30),
        )
        fresh = PendingFactExtraction(
            session_id="s2",
            user_id="u1",
            last_message_at=datetime.utcnow(),
            status="processing",
            started_at=datetime.utcnow(),
        )
        db.add_all([stuck, fresh])
        db.commit()

        n = dao.reap_zombies(older_than=timedelta(minutes=10))
        db.commit()
        assert n == 1

        db.refresh(stuck)
        db.refresh(fresh)
        assert stuck.status == "pending"
        assert stuck.started_at is None
        assert fresh.status == "processing"

    def test_reap_noop_when_none_stuck(self, dao, db):
        dao.enqueue(session_id="s1", user_id="u1",
                    last_message_at=datetime.utcnow())
        db.commit()
        assert dao.reap_zombies() == 0


class TestCountByStatus:
    def test_mixed_counts(self, dao, db):
        # 2 pending, 1 processing, 1 done, 1 failed
        for i in range(5):
            row = PendingFactExtraction(
                session_id=f"s{i}",
                user_id="u1",
                last_message_at=datetime.utcnow(),
                status=["pending", "pending", "processing", "done", "failed"][i],
            )
            db.add(row)
        db.commit()

        counts = dao.count_by_status()
        assert counts["pending"] == 2
        assert counts["processing"] == 1
        assert counts["done"] == 1
        assert counts["failed"] == 1
