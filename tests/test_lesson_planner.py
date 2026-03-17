"""Tests for LessonPlannerAgent."""

import json
from unittest.mock import MagicMock

import pytest

from systemedu.agents.builtin.lesson_planner import (
    LessonPlannerAgent,
    VALID_APPROACHES,
    VALID_DEPTHS,
    VALID_INTERACTIONS,
    VALID_TONES,
)


def _make_llm_mock(response: str) -> MagicMock:
    """Create a mock LLM that returns the given response."""
    mock = MagicMock()
    resp = MagicMock()
    resp.content = response
    mock.invoke = MagicMock(return_value=resp)
    return mock


VALID_PLAN = json.dumps({
    "concept_emphasis": "理解分类的本质是按特征分组",
    "concept_approach": "analogy",
    "concept_depth": "medium",
    "example_strategy": {
        "total_count": 5,
        "visual_count": 2,
        "game_count": 3,
        "recommended_visual_templates": ["step-by-step"],
        "recommended_game_templates": ["quiz-choice"],
        "example_focus": "用生活例子展示分类",
    },
    "lab_strategy": {
        "interaction_type": "drag_classify",
        "interaction_rationale": "树叶按特征分组最适合拖拽分类",
        "game_theme": "把树叶拖到分类框",
        "item_count": 6,
        "difficulty_adjustment": "3种类型",
    },
    "practice_strategy": {
        "exercise_types": ["short_answer"],
        "progression": "从识别到独立分类",
        "connection_to_lab": "使用与实验相同的场景",
    },
    "overall_tone": "playful",
    "key_vocabulary": ["分类", "特征"],
}, ensure_ascii=False)


class TestLessonPlannerAgent:
    def test_successful_plan(self):
        """Planner returns valid JSON plan."""
        llm = _make_llm_mock(VALID_PLAN)
        planner = LessonPlannerAgent(llm=llm)
        result = planner.plan("树叶分类", "学习如何分类", 3, "text", "自然科学基础")
        assert result is not None
        assert result["concept_approach"] == "analogy"
        assert result["lab_strategy"]["interaction_type"] == "drag_classify"
        assert result["overall_tone"] == "playful"
        assert llm.invoke.call_count == 1

    def test_code_fences_stripped(self):
        """Output wrapped in code fences is handled."""
        llm = _make_llm_mock(f"```json\n{VALID_PLAN}\n```")
        planner = LessonPlannerAgent(llm=llm)
        result = planner.plan("Test", "Summary", 5)
        assert result is not None
        assert result["concept_emphasis"] == "理解分类的本质是按特征分组"

    def test_invalid_json_returns_none(self):
        """Non-JSON output returns None."""
        llm = _make_llm_mock("This is not JSON")
        planner = LessonPlannerAgent(llm=llm)
        result = planner.plan("Test", "Summary", 5)
        assert result is None

    def test_missing_required_field_returns_none(self):
        """JSON missing required fields returns None."""
        partial = json.dumps({"concept_emphasis": "test"})
        llm = _make_llm_mock(partial)
        planner = LessonPlannerAgent(llm=llm)
        result = planner.plan("Test", "Summary", 5)
        assert result is None

    def test_invalid_enum_values_normalized(self):
        """Invalid enum values are replaced with defaults."""
        plan = json.loads(VALID_PLAN)
        plan["concept_approach"] = "invalid"
        plan["concept_depth"] = "invalid"
        plan["overall_tone"] = "invalid"
        plan["lab_strategy"]["interaction_type"] = "invalid"
        llm = _make_llm_mock(json.dumps(plan, ensure_ascii=False))
        planner = LessonPlannerAgent(llm=llm)
        result = planner.plan("Test", "Summary", 5)
        assert result is not None
        assert result["concept_approach"] == "analogy"
        assert result["concept_depth"] == "medium"
        assert result["overall_tone"] == "encouraging"
        assert result["lab_strategy"]["interaction_type"] == "drag_classify"

    def test_exception_returns_none(self):
        """LLM exception returns None."""
        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=RuntimeError("LLM error"))
        planner = LessonPlannerAgent(llm=llm)
        result = planner.plan("Test", "Summary", 5)
        assert result is None

    def test_difficulty_in_prompt(self):
        """Difficulty level appears in prompt."""
        for difficulty, expected in [(1, "入门级"), (5, "中级"), (9, "高级")]:
            llm = _make_llm_mock(VALID_PLAN)
            planner = LessonPlannerAgent(llm=llm)
            planner.plan("Test", "Summary", difficulty)
            prompt_text = llm.invoke.call_args[0][0][1].content
            assert expected in prompt_text

    def test_process_method(self):
        """Async process method delegates to plan()."""
        import asyncio
        llm = _make_llm_mock(VALID_PLAN)
        planner = LessonPlannerAgent(llm=llm)
        result = asyncio.get_event_loop().run_until_complete(
            planner.process("树叶分类", context={"summary": "分类学习", "difficulty": 3})
        )
        assert result  # non-empty string
        parsed = json.loads(result)
        assert parsed["concept_approach"] == "analogy"
