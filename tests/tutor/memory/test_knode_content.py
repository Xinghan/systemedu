"""Tests for L3 knode content injection (课程内容注入到 LLM context).

Covers:
- _l3_knode_content loads plan_markdown + exercises from LessonContent
- Content truncated when exceeding limit
- Empty/missing knode returns ""
- course_factory rendered_sections exercises are extracted
- Legacy concept field fallback
- render_memory includes knode content
- render_memory_block (used by skills) includes knode content
"""

from __future__ import annotations

import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.storage.db import Base, LessonContent
from systemedu.tutor.memory import MemoryInjector, render_memory
from systemedu.tutor.skills._common import render_memory_block


@pytest.fixture
def engine(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 'knode_content.db'}")
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def session_factory(engine):
    return sessionmaker(bind=engine)


def _make_course_content(
    plan_markdown: str = "# 力与运动\n\n## 引入\n推力和拉力是最常见的力...",
    exercises: list[dict] | None = None,
    rendered_sections: dict | None = None,
) -> str:
    cc: dict = {"plan_markdown": plan_markdown}
    if exercises:
        cc["exercises"] = exercises
    if rendered_sections:
        cc["rendered_sections"] = rendered_sections
    return json.dumps(cc, ensure_ascii=False)


def _seed_lesson(
    session_factory,
    project: str = "rocket-design",
    knode_id: int = 5,
    course_content: str | None = None,
    concept: str = "",
):
    db = session_factory()
    try:
        db.add(LessonContent(
            project_name=project,
            knode_id=knode_id,
            status="ready",
            course_content=course_content or "",
            concept=concept,
        ))
        db.commit()
    finally:
        db.close()


class TestL3KnodeContent:
    @pytest.mark.asyncio
    async def test_loads_plan_markdown(self, session_factory):
        """L3 knode content loads plan_markdown from course_content JSON."""
        plan = "# 火箭推力原理\n\n## 引入\n火箭通过喷射高温气体产生推力..."
        _seed_lesson(session_factory, course_content=_make_course_content(plan))
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id="5",
            last_user_msg="练习题我不会", context_scope="project",
        )
        content = snap["l3_knode_content"]
        assert "火箭推力原理" in content
        assert "火箭通过喷射" in content

    @pytest.mark.asyncio
    async def test_extracts_rendered_sections_exercises(self, session_factory):
        """Exercises in rendered_sections are extracted with type and options."""
        rs = {
            "ex_abc": {
                "mode": "exercise",
                "exercises": [
                    {
                        "exercise_id": "ex1",
                        "question": "火箭推力来自什么？",
                        "type": "choice",
                        "correct": 1,
                        "options": ["燃料燃烧", "气体喷射反作用力", "空气推力", "重力"],
                    },
                    {
                        "exercise_id": "ex2",
                        "question": "牛顿第三定律是什么？",
                        "type": "short_answer",
                    },
                ],
            },
        }
        _seed_lesson(
            session_factory,
            course_content=_make_course_content(rendered_sections=rs),
        )
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id="5",
            last_user_msg="q", context_scope="project",
        )
        content = snap["l3_knode_content"]
        assert "练习题" in content
        assert "火箭推力来自什么" in content
        assert "ex1" in content
        assert "choice" in content
        # Options should appear
        assert "气体喷射反作用力" in content

    @pytest.mark.asyncio
    async def test_extracts_top_level_exercises(self, session_factory):
        """Legacy top-level exercises array is also extracted."""
        exercises = [
            {"exercise_id": "ex_legacy", "question": "什么是摩擦力？", "type": "open"},
        ]
        _seed_lesson(
            session_factory,
            course_content=_make_course_content(exercises=exercises),
        )
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id="5",
            last_user_msg="q", context_scope="project",
        )
        assert "什么是摩擦力" in snap["l3_knode_content"]

    @pytest.mark.asyncio
    async def test_truncates_long_plan(self, session_factory):
        """Plan markdown > 1500 chars is truncated."""
        long_plan = "# 标题\n\n" + "这是一段很长的内容。" * 200
        assert len(long_plan) > 1500
        _seed_lesson(
            session_factory,
            course_content=_make_course_content(long_plan),
        )
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id="5",
            last_user_msg="q", context_scope="project",
        )
        content = snap["l3_knode_content"]
        assert "truncated" in content
        # Should not exceed ~1600 chars (1500 + truncation message + header)
        assert len(content) < 2000

    @pytest.mark.asyncio
    async def test_missing_knode_returns_empty(self, session_factory):
        """No LessonContent row for the knode returns empty string."""
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id="999",
            last_user_msg="q", context_scope="project",
        )
        assert snap["l3_knode_content"] == ""

    @pytest.mark.asyncio
    async def test_no_knode_id_returns_empty(self, session_factory):
        """knode_id=None returns empty string."""
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id=None,
            last_user_msg="q", context_scope="project",
        )
        assert snap["l3_knode_content"] == ""

    @pytest.mark.asyncio
    async def test_global_scope_returns_empty(self, session_factory):
        """Global scope never loads knode content."""
        _seed_lesson(
            session_factory,
            course_content=_make_course_content("# 不应出现"),
        )
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id="5",
            last_user_msg="q", context_scope="global",
        )
        assert snap["l3_knode_content"] == ""

    @pytest.mark.asyncio
    async def test_legacy_concept_fallback(self, session_factory):
        """When course_content is empty, falls back to legacy concept field."""
        _seed_lesson(
            session_factory,
            course_content="",
            concept="推力是火箭飞行的关键原理。",
        )
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id="5",
            last_user_msg="q", context_scope="project",
        )
        assert "推力是火箭飞行的关键原理" in snap["l3_knode_content"]

    @pytest.mark.asyncio
    async def test_invalid_json_returns_empty(self, session_factory):
        """Malformed course_content JSON doesn't crash, returns empty."""
        _seed_lesson(session_factory, course_content="{bad json")
        inj = MemoryInjector(session_factory)
        snap = await inj.inject(
            user_id="u1", project_name="rocket-design", knode_id="5",
            last_user_msg="q", context_scope="project",
        )
        assert snap["l3_knode_content"] == ""


class TestRenderIncludesKnodeContent:
    def test_render_memory_includes_l3_content(self):
        snap = {
            "l1_profile": "",
            "l2_project_ctx": "",
            "l3_knode_state": "",
            "l3_knode_content": "## 课程内容\n火箭推力原理...",
            "l4_semantic_recall": [],
            "l5_skill_ctx": "",
        }
        out = render_memory(snap)
        assert "当前课程内容" in out
        assert "火箭推力原理" in out

    def test_render_memory_block_includes_l3_content(self):
        memory = {
            "l3_knode_content": "## 课程内容\n火箭推力原理...",
        }
        out = render_memory_block(memory)
        assert "当前课程内容" in out
        assert "火箭推力原理" in out

    def test_render_memory_block_empty_content(self):
        memory = {"l3_knode_content": ""}
        out = render_memory_block(memory)
        # Empty l3_knode_content should not produce a section
        assert "当前课程内容" not in out
