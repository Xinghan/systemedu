"""spec 028 P1.10: SessionManager CRUD tests (in-process, tmp db)."""

from __future__ import annotations

import os
import uuid

import pytest

# fixture: 每 test 独立 tmp student.db


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    # 重置 engine cache
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    # 建一个 user (chat session 需要 user_id FK)
    user = _db.create_user(f"u_{uuid.uuid4().hex[:8]}", "fakehash")
    yield user
    _db.reset_engine_for_tests()


def test_create_and_list(tmp_db):
    from systemedu.student.chat import session as ss
    user_id = tmp_db.id
    s = ss.create_session(user_id, "slug-a", "M01", "first")
    assert s["title"] == "first"
    sessions = ss.list_sessions(user_id)
    assert len(sessions) == 1
    assert sessions[0]["id"] == s["id"]


def test_list_filter_by_slug(tmp_db):
    from systemedu.student.chat import session as ss
    user_id = tmp_db.id
    ss.create_session(user_id, "slug-a", "M01", "in a")
    ss.create_session(user_id, "slug-b", "M01", "in b")
    assert len(ss.list_sessions(user_id, "slug-a")) == 1
    assert len(ss.list_sessions(user_id, "slug-b")) == 1
    assert len(ss.list_sessions(user_id)) == 2


def test_append_message_and_fetch(tmp_db):
    from systemedu.student.chat import session as ss
    user_id = tmp_db.id
    s = ss.create_session(user_id, "slug-a", "M01", "t")
    ss.append_message(s["id"], user_id, "slug-a", "M01", "user", "hi")
    ss.append_message(s["id"], user_id, "slug-a", "M01", "assistant", "hi back", skill="direct-instruction")
    msgs = ss.get_messages(s["id"])
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["skill"] == "direct-instruction"


def test_get_for_other_user_returns_none(tmp_db):
    from systemedu.student.chat import session as ss
    from systemedu.student import db as _db
    user_a = tmp_db.id
    user_b = _db.create_user("other_user", "hash").id
    s = ss.create_session(user_a, "slug-a", "M01", "private")
    assert ss.get_session_for_user(s["id"], user_b) is None
    assert ss.get_session_for_user(s["id"], user_a) is not None


def test_delete_cascades_messages(tmp_db):
    from systemedu.student.chat import session as ss
    user_id = tmp_db.id
    s = ss.create_session(user_id, "slug-a", "M01", "to-del")
    ss.append_message(s["id"], user_id, "slug-a", "M01", "user", "hi")
    assert len(ss.get_messages(s["id"])) == 1
    ok = ss.delete_session(s["id"], user_id)
    assert ok
    assert len(ss.get_messages(s["id"])) == 0
    assert ss.get_session_for_user(s["id"], user_id) is None


def test_delete_other_user_rejected(tmp_db):
    from systemedu.student.chat import session as ss
    from systemedu.student import db as _db
    user_a = tmp_db.id
    user_b = _db.create_user("intruder", "hash").id
    s = ss.create_session(user_a, "slug-a", "M01", "private")
    assert ss.delete_session(s["id"], user_b) is False
    # 还在
    assert ss.get_session_for_user(s["id"], user_a) is not None


def test_append_updates_session_skill_and_updated_at(tmp_db):
    from systemedu.student.chat import session as ss
    user_id = tmp_db.id
    s = ss.create_session(user_id, "slug-a", "M01", "t")
    before_updated = s["updated_at"]
    ss.append_message(s["id"], user_id, "slug-a", "M01", "assistant", "x", skill="scaffolding")
    refreshed = ss.get_session_for_user(s["id"], user_id)
    assert refreshed["active_skill"] == "scaffolding"
    assert refreshed["updated_at"] >= before_updated


def test_update_title(tmp_db):
    from systemedu.student.chat import session as ss
    user_id = tmp_db.id
    s = ss.create_session(user_id, "slug-a", "M01", "old")
    ok = ss.update_session_title(s["id"], user_id, "new")
    assert ok
    assert ss.get_session_for_user(s["id"], user_id)["title"] == "new"
