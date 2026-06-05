"""L1 tools 缺口补测 (memory / practice / progress 各未覆盖分支)。

复用 test_tool_impls.py 的 db_factory / push_tool_context 模式，专门覆盖：
- db is None 分支
- search_memory (mem0 适配器各路径)
- practice 的 quiz_data fallback / 判分逻辑
- progress.get_knode_content 成功路径 (course_content / 退化到 concept)
"""

from __future__ import annotations

import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.core.storage.db import Base, LessonContent
from systemedu.core.tutor.tools.decorator import ToolContext, push_tool_context
from systemedu.core.tutor.tools.memory import search_memory, search_student_facts
from systemedu.core.tutor.tools.practice import get_practice_exercises, grade_submission
from systemedu.core.tutor.tools import progress


@pytest.fixture()
def db_factory():
    """In-memory SQLite session factory."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.fixture()
def ctx(db_factory):
    return ToolContext(
        user_id="u-test",
        session_id="s-1",
        project_name="mars",
        knode_id="3",
        db=db_factory,
    )


@pytest.fixture()
def ctx_no_db():
    """ToolContext without a db wired (db is None)."""
    return ToolContext(
        user_id="u-test",
        session_id="s-1",
        project_name="mars",
        knode_id="3",
        db=None,
    )


def _seed_quiz_only(db_factory, project="mars", knode_id=7):
    """LessonContent with empty course_content but a quiz_data list."""
    db = db_factory()
    quiz = [
        {"exercise_id": "q1", "question": "2+2?", "correct": "4", "answer": "4"},
        {"exercise_id": "q2", "question": "Capital of France?", "correct": "Paris"},
    ]
    db.add(LessonContent(
        project_name=project,
        knode_id=knode_id,
        status="ready",
        course_content="",
        quiz_data=json.dumps(quiz),
    ))
    db.commit()
    db.close()


def _seed_course_content(db_factory, project="mars", knode_id=8):
    """LessonContent with course_content carrying plan_markdown + theories + exercises."""
    db = db_factory()
    cc = {
        "plan_markdown": "# Plan\n\nLearn friction.",
        "theories": [{"theory_id": "t1", "title": "Friction"}],
        "exercises": [
            {"exercise_id": "ex1", "question": "What is friction?", "correct": "B"},
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


def _seed_malformed_json(db_factory, project="mars", knode_id=10):
    """LessonContent with non-JSON course_content AND quiz_data."""
    db = db_factory()
    db.add(LessonContent(
        project_name=project,
        knode_id=knode_id,
        status="ready",
        course_content="{not valid json",
        quiz_data="also not json]",
        concept="Fallback concept.",
    ))
    db.commit()
    db.close()


def _seed_concept_only(db_factory, project="mars", knode_id=9):
    """LessonContent with empty course_content, only concept/examples/key_takeaways."""
    db = db_factory()
    db.add(LessonContent(
        project_name=project,
        knode_id=knode_id,
        status="ready",
        course_content="",
        concept="Friction opposes motion.",
        examples="Sliding a box.",
        key_takeaways="Friction = mu * N",
    ))
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# memory.py
# ---------------------------------------------------------------------------
class TestMemoryGaps:
    async def test_search_student_facts_db_none(self, ctx_no_db):
        with push_tool_context(ctx_no_db):
            out = await search_student_facts.ainvoke({})
        assert out == {"error": "db not configured"}

    def _set_mem0_enabled(self, monkeypatch, enabled):
        """patch get_config().memory.enabled (search_memory 据此判断是否配置)。"""
        class _Mem:
            pass
        mem = _Mem()
        mem.enabled = enabled

        class _Cfg:
            memory = mem

        monkeypatch.setattr(
            "systemedu.core.config.get_config", lambda: _Cfg(), raising=True
        )

    async def test_search_memory_not_configured(self, ctx, monkeypatch):
        """config.memory.enabled False -> note 'mem0 not configured'."""
        self._set_mem0_enabled(monkeypatch, False)
        with push_tool_context(ctx):
            out = await search_memory.ainvoke({"query": "rockets"})
        assert out == {"results": [], "note": "mem0 not configured"}

    async def test_search_memory_enabled_returns_results(self, ctx, monkeypatch):
        """enabled + Mem0AsyncAdapter.search 返回 list -> {results: [...]}."""
        self._set_mem0_enabled(monkeypatch, True)
        fixed = [{"memory": "loves rockets", "score": 0.9}]

        class _FakeAdapter:
            async def search(self, query, user_id, limit):
                assert query == "rockets"
                assert user_id == "u-test"
                return fixed

        monkeypatch.setattr(
            "systemedu.core.tutor.memory.mem0_adapter.Mem0AsyncAdapter",
            _FakeAdapter,
            raising=True,
        )
        with push_tool_context(ctx):
            out = await search_memory.ainvoke({"query": "rockets"})
        assert out == {"results": fixed}

    async def test_search_memory_exception(self, ctx, monkeypatch):
        """enabled 但 adapter 构造/search 抛异常 -> {results: [], error: str}."""
        self._set_mem0_enabled(monkeypatch, True)

        class _Boom:
            def __init__(self):
                raise RuntimeError("kaboom")

        monkeypatch.setattr(
            "systemedu.core.tutor.memory.mem0_adapter.Mem0AsyncAdapter",
            _Boom,
            raising=True,
        )
        with push_tool_context(ctx):
            out = await search_memory.ainvoke({"query": "x"})
        assert out["results"] == []
        assert "kaboom" in out["error"]


# ---------------------------------------------------------------------------
# practice.py
# ---------------------------------------------------------------------------
class TestGetPracticeExercisesGaps:
    async def test_db_none(self, ctx_no_db):
        with push_tool_context(ctx_no_db):
            out = await get_practice_exercises.ainvoke(
                {"project_name": "mars", "knode_id": "7"}
            )
        assert out == {"error": "db not configured"}

    async def test_knode_not_found(self, ctx):
        with push_tool_context(ctx):
            out = await get_practice_exercises.ainvoke(
                {"project_name": "mars", "knode_id": "999"}
            )
        assert out == {"found": False, "exercises": []}

    async def test_quiz_data_fallback_strips_answers(self, ctx, db_factory):
        _seed_quiz_only(db_factory)
        with push_tool_context(ctx):
            out = await get_practice_exercises.ainvoke(
                {"project_name": "mars", "knode_id": "7"}
            )
        assert out["found"] is True
        assert len(out["exercises"]) == 2
        for ex in out["exercises"]:
            assert "correct" not in ex
            assert "answer" not in ex
        assert {e["exercise_id"] for e in out["exercises"]} == {"q1", "q2"}

    async def test_malformed_json_both_swallowed(self, ctx, db_factory):
        """Bad course_content and bad quiz_data both raise + are swallowed -> empty."""
        _seed_malformed_json(db_factory)
        with push_tool_context(ctx):
            out = await get_practice_exercises.ainvoke(
                {"project_name": "mars", "knode_id": "10"}
            )
        assert out == {"found": True, "knode_id": "10", "exercises": []}


class TestGradeSubmissionGaps:
    async def test_db_none(self, ctx_no_db):
        with push_tool_context(ctx_no_db):
            out = await grade_submission.ainvoke({
                "project_name": "mars", "knode_id": "7",
                "exercise_id": "q1", "student_answer": "4",
            })
        assert out == {"error": "db not configured"}

    async def test_knode_not_found(self, ctx):
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars", "knode_id": "999",
                "exercise_id": "q1", "student_answer": "4",
            })
        assert out == {"graded": False, "reason": "knode not found"}

    async def test_exercise_not_found(self, ctx, db_factory):
        _seed_quiz_only(db_factory)
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars", "knode_id": "7",
                "exercise_id": "nope", "student_answer": "x",
            })
        assert out == {"graded": False, "reason": "exercise not found"}

    async def test_quiz_data_fallback_correct(self, ctx, db_factory):
        """correct found via quiz_data fallback; case/space-insensitive match -> True."""
        _seed_quiz_only(db_factory)
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars", "knode_id": "7",
                "exercise_id": "q2", "student_answer": "  PARIS  ",
            })
        assert out["graded"] is True
        assert out["is_correct"] is True
        assert out["correct_answer"] == "Paris"

    async def test_quiz_data_fallback_wrong(self, ctx, db_factory):
        _seed_quiz_only(db_factory)
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars", "knode_id": "7",
                "exercise_id": "q1", "student_answer": "5",
            })
        assert out["graded"] is True
        assert out["is_correct"] is False
        assert out["correct_answer"] == "4"

    async def test_course_content_correct(self, ctx, db_factory):
        """correct found via course_content exercises."""
        _seed_course_content(db_factory)
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars", "knode_id": "8",
                "exercise_id": "ex1", "student_answer": "b",
            })
        assert out["graded"] is True
        assert out["is_correct"] is True
        assert out["correct_answer"] == "B"

    async def test_malformed_json_exercise_not_found(self, ctx, db_factory):
        """Both course_content and quiz_data are malformed -> JSON errors
        swallowed, correct_answer stays None -> 'exercise not found'."""
        _seed_malformed_json(db_factory)
        with push_tool_context(ctx):
            out = await grade_submission.ainvoke({
                "project_name": "mars", "knode_id": "10",
                "exercise_id": "q1", "student_answer": "4",
            })
        assert out == {"graded": False, "reason": "exercise not found"}


# ---------------------------------------------------------------------------
# progress.py
# ---------------------------------------------------------------------------
class TestProgressDbNone:
    async def test_get_progress_db_none(self, ctx_no_db):
        with push_tool_context(ctx_no_db):
            out = await progress.get_progress.ainvoke({"project_name": "mars"})
        assert out == {"error": "db not configured"}

    async def test_complete_node_db_none(self, ctx_no_db):
        approved = ToolContext(
            user_id="u-test", session_id="s-1", approved=True, db=None
        )
        with push_tool_context(approved):
            out = await progress.complete_node.ainvoke(
                {"project_name": "mars", "knode_id": "3"}
            )
        assert out == {"error": "db not configured"}

    async def test_get_knode_prerequisites_db_none(self, ctx_no_db):
        with push_tool_context(ctx_no_db):
            out = await progress.get_knode_prerequisites.ainvoke(
                {"project_name": "mars", "knode_id": "3"}
            )
        assert out == {"error": "db not configured"}

    async def test_get_knode_content_db_none(self, ctx_no_db):
        with push_tool_context(ctx_no_db):
            out = await progress.get_knode_content.ainvoke(
                {"project_name": "mars", "knode_id": "3"}
            )
        assert out == {"error": "db not configured"}


class TestGetKnodeContentGaps:
    async def test_course_content_path(self, ctx, db_factory):
        _seed_course_content(db_factory)
        with push_tool_context(ctx):
            out = await progress.get_knode_content.ainvoke(
                {"project_name": "mars", "knode_id": "8"}
            )
        assert out["found"] is True
        assert out["plan_markdown"] == "# Plan\n\nLearn friction."
        assert out["theories"] == [{"theory_id": "t1", "title": "Friction"}]

    async def test_concept_fallback_path(self, ctx, db_factory):
        _seed_concept_only(db_factory)
        with push_tool_context(ctx):
            out = await progress.get_knode_content.ainvoke(
                {"project_name": "mars", "knode_id": "9"}
            )
        assert out["found"] is True
        assert out["concept"] == "Friction opposes motion."
        assert out["examples"] == "Sliding a box."
        assert out["key_takeaways"] == "Friction = mu * N"
        assert "plan_markdown" not in out

    async def test_malformed_course_content_falls_back_to_concept(self, ctx, db_factory):
        """course_content present but not JSON -> except branch sets concept."""
        _seed_malformed_json(db_factory)
        with push_tool_context(ctx):
            out = await progress.get_knode_content.ainvoke(
                {"project_name": "mars", "knode_id": "10"}
            )
        assert out["found"] is True
        assert out["concept"] == "Fallback concept."
        assert "plan_markdown" not in out
