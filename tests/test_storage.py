"""Tests for local SQLite storage."""

import pytest

from systemedu.storage.db import (
    Base,
    ChatMessage,
    ChatSession,
    LocalProject,
    get_engine,
    get_session,
    reset_db,
)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Use a temp database for tests."""
    reset_db()
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
    yield
    reset_db()


class TestDatabase:
    def test_create_session(self):
        db = get_session()
        session = ChatSession(id="test-123", agent_name="tutor")
        db.add(session)
        db.commit()

        found = db.query(ChatSession).filter_by(id="test-123").first()
        assert found is not None
        assert found.agent_name == "tutor"
        db.close()

    def test_create_message(self):
        db = get_session()
        session = ChatSession(id="test-456", agent_name="default")
        db.add(session)
        db.commit()

        msg = ChatMessage(session_id="test-456", role="user", content="hello")
        db.add(msg)
        db.commit()

        messages = db.query(ChatMessage).filter_by(session_id="test-456").all()
        assert len(messages) == 1
        assert messages[0].content == "hello"
        db.close()

    def test_session_message_relationship(self):
        db = get_session()
        session = ChatSession(id="test-789", agent_name="default")
        db.add(session)
        db.commit()

        db.add(ChatMessage(session_id="test-789", role="user", content="hi"))
        db.add(ChatMessage(session_id="test-789", role="assistant", content="hello"))
        db.commit()

        found = db.query(ChatSession).filter_by(id="test-789").first()
        assert len(found.messages) == 2
        db.close()

    def test_create_local_project(self):
        db = get_session()
        project = LocalProject(
            name="test-project",
            title="Test Project",
            path="/tmp/test",
        )
        db.add(project)
        db.commit()

        found = db.query(LocalProject).filter_by(name="test-project").first()
        assert found.title == "Test Project"
        db.close()
