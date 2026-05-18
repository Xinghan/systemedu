"""spec 031 P2: ExerciseAttempt / StudentFact / PendingExtraction DAO tests."""

from __future__ import annotations

import uuid

import pytest


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    """tmp SQLite db, 多 user 隔离."""
    db_path = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    u_a = _db.create_user(f"a_{uuid.uuid4().hex[:6]}", "h")
    u_b = _db.create_user(f"b_{uuid.uuid4().hex[:6]}", "h")
    yield u_a.id, u_b.id
    _db.reset_engine_for_tests()


# -------- ExerciseAttempt -------------------------------------------------

def test_record_and_list_attempt(tmp_db):
    from systemedu.student.db import record_exercise_attempt, list_exercise_attempts
    ua, _ = tmp_db
    ea = record_exercise_attempt(
        ua, "slug-a", "M01",
        idea_id="ex_1", exercise_index=0, question="Q1",
        student_answer="A", correct=True,
    )
    assert ea["id"]
    items = list_exercise_attempts(ua, "slug-a", "M01")
    assert len(items) == 1
    assert items[0]["correct"] is True


def test_list_filter_wrong(tmp_db):
    from systemedu.student.db import record_exercise_attempt, list_exercise_attempts
    ua, _ = tmp_db
    record_exercise_attempt(ua, "slug-a", "M01", correct=True)
    record_exercise_attempt(ua, "slug-a", "M01", correct=False)
    record_exercise_attempt(ua, "slug-a", "M02", correct=False)
    assert len(list_exercise_attempts(ua, "slug-a")) == 3
    assert len(list_exercise_attempts(ua, "slug-a", "M01")) == 2
    assert len(list_exercise_attempts(ua, "slug-a", only_wrong=True)) == 2


def test_attempts_user_isolation(tmp_db):
    from systemedu.student.db import record_exercise_attempt, list_exercise_attempts
    ua, ub = tmp_db
    record_exercise_attempt(ua, "slug-a", "M01", correct=True)
    record_exercise_attempt(ub, "slug-a", "M01", correct=True)
    assert len(list_exercise_attempts(ua)) == 1
    assert len(list_exercise_attempts(ub)) == 1


# -------- StudentFact -----------------------------------------------------

def test_upsert_fact_new(tmp_db):
    from systemedu.student.db import upsert_fact, list_current_facts
    ua, _ = tmp_db
    f = upsert_fact(
        ua, "global", "interest", "outdoor_project", "true", confidence=0.9,
    )
    assert f["id"]
    facts = list_current_facts(ua)
    assert len(facts) == 1
    assert facts[0]["key"] == "outdoor_project"


def test_supersede_chain(tmp_db):
    from systemedu.student.db import upsert_fact, list_current_facts
    from systemedu.student import db as _db
    ua, _ = tmp_db

    f1 = upsert_fact(ua, "global", "skill_level", "python", "beginner")
    f2 = upsert_fact(ua, "global", "skill_level", "python", "intermediate")

    cur = list_current_facts(ua)
    assert len(cur) == 1
    assert cur[0]["id"] == f2["id"]
    assert cur[0]["value"] == "intermediate"

    with _db.get_session() as sess:
        old = sess.get(_db.StudentFact, f1["id"])
        assert old.valid_to is not None
        assert old.superseded_by == f2["id"]


def test_fact_user_isolation(tmp_db):
    from systemedu.student.db import upsert_fact, list_current_facts
    ua, ub = tmp_db
    upsert_fact(ua, "global", "interest", "x", "true")
    assert len(list_current_facts(ua)) == 1
    assert len(list_current_facts(ub)) == 0


def test_fact_filter_scope(tmp_db):
    from systemedu.student.db import upsert_fact, list_current_facts
    ua, _ = tmp_db
    upsert_fact(ua, "global", "interest", "x", "true")
    upsert_fact(ua, "project", "skill_level", "y", "z", library_slug="slug-a")
    assert len(list_current_facts(ua, scope="global")) == 1
    assert len(list_current_facts(ua, scope="project", library_slug="slug-a")) == 1


