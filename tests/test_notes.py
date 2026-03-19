"""Tests for UserNote model and note API routes."""

import pytest

from systemedu.storage.db import UserNote, get_engine, get_session, reset_db
from sqlalchemy import text


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Use a temp database for tests."""
    reset_db()
    db_file = tmp_path / "test_notes.db"
    monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
    yield
    reset_db()


class TestUserNoteModel:
    def test_upsert_note_creates_row(self):
        """Saving a new note creates a DB row."""
        db = get_session()
        note = UserNote(
            user_id="default",
            project_name="test-project",
            knode_id=0,
            content="# Hello\nThis is a test note.",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        found = db.query(UserNote).filter_by(
            user_id="default", project_name="test-project", knode_id=0
        ).first()
        assert found is not None
        assert found.content == "# Hello\nThis is a test note."
        db.close()

    def test_upsert_note_updates_existing(self):
        """Saving again for the same key updates content."""
        db = get_session()
        note = UserNote(
            user_id="default",
            project_name="test-project",
            knode_id=1,
            content="initial content",
        )
        db.add(note)
        db.commit()

        found = db.query(UserNote).filter_by(
            user_id="default", project_name="test-project", knode_id=1
        ).first()
        found.content = "updated content"
        db.commit()

        refetched = db.query(UserNote).filter_by(
            user_id="default", project_name="test-project", knode_id=1
        ).first()
        assert refetched.content == "updated content"
        db.close()

    def test_get_note_returns_empty_for_new_node(self):
        """Querying a non-existent note returns None."""
        db = get_session()
        found = db.query(UserNote).filter_by(
            user_id="default", project_name="test-project", knode_id=99
        ).first()
        assert found is None
        db.close()

    def test_get_all_notes_returns_only_nonempty(self):
        """getAllNotes filter returns only rows with non-empty content."""
        db = get_session()
        db.add(UserNote(user_id="default", project_name="proj", knode_id=0, content="some note"))
        db.add(UserNote(user_id="default", project_name="proj", knode_id=1, content=""))
        db.add(UserNote(user_id="default", project_name="proj", knode_id=2, content="another note"))
        db.commit()

        nonempty = db.query(UserNote).filter(
            UserNote.project_name == "proj",
            UserNote.user_id == "default",
            UserNote.content != "",
        ).all()

        assert len(nonempty) == 2
        ids = {n.knode_id for n in nonempty}
        assert ids == {0, 2}
        db.close()
