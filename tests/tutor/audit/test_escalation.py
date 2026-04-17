"""Tests for Escalation DAO (T4.7)."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.storage.db import Base, Escalation
from systemedu.tutor.audit.escalation import EscalationDAO


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    yield session
    session.close()


@pytest.fixture()
def dao(db_session):
    return EscalationDAO(db_session)


class TestOpenEscalation:
    def test_basic_open(self, dao):
        row = dao.open_escalation(
            user_id="u1",
            session_id="s1",
            reason="sensitive pattern: 自杀",
            severity="urgent",
        )
        assert row.id is not None
        assert row.user_id == "u1"
        assert row.session_id == "s1"
        assert row.severity == "urgent"
        assert row.status == "open"
        assert row.handled_by is None

    def test_default_severity_is_warn(self, dao):
        row = dao.open_escalation(user_id="u1", reason="test")
        assert row.severity == "warn"


class TestListOpen:
    def test_lists_open_only(self, dao, db_session):
        dao.open_escalation(user_id="u1", reason="a")
        dao.open_escalation(user_id="u1", reason="b")
        handled = dao.open_escalation(user_id="u1", reason="c")
        dao.handle(handled.id, handled_by="admin")

        open_rows = dao.list_open(user_id="u1")
        assert len(open_rows) == 2
        assert all(r.status == "open" for r in open_rows)

    def test_filter_by_user(self, dao):
        dao.open_escalation(user_id="u1", reason="a")
        dao.open_escalation(user_id="u2", reason="b")
        assert len(dao.list_open(user_id="u1")) == 1
        assert len(dao.list_open(user_id="u2")) == 1

    def test_list_all_open(self, dao):
        dao.open_escalation(user_id="u1", reason="a")
        dao.open_escalation(user_id="u2", reason="b")
        assert len(dao.list_open()) == 2


class TestHandle:
    def test_handle_sets_fields(self, dao):
        row = dao.open_escalation(user_id="u1", reason="test")
        handled = dao.handle(row.id, handled_by="admin-joe")
        assert handled is not None
        assert handled.status == "handled"
        assert handled.handled_by == "admin-joe"
        assert handled.handled_at is not None

    def test_handle_nonexistent_returns_none(self, dao):
        assert dao.handle(999, handled_by="admin") is None
