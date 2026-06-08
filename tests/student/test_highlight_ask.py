"""高亮深入学习 — source 字段链路测试 (spec 2026-06-08)。"""
from __future__ import annotations

import uuid


def test_payload_source_default_chat():
    from systemedu.student.chat.payload import ChatPayload
    assert ChatPayload(message="hi").source == "chat"


def test_payload_source_highlight_ask():
    from systemedu.student.chat.payload import ChatPayload
    assert ChatPayload(message="解释这段", source="highlight_ask").source == "highlight_ask"


def test_append_message_persists_source(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDENT_DB_PATH", str(tmp_path / "s.db"))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    from systemedu.student.chat import session as sess_store
    u = _db.create_user(f"u_{uuid.uuid4().hex[:6]}", "h")
    s = sess_store.create_session(user_id=u.id, library_slug="eeg", module_id="M01", title="t")
    sid = s["id"]
    sess_store.append_message(
        session_id=sid, user_id=u.id, library_slug="eeg", module_id="M01",
        role="user", content="解释这段", source="highlight_ask",
    )
    with _db.get_session() as db:
        rows = db.query(_db.ChatMessage).filter_by(session_id=sid).all()
        assert len(rows) == 1
        assert rows[0].source == "highlight_ask"
