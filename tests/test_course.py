"""Tests for course planning and step generation."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import AIMessage


# ===== CoursePlannerAgent tests =====

class TestCoursePlannerAgent:
    """Unit tests for CoursePlannerAgent."""

    def _make_llm(self, response_text: str):
        llm = MagicMock()
        llm.invoke = MagicMock(return_value=AIMessage(content=response_text))
        return llm

    def _valid_manifest(self):
        return json.dumps({
            "node_title": "变量",
            "total_steps": 3,
            "learning_goal": "理解变量的概念",
            "steps": [
                {
                    "step_index": 0,
                    "type": "concept",
                    "title": "什么是变量",
                    "duration_minutes": 3,
                    "spec": {"prompt_hint": "用生活类比讲解变量"},
                },
                {
                    "step_index": 1,
                    "type": "game",
                    "title": "变量游戏",
                    "duration_minutes": 5,
                    "spec": {"game_mechanic": "drag_sort", "game_concept": "变量赋值"},
                },
                {
                    "step_index": 2,
                    "type": "practice",
                    "title": "变量练习",
                    "duration_minutes": 5,
                    "spec": {"exercise_count": 3, "prompt_hint": "考察变量定义"},
                },
            ],
        }, ensure_ascii=False)

    @pytest.mark.asyncio
    async def test_plan_returns_manifest(self):
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        llm = self._make_llm(self._valid_manifest())
        agent = CoursePlannerAgent(llm=llm)
        result = await agent.plan("变量", "编程中的变量概念", 3, "Python 基础")

        assert result is not None
        assert result["total_steps"] == 3
        assert len(result["steps"]) == 3
        assert result["steps"][0]["type"] == "concept"
        assert result["steps"][1]["type"] == "game"
        assert result["steps"][2]["type"] == "practice"

    @pytest.mark.asyncio
    async def test_plan_with_code_fences(self):
        """Should strip markdown code fences from LLM response."""
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        wrapped = f"```json\n{self._valid_manifest()}\n```"
        llm = self._make_llm(wrapped)
        agent = CoursePlannerAgent(llm=llm)
        result = await agent.plan("变量", "变量概念", 3, "基础")

        assert result is not None
        assert result["total_steps"] == 3

    @pytest.mark.asyncio
    async def test_plan_returns_none_on_invalid_json(self):
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        llm = self._make_llm("这不是JSON")
        agent = CoursePlannerAgent(llm=llm)
        result = await agent.plan("变量", "变量概念", 3)

        assert result is None

    @pytest.mark.asyncio
    async def test_plan_returns_none_on_missing_steps(self):
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        llm = self._make_llm(json.dumps({"node_title": "变量", "total_steps": 0}))
        agent = CoursePlannerAgent(llm=llm)
        result = await agent.plan("变量", "变量概念", 3)

        assert result is None

    @pytest.mark.asyncio
    async def test_plan_fixes_step_indices(self):
        """step_index should be corrected based on position."""
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        manifest = json.loads(self._valid_manifest())
        # Corrupt step indices
        for s in manifest["steps"]:
            s["step_index"] = 99
        llm = self._make_llm(json.dumps(manifest))
        agent = CoursePlannerAgent(llm=llm)
        result = await agent.plan("变量", "变量概念", 3)

        assert result is not None
        for i, step in enumerate(result["steps"]):
            assert step["step_index"] == i


# ===== step_generator tests =====

class TestStepGenerator:
    """Unit tests for generate_step function."""

    def _make_llm(self, response_text: str):
        llm = MagicMock()
        llm.invoke = MagicMock(return_value=AIMessage(content=response_text))
        return llm

    @pytest.mark.asyncio
    async def test_generate_concept_step(self):
        from systemedu.education.step_generator import generate_step

        llm = self._make_llm("## 什么是变量\n变量是存储数据的容器。")
        step_spec = {
            "step_index": 0,
            "type": "concept",
            "title": "什么是变量",
            "duration_minutes": 3,
            "spec": {"prompt_hint": "用生活类比"},
        }
        result = await generate_step(step_spec, "变量", "变量概念", 3, "基础", llm)

        assert result["step_index"] == 0
        assert result["type"] == "concept"
        assert result["status"] == "ready"
        assert "变量" in result["content"]
        assert result["html"] == ""

    @pytest.mark.asyncio
    async def test_generate_practice_step(self):
        from systemedu.education.step_generator import generate_step

        practice_json = json.dumps({
            "exercises": [
                {
                    "type": "choice",
                    "question": "变量是什么？",
                    "options": ["A", "B", "C", "D"],
                    "correct": 0,
                    "answer": "",
                    "hint": "想想盒子",
                    "explanation": "变量是容器",
                    "difficulty": "easy",
                    "points": 10,
                }
            ],
            "total_points": 10,
            "pass_score": 6,
        }, ensure_ascii=False)

        llm = self._make_llm(practice_json)
        step_spec = {
            "step_index": 2,
            "type": "practice",
            "title": "变量练习",
            "duration_minutes": 5,
            "spec": {"exercise_count": 3},
        }
        result = await generate_step(step_spec, "变量", "变量概念", 3, "基础", llm)

        assert result["type"] == "practice"
        assert result["status"] == "ready"
        data = json.loads(result["practice_data"])
        assert "exercises" in data

    @pytest.mark.asyncio
    async def test_generate_step_handles_exception(self):
        """If LLM raises, step should have status=failed."""
        from systemedu.education.step_generator import generate_step

        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=RuntimeError("LLM error"))

        step_spec = {
            "step_index": 0,
            "type": "concept",
            "title": "测试",
            "duration_minutes": 3,
            "spec": {},
        }
        result = await generate_step(step_spec, "变量", "变量概念", 3, "基础", llm)

        assert result["status"] == "failed"

    @pytest.mark.asyncio
    async def test_generate_game_step_falls_back_to_concept(self):
        """If GameSpecPlannerAgent fails, game step should fallback to concept."""
        from systemedu.education.step_generator import generate_step

        llm = self._make_llm("## 变量赋值\n赋值就是给变量存值。")

        step_spec = {
            "step_index": 1,
            "type": "game",
            "title": "游戏",
            "duration_minutes": 5,
            "spec": {"game_mechanic": "drag_sort", "game_concept": "赋值"},
        }

        result = await generate_step(step_spec, "变量", "变量概念", 3, "基础", llm)

        assert result["status"] == "ready"
        # Game steps fall back to concept type
        assert result["type"] == "concept"
        assert result["content"] != ""


# ===== DB migration tests =====

class TestDBMigration:
    """Tests for course_manifest and course_steps columns."""

    def test_lesson_content_has_course_columns(self, tmp_path, monkeypatch):
        """LessonContent model should have course_manifest and course_steps columns."""
        from systemedu.storage.db import reset_db
        db_file = tmp_path / "test.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        monkeypatch.setattr("systemedu.core.config.DB_FILE", db_file)
        reset_db()

        from systemedu.storage.db import LessonContent, get_session

        db = get_session()
        try:
            lesson = LessonContent(
                project_name="test-proj",
                knode_id=0,
                status="pending",
                course_manifest='{"steps": []}',
                course_steps="[]",
            )
            db.add(lesson)
            db.commit()

            fetched = db.query(LessonContent).filter_by(project_name="test-proj").first()
            assert fetched is not None
            assert fetched.course_manifest == '{"steps": []}'
            assert fetched.course_steps == "[]"
        finally:
            db.close()
            reset_db()
