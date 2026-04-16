"""Tests for tutor memory schema (spec 014 T1.3)."""

from datetime import datetime

import pytest
import sqlalchemy as sa
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from systemedu.storage.db import (
    Base,
    ChatSession,
    Escalation,
    PendingFactExtraction,
    StudentFact,
    ToolCallLog,
    _migrate_schema,
)


@pytest.fixture
def fresh_engine(tmp_path):
    """Fresh SQLite engine + all tables created."""
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def fresh_session(fresh_engine):
    return sessionmaker(bind=fresh_engine)()


class TestTutorTablesExist:
    """4 new tables must be created by Base.metadata.create_all()."""

    def test_student_facts_table_exists(self, fresh_engine):
        assert inspect(fresh_engine).has_table("student_facts")

    def test_pending_fact_extraction_table_exists(self, fresh_engine):
        assert inspect(fresh_engine).has_table("pending_fact_extraction")

    def test_tool_call_log_table_exists(self, fresh_engine):
        assert inspect(fresh_engine).has_table("tool_call_log")

    def test_escalations_table_exists(self, fresh_engine):
        assert inspect(fresh_engine).has_table("escalations")


class TestStudentFactIndexes:
    """StudentFact must have 3 composite indexes per design §6.1."""

    def test_indexes_created(self, fresh_engine):
        indexes = {idx["name"] for idx in inspect(fresh_engine).get_indexes("student_facts")}
        assert "ix_sf_user_current" in indexes
        assert "ix_sf_user_knode_category" in indexes
        assert "ix_sf_project_current" in indexes


class TestChatSessionExtensions:
    """Extended columns on existing sessions table."""

    def test_new_columns_present_on_fresh_db(self, fresh_engine):
        cols = {c["name"] for c in inspect(fresh_engine).get_columns("sessions")}
        assert "user_id" in cols
        assert "knode_id" in cols
        assert "active_skill" in cols
        assert "skill_turn_count" in cols

    def test_legacy_columns_preserved(self, fresh_engine):
        cols = {c["name"] for c in inspect(fresh_engine).get_columns("sessions")}
        assert "id" in cols
        assert "agent_name" in cols
        assert "project_name" in cols


class TestMigrateSchemaBackwardCompat:
    """_migrate_schema must add new columns to a pre-existing sessions table."""

    def test_alter_adds_tutor_columns(self, tmp_path):
        db_path = tmp_path / "legacy.db"
        engine = create_engine(f"sqlite:///{db_path}")

        # Simulate a pre-spec-014 sessions table (minimal columns only).
        with engine.connect() as conn:
            conn.execute(sa.text("""
                CREATE TABLE sessions (
                    id VARCHAR(36) PRIMARY KEY,
                    agent_name VARCHAR(100) DEFAULT 'default',
                    project_name VARCHAR(200),
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

        # Sanity check: new tutor columns missing before migration.
        pre_cols = {c["name"] for c in inspect(engine).get_columns("sessions")}
        assert "user_id" not in pre_cols
        assert "active_skill" not in pre_cols

        _migrate_schema(engine)

        post_cols = {c["name"] for c in inspect(engine).get_columns("sessions")}
        assert "user_id" in post_cols
        assert "knode_id" in post_cols
        assert "active_skill" in post_cols
        assert "skill_turn_count" in post_cols


class TestStudentFactCRUD:
    """Smoke test: insert/query StudentFact with supersede chain."""

    def test_insert_and_query(self, fresh_session):
        fact = StudentFact(
            user_id="user-1",
            project_name="mars-rover",
            knode_id="5",
            category="knowledge",
            content="理解摩擦力方向",
            confidence=0.85,
            fact_metadata={"mastery_level": "apply", "evidence_msg_ids": [42]},
        )
        fresh_session.add(fact)
        fresh_session.commit()

        loaded = fresh_session.query(StudentFact).filter_by(user_id="user-1").one()
        assert loaded.content == "理解摩擦力方向"
        assert loaded.confidence == 0.85
        assert loaded.fact_metadata["mastery_level"] == "apply"
        assert loaded.fact_metadata["evidence_msg_ids"] == [42]
        assert loaded.valid_to is None  # current fact

    def test_supersede_chain(self, fresh_session):
        old = StudentFact(
            user_id="u1",
            category="knowledge",
            content="旧事实",
            valid_from=datetime(2026, 1, 1),
            valid_to=datetime(2026, 4, 1),
        )
        fresh_session.add(old)
        fresh_session.commit()

        new = StudentFact(
            user_id="u1",
            category="knowledge",
            content="新事实",
            valid_from=datetime(2026, 4, 1),
        )
        fresh_session.add(new)
        fresh_session.commit()

        old.superseded_by = new.id
        fresh_session.commit()

        fresh_session.refresh(old)
        assert old.superseded_by == new.id
        assert old.valid_to is not None

    def test_current_facts_filter(self, fresh_session):
        """Query pattern: current facts have valid_to IS NULL."""
        fresh_session.add_all([
            StudentFact(user_id="u1", category="interest", content="current",
                        valid_from=datetime.utcnow()),
            StudentFact(user_id="u1", category="interest", content="superseded",
                        valid_from=datetime(2026, 1, 1),
                        valid_to=datetime(2026, 4, 1)),
        ])
        fresh_session.commit()

        current = fresh_session.query(StudentFact).filter_by(
            user_id="u1", valid_to=None).all()
        assert len(current) == 1
        assert current[0].content == "current"


class TestPendingFactExtractionCRUD:
    def test_unique_session_id(self, fresh_session):
        first = PendingFactExtraction(
            session_id="sess-1",
            user_id="u1",
            last_message_at=datetime.utcnow(),
        )
        fresh_session.add(first)
        fresh_session.commit()

        duplicate = PendingFactExtraction(
            session_id="sess-1",
            user_id="u1",
            last_message_at=datetime.utcnow(),
        )
        fresh_session.add(duplicate)
        with pytest.raises(Exception):  # IntegrityError
            fresh_session.commit()

    def test_status_transitions(self, fresh_session):
        pending = PendingFactExtraction(
            session_id="sess-2",
            user_id="u1",
            last_message_at=datetime.utcnow(),
        )
        fresh_session.add(pending)
        fresh_session.commit()

        assert pending.status == "pending"
        assert pending.retry_count == 0

        pending.status = "processing"
        pending.started_at = datetime.utcnow()
        fresh_session.commit()

        fresh_session.refresh(pending)
        assert pending.status == "processing"


class TestToolCallLogCRUD:
    def test_insert_with_json_args(self, fresh_session):
        log = ToolCallLog(
            user_id="u1",
            session_id="sess-1",
            active_skill="socratic",
            tool_name="recall_knowledge_tree",
            args_json={"project": "mars", "knode_id": 3},
            result_json={"status": "ok", "count": 5},
            approved=True,
            latency_ms=120,
        )
        fresh_session.add(log)
        fresh_session.commit()

        loaded = fresh_session.query(ToolCallLog).filter_by(user_id="u1").one()
        assert loaded.args_json["knode_id"] == 3
        assert loaded.result_json["count"] == 5
        assert loaded.approved is True


class TestEscalationCRUD:
    def test_insert_defaults(self, fresh_session):
        esc = Escalation(
            user_id="u1",
            session_id="sess-1",
            reason="敏感模式: ['自杀']",
            severity="urgent",
        )
        fresh_session.add(esc)
        fresh_session.commit()

        loaded = fresh_session.query(Escalation).filter_by(user_id="u1").one()
        assert loaded.severity == "urgent"
        assert loaded.status == "open"
        assert loaded.handled_by is None
