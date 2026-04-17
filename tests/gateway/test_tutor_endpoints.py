"""Tests for tutor helper endpoints (T5.3).

Covers:
- POST /api/tutor/session/end → enqueue fact extraction
- GET /api/tutor/facts → list student facts
- GET /api/tutor/session/:id/history → tool call log
- DELETE /api/tutor/session/:id → checkpoint clear
- GET /api/tutor/escalations → list open escalations
"""

from __future__ import annotations

from datetime import datetime

import pytest

from systemedu.storage.db import (
    Base,
    Escalation,
    PendingFactExtraction,
    StudentFact,
    ToolCallLog,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def db_session(tmp_path):
    """Provide a fresh SQLite session with all tutor tables."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


# ---------------------------------------------------------------------------
# POST /api/tutor/session/end
# ---------------------------------------------------------------------------


class TestSessionEnd:
    def test_enqueue_creates_row(self, db_session):
        from systemedu.tutor.memory.pending_extraction import PendingFactExtractionDAO

        dao = PendingFactExtractionDAO(db_session)
        row = dao.enqueue(
            session_id="s-100",
            user_id="u1",
            last_message_at=datetime.utcnow(),
        )
        assert row.session_id == "s-100"
        assert row.status == "pending"

    def test_enqueue_idempotent(self, db_session):
        from systemedu.tutor.memory.pending_extraction import PendingFactExtractionDAO

        dao = PendingFactExtractionDAO(db_session)
        row1 = dao.enqueue(
            session_id="s-100",
            user_id="u1",
            last_message_at=datetime.utcnow(),
        )
        row2 = dao.enqueue(
            session_id="s-100",
            user_id="u1",
            last_message_at=datetime.utcnow(),
        )
        # Same row, updated
        count = db_session.query(PendingFactExtraction).count()
        assert count == 1


# ---------------------------------------------------------------------------
# GET /api/tutor/facts
# ---------------------------------------------------------------------------


class TestFacts:
    def test_list_facts_empty(self, db_session):
        from systemedu.tutor.memory.student_fact import StudentFactDAO

        dao = StudentFactDAO(db_session)
        facts = dao.list_by_user("u1")
        assert facts == []

    def test_list_facts_returns_current_only(self, db_session):
        from systemedu.tutor.memory.student_fact import StudentFactDAO

        # Add two facts: one current, one superseded
        f1 = StudentFact(
            user_id="u1",
            project_name="mars",
            knode_id="1",
            category="misconception",
            content="thinks Mars has no gravity",
            confidence=0.8,
            valid_from=datetime.utcnow(),
            valid_to=None,
        )
        f2 = StudentFact(
            user_id="u1",
            project_name="mars",
            knode_id="1",
            category="mastery",
            content="old understanding",
            confidence=0.5,
            valid_from=datetime.utcnow(),
            valid_to=datetime.utcnow(),  # superseded
        )
        db_session.add_all([f1, f2])
        db_session.commit()

        dao = StudentFactDAO(db_session)
        facts = dao.list_by_user("u1", current_only=True)
        assert len(facts) == 1
        assert facts[0].content == "thinks Mars has no gravity"

    def test_list_facts_filter_by_project(self, db_session):
        from systemedu.tutor.memory.student_fact import StudentFactDAO

        f1 = StudentFact(
            user_id="u1", project_name="mars", knode_id="1",
            category="mastery", content="knows terrain types",
            confidence=1.0, valid_from=datetime.utcnow(),
        )
        f2 = StudentFact(
            user_id="u1", project_name="rocket", knode_id="2",
            category="mastery", content="knows thrust",
            confidence=1.0, valid_from=datetime.utcnow(),
        )
        db_session.add_all([f1, f2])
        db_session.commit()

        dao = StudentFactDAO(db_session)
        mars_facts = dao.list_by_user("u1", project_name="mars")
        assert len(mars_facts) == 1
        assert mars_facts[0].project_name == "mars"

    def test_list_facts_filter_by_category(self, db_session):
        from systemedu.tutor.memory.student_fact import StudentFactDAO

        f1 = StudentFact(
            user_id="u1", project_name="mars", knode_id="1",
            category="misconception", content="wrong about gravity",
            confidence=0.9, valid_from=datetime.utcnow(),
        )
        f2 = StudentFact(
            user_id="u1", project_name="mars", knode_id="1",
            category="mastery", content="knows terrain",
            confidence=1.0, valid_from=datetime.utcnow(),
        )
        db_session.add_all([f1, f2])
        db_session.commit()

        dao = StudentFactDAO(db_session)
        mis = dao.list_by_user("u1", category="misconception")
        assert len(mis) == 1
        assert mis[0].category == "misconception"


# ---------------------------------------------------------------------------
# GET /api/tutor/session/:id/history
# ---------------------------------------------------------------------------


class TestSessionHistory:
    def test_list_by_session(self, db_session):
        from systemedu.tutor.audit.tool_call_log import ToolCallLogDAO

        dao = ToolCallLogDAO(db_session)
        dao.log_call(
            user_id="u1",
            session_id="s-1",
            tool_name="get_progress",
            args={"project_name": "mars"},
            result={"status": "available"},
        )
        dao.log_call(
            user_id="u1",
            session_id="s-1",
            tool_name="complete_node",
            args={"project_name": "mars", "knode_id": "3"},
            result="done",
            approved=True,
        )
        dao.log_call(
            user_id="u1",
            session_id="s-other",
            tool_name="get_progress",
        )

        rows = dao.list_by_session("s-1")
        assert len(rows) == 2
        assert rows[0].tool_name == "get_progress"
        assert rows[1].tool_name == "complete_node"

    def test_list_empty_session(self, db_session):
        from systemedu.tutor.audit.tool_call_log import ToolCallLogDAO

        dao = ToolCallLogDAO(db_session)
        rows = dao.list_by_session("nonexistent")
        assert rows == []


# ---------------------------------------------------------------------------
# GET /api/tutor/escalations
# ---------------------------------------------------------------------------


class TestEscalations:
    def test_list_open(self, db_session):
        from systemedu.tutor.audit.escalation import EscalationDAO

        dao = EscalationDAO(db_session)
        dao.open_escalation(
            user_id="u1", session_id="s-1",
            reason="self-harm concern", severity="urgent",
        )
        dao.open_escalation(
            user_id="u2", session_id="s-2",
            reason="off-topic", severity="warn",
        )

        rows = dao.list_open()
        assert len(rows) == 2

    def test_list_open_filter_by_user(self, db_session):
        from systemedu.tutor.audit.escalation import EscalationDAO

        dao = EscalationDAO(db_session)
        dao.open_escalation(
            user_id="u1", reason="concern1", severity="urgent",
        )
        dao.open_escalation(
            user_id="u2", reason="concern2", severity="warn",
        )

        rows = dao.list_open(user_id="u1")
        assert len(rows) == 1
        assert rows[0].user_id == "u1"

    def test_handled_not_in_open(self, db_session):
        from systemedu.tutor.audit.escalation import EscalationDAO

        dao = EscalationDAO(db_session)
        esc = dao.open_escalation(
            user_id="u1", reason="test", severity="warn",
        )
        dao.handle(esc.id, handled_by="admin")

        rows = dao.list_open()
        assert len(rows) == 0


# ---------------------------------------------------------------------------
# DELETE /api/tutor/session/:id (unit-level)
# ---------------------------------------------------------------------------


class TestSessionDelete:
    @pytest.mark.asyncio
    async def test_delete_returns_success_when_graph_unavailable(self):
        """Delete endpoint should return success even when graph is unavailable."""
        from unittest.mock import MagicMock, patch

        from systemedu.gateway.server import api_tutor_session_delete

        request = MagicMock()
        request.path_params = {"id": "test-thread-123"}

        # Patch the tutor_runner import to raise ImportError
        with patch.dict("sys.modules", {"systemedu.gateway.tutor_runner": None}):
            resp = await api_tutor_session_delete(request)
            assert resp.status_code == 200
            import json
            body = json.loads(resp.body)
            assert body["status"] == "deleted"
            assert body["session_id"] == "test-thread-123"

    @pytest.mark.asyncio
    async def test_delete_returns_success_with_graph(self):
        """Delete endpoint should return success when graph is available."""
        from unittest.mock import AsyncMock, MagicMock, patch

        from systemedu.gateway.server import api_tutor_session_delete

        request = MagicMock()
        request.path_params = {"id": "test-thread-456"}

        mock_cp = AsyncMock()
        mock_cp.aget_tuple.return_value = MagicMock()  # existing checkpoint

        mock_graph = AsyncMock()
        mock_graph.checkpointer = mock_cp

        mock_runner = MagicMock()
        mock_runner._get_graph = AsyncMock(return_value=mock_graph)

        with patch.dict("sys.modules", {"systemedu.gateway.tutor_runner": mock_runner}):
            resp = await api_tutor_session_delete(request)
            assert resp.status_code == 200
            import json
            body = json.loads(resp.body)
            assert body["status"] == "deleted"
