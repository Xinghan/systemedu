"""Tests for the 9 tool implementations (T4.3a-i).

Each test wires a fresh in-memory SQLite DB via ToolContext.db so the
tools can query real tables without touching the production DB.
"""

from __future__ import annotations

import json
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.storage.db import (
    Base,
    Escalation,
    LessonContent,
    ProgressRecord,
    StudentFact,
)
from systemedu.tutor.tools.decorator import ToolContext, push_tool_context

from systemedu.tutor.tools.progress import (
    complete_node,
    get_knode_content,
    get_knode_prerequisites,
    get_progress,
)
from systemedu.tutor.tools.memory import search_student_facts
from systemedu.tutor.tools.practice import get_practice_exercises, grade_submission
from systemedu.tutor.tools.meta import escalate_to_human


@pytest.fixture()
def db_factory(tmp_path):
    """Return a session factory backed by an in-memory SQLite DB."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.fixture()
def ctx(db_factory):
    """ToolContext with db wired."""
    return ToolContext(
        user_id="u-test",
        session_id="s-1",
        project_name="mars",
        knode_id="3",
        db=db_factory,
    )


def _seed_progress(db_factory, user_id="u-test", project="mars"):
    db = db_factory()
    db.add(ProgressRecord(user_id=user_id, project_name=project, knode_id=0, status="passed", attempts=2, best_score=0.9))
    db.add(ProgressRecord(user_id=user_id, project_name=project, knode_id=1, status="active", attempts=1, best_score=0.4))
    db.add(ProgressRecord(user_id=user_id, project_name=project, knode_id=2, status="locked"))
    db.commit()
    db.close()


def _seed_lesson(db_factory, project="mars", knode_id=3):
    db = db_factory()
    cc = {
        "plan_markdown": "# Lesson Plan\n\nContent here.",
        "theories": [{"theory_id": "t1", "title": "Friction"}],
        "exercises": [
            {"exercise_id": "ex1", "question": "What is friction?", "type": "choice", "correct": "B"},
            {"exercise_id": "ex2", "question": "Calculate F", "type": "open", "correct": "10N"},
        ],
    }
    db.add(LessonContent(
        project_name=project,
        knode_id=knode_id,
        status="ready",
        course_content=json.dumps(cc),
    ))
    db.commit()
    db.close()


def _seed_facts(db_factory, user_id="u-test"):
    db = db_factory()
    db.add(StudentFact(
        user_id=user_id,
        category="interest",
        content="loves rockets",
        confidence=0.9,
        valid_from=datetime.utcnow(),
        project_name="mars",
    ))
    db.add(StudentFact(
        user_id=user_id,
        category="misconception",
        knode_id="3",
        content="thinks friction always opposes motion",
        confidence=0.7,
        valid_from=datetime.utcnow(),
        project_name="mars",
    ))
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# T4.3a get_progress
# ---------------------------------------------------------------------------
class TestGetProgress:
    async def test_returns_summary(self, ctx, db_factory):
        _seed_progress(db_factory)
        with push_tool_context(ctx):
            out = await get_progress.ainvoke({"project_name": "mars"})
        assert out["total_nodes"] == 3
        assert out["passed_nodes"] == 1
        assert out["pct"] == pytest.approx(33.3, abs=0.1)
        assert len(out["nodes"]) == 3

    async def test_empty_project(self, ctx):
        with push_tool_context(ctx):
            out = await get_progress.ainvoke({"project_name": "empty"})
        assert out["total_nodes"] == 0
        assert out["pct"] == 0

    async def test_user_id_from_context(self, ctx, db_factory):
        _seed_progress(db_factory, user_id="other")
        with push_tool_context(ctx):
            out = await get_progress.ainvoke({"project_name": "mars"})
        assert out["total_nodes"] == 0


# ---------------------------------------------------------------------------
# T4.3b complete_node (confirm=True)
# ---------------------------------------------------------------------------
class TestCompleteNode:
    async def test_first_call_returns_pending(self, ctx, db_factory):
        """confirm=True tool returns pending on first call."""
        with push_tool_context(ctx):
            out = await complete_node.ainvoke({"project_name": "mars", "knode_id": "3"})
        assert out["action"] == "pending_confirm"

    async def test_approved_call_marks_passed(self, ctx, db_factory):
        approved_ctx = ToolContext(
            user_id="u-test", session_id="s-1", approved=True, db=db_factory
        )
        with push_tool_context(approved_ctx):
            out = await complete_node.ainvoke({"project_name": "mars", "knode_id": "3"})
        assert out["ok"] is True
        assert out["status"] == "passed"
        # Verify DB
        db = db_factory()
        row = db.query(ProgressRecord).filter(
            ProgressRecord.user_id == "u-test",
            ProgressRecord.knode_id == 3,
        ).one()
        assert row.status == "passed"
        db.close()

    async def test_re_complete_increments_attempts(self, ctx, db_factory):
        _seed_progress(db_factory)
        approved_ctx = ToolContext(
            user_id="u-test", session_id="s-1", approved=True, db=db_factory
        )
        with push_tool_context(approved_ctx):
            await complete_node.ainvoke({"project_name": "mars", "knode_id": "1"})
        db = db_factory()
        row = db.query(ProgressRecord).filter(
            ProgressRecord.knode_id == 1,
            ProgressRecord.user_id == "u-test",
        ).one()
        assert row.attempts == 2
        db.close()


# ---------------------------------------------------------------------------
# T4.3c get_knode_prerequisites
# ---------------------------------------------------------------------------
class TestGetKnodePrerequisites:
    async def test_returns_progress_map(self, ctx, db_factory):
        _seed_progress(db_factory)
        with push_tool_context(ctx):
            out = await get_knode_prerequisites.ainvoke(
                {"project_name": "mars", "knode_id": "1"}
            )
        assert out["current_status"] == "active"
        assert "0" in out["all_progress"]

    async def test_missing_knode_returns_locked(self, ctx, db_factory):
        with push_tool_context(ctx):
            out = await get_knode_prerequisites.ainvoke(
                {"project_name": "mars", "knode_id": "99"}
            )
        assert out["current_status"] == "locked"


# ---------------------------------------------------------------------------
# T4.3d get_knode_content
# ---------------------------------------------------------------------------
class TestGetKnodeContent:
    async def test_returns_plan_and_theories(self, ctx, db_factory):
        _seed_lesson(db_factory)
        with push_tool_context(ctx):
            out = await get_knode_content.ainvoke(
                {"project_name": "mars", "knode_id": "3"}
            )
        assert out["found"] is True
        assert "Lesson Plan" in out["plan_markdown"]
        assert len(out["theories"]) == 1

    async def test_not_found(self, ctx):
        with push_tool_context(ctx):
            out = await get_knode_content.ainvoke(
                {"project_name": "mars", "knode_id": "999"}
            )
        assert out["found"] is False


# ---------------------------------------------------------------------------
# T4.3e search_student_facts
# ---------------------------------------------------------------------------
class TestSearchStudentFacts:
    async def test_returns_facts(self, ctx, db_factory):
        _seed_facts(db_factory)
        with push_tool_context(ctx):
            out = await search_student_facts.ainvoke({})
        assert out["count"] == 2

    async def test_filter_by_category(self, ctx, db_factory):
        _seed_facts(db_factory)
        with push_tool_context(ctx):
            out = await search_student_facts.ainvoke({"category": "interest"})
        assert out["count"] == 1
        assert out["facts"][0]["content"] == "loves rockets"

    async def test_filter_by_knode(self, ctx, db_factory):
        _seed_facts(db_factory)
        with push_tool_context(ctx):
            out = await search_student_facts.ainvoke({"knode_id": "3"})
        assert out["count"] == 1
        assert "friction" in out["facts"][0]["content"]


# ---------------------------------------------------------------------------
# T4.3g get_practice_exercises
# ---------------------------------------------------------------------------
class TestGetPracticeExercises:
    async def test_strips_correct_field(self, ctx, db_factory):
        _seed_lesson(db_factory)
        with push_tool_context(ctx):
            out = await get_practice_exercises.ainvoke(
                {"project_name": "mars", "knode_id": "3"}
            )
        assert out["found"] is True
        assert len(out["exercises"]) == 2
        for ex in out["exercises"]:
            assert "correct" not in ex
            assert "answer" not in ex

    async def test_not_found(self, ctx):
        with push_tool_context(ctx):
            out = await get_practice_exercises.ainvoke(
                {"project_name": "mars", "knode_id": "999"}
            )
        assert out["found"] is False


# ---------------------------------------------------------------------------
# T4.3h grade_submission
# ---------------------------------------------------------------------------
class TestGradeSubmission:
    async def test_correct_answer(self, ctx, db_factory):
        _seed_lesson(db_factory)
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars",
                "knode_id": "3",
                "exercise_id": "ex1",
                "student_answer": "B",
            })
        assert out["graded"] is True
        assert out["is_correct"] is True

    async def test_wrong_answer(self, ctx, db_factory):
        _seed_lesson(db_factory)
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars",
                "knode_id": "3",
                "exercise_id": "ex1",
                "student_answer": "A",
            })
        assert out["is_correct"] is False
        assert out["correct_answer"] == "B"

    async def test_exercise_not_found(self, ctx, db_factory):
        _seed_lesson(db_factory)
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars",
                "knode_id": "3",
                "exercise_id": "ex999",
                "student_answer": "X",
            })
        assert out["graded"] is False


# ---------------------------------------------------------------------------
# T4.3i escalate_to_human
# ---------------------------------------------------------------------------
class TestEscalateToHuman:
    async def test_creates_escalation_row(self, ctx, db_factory):
        with push_tool_context(ctx):
            out = await escalate_to_human.ainvoke({
                "reason": "student seems distressed",
                "severity": "urgent",
            })
        assert out["escalated"] is True
        assert out["severity"] == "urgent"
        db = db_factory()
        rows = db.query(Escalation).all()
        assert len(rows) == 1
        assert rows[0].user_id == "u-test"
        assert rows[0].reason == "student seems distressed"
        db.close()

    async def test_default_severity(self, ctx, db_factory):
        with push_tool_context(ctx):
            out = await escalate_to_human.ainvoke({"reason": "confused"})
        assert out["severity"] == "warn"