# -------- PendingExtraction -----------------------------------------------

def test_enqueue_and_list(tmp_db):
    from systemedu.student.db import enqueue_extraction, list_pending_extractions
    from systemedu.student import db as _db
    ua, _ = tmp_db
    with _db.get_session() as sess:
        s = _db.ChatSession(user_id=ua, library_slug="slug-a", title="t")
        sess.add(s); sess.commit(); sess.refresh(s)
        sid = s.id
    p = enqueue_extraction(sid, ua)
    assert p is not None
    pending = list_pending_extractions()
    assert len(pending) == 1


def test_enqueue_dedup(tmp_db):
    from systemedu.student.db import enqueue_extraction
    from systemedu.student import db as _db
    ua, _ = tmp_db
    with _db.get_session() as sess:
        s = _db.ChatSession(user_id=ua, library_slug="slug-a", title="t")
        sess.add(s); sess.commit(); sess.refresh(s)
        sid = s.id
    first = enqueue_extraction(sid, ua)
    second = enqueue_extraction(sid, ua)
    assert first is not None
    assert second is None


def test_mark_processing_done(tmp_db):
    from systemedu.student.db import (
        enqueue_extraction, mark_extraction_processing, mark_extraction_done,
        list_pending_extractions,
    )
    from systemedu.student import db as _db
    ua, _ = tmp_db
    with _db.get_session() as sess:
        s = _db.ChatSession(user_id=ua, library_slug="slug-a", title="t")
        sess.add(s); sess.commit(); sess.refresh(s)
        sid = s.id
    p = enqueue_extraction(sid, ua)
    mark_extraction_processing(p["id"])
    assert len(list_pending_extractions()) == 0
    mark_extraction_done(p["id"])
    with _db.get_session() as sess:
        row = sess.get(_db.PendingExtraction, p["id"])
        assert row.status == "done"
        assert row.processed_at is not None
        assert row.attempts == 1


def test_mark_failed_then_dead(tmp_db):
    from systemedu.student.db import (
        enqueue_extraction, mark_extraction_processing, mark_extraction_failed,
    )
    from systemedu.student import db as _db
    ua, _ = tmp_db
    with _db.get_session() as sess:
        s = _db.ChatSession(user_id=ua, library_slug="slug-a", title="t")
        sess.add(s); sess.commit(); sess.refresh(s)
        sid = s.id
    p = enqueue_extraction(sid, ua)
    mark_extraction_processing(p["id"])
    mark_extraction_failed(p["id"], "err1", max_attempts=3)
    with _db.get_session() as sess:
        assert sess.get(_db.PendingExtraction, p["id"]).status == "failed"
    mark_extraction_processing(p["id"])
    mark_extraction_failed(p["id"], "err2", max_attempts=3)
    with _db.get_session() as sess:
        assert sess.get(_db.PendingExtraction, p["id"]).status == "failed"
    mark_extraction_processing(p["id"])
    mark_extraction_failed(p["id"], "err3", max_attempts=3)
    with _db.get_session() as sess:
        assert sess.get(_db.PendingExtraction, p["id"]).status == "dead"


def test_pending_user_id_recorded(tmp_db):
    from systemedu.student.db import enqueue_extraction, list_pending_extractions
    from systemedu.student import db as _db
    ua, ub = tmp_db
    with _db.get_session() as sess:
        sa = _db.ChatSession(user_id=ua, library_slug="x", title="t")
        sb = _db.ChatSession(user_id=ub, library_slug="x", title="t")
        sess.add_all([sa, sb]); sess.commit()
        sess.refresh(sa); sess.refresh(sb)
        sida, sidb = sa.id, sb.id
    enqueue_extraction(sida, ua)
    enqueue_extraction(sidb, ub)
    rows = list_pending_extractions()
    assert {r["user_id"] for r in rows} == {ua, ub}
