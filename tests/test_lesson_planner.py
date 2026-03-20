"""Tests for LessonPlannerAgent."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from systemedu.agents.builtin.lesson_planner import (
    LessonPlannerAgent,
    VALID_APPROACHES,
    VALID_DEPTHS,
    VALID_GAME_MECHANICS,
    VALID_TONES,
)


def _make_agent_mock(response: str) -> MagicMock:
    """Create a mock deep agent that returns the given response."""
    mock_agent = MagicMock()
    mock_agent.ainvoke = AsyncMock(return_value={
        "messages": [AIMessage(content=response)]
    })
    return mock_agent


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
        "game_concept": "屏幕左侧有四片不同形状的树叶，用户拖拽树叶放到右侧对应形状的分类框，正确放置时叶片弹跳动画反馈，全部完成后播放庆祝彩带",
        "game_mechanic": "exploration",
        "learning_connection": "通过动手操作直接体验叶形分类的标准",
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
    @pytest.mark.asyncio
    async def test_successful_plan(self):
        """Planner returns valid JSON plan."""
        mock_agent = _make_agent_mock(VALID_PLAN)
        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            planner = LessonPlannerAgent(llm=MagicMock())
            result = await planner.plan("树叶分类", "学习如何分类", 3, "text", "自然科学基础")
        assert result is not None
        assert result["concept_approach"] == "analogy"
        assert result["lab_strategy"]["game_mechanic"] == "exploration"
        assert result["lab_strategy"]["game_concept"] != ""
        assert result["overall_tone"] == "playful"
        mock_agent.ainvoke.assert_called_once()

    @pytest.mark.asyncio
    async def test_code_fences_stripped(self):
        """Output wrapped in code fences is handled."""
        mock_agent = _make_agent_mock(f"```json\n{VALID_PLAN}\n```")
        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            planner = LessonPlannerAgent(llm=MagicMock())
            result = await planner.plan("Test", "Summary", 5)
        assert result is not None
        assert result["concept_emphasis"] == "理解分类的本质是按特征分组"

    @pytest.mark.asyncio
    async def test_invalid_json_returns_none(self):
        """Non-JSON output returns None."""
        mock_agent = _make_agent_mock("This is not JSON")
        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            planner = LessonPlannerAgent(llm=MagicMock())
            result = await planner.plan("Test", "Summary", 5)
        assert result is None

    @pytest.mark.asyncio
    async def test_missing_required_field_returns_none(self):
        """JSON missing required fields returns None."""
        partial = json.dumps({"concept_emphasis": "test"})
        mock_agent = _make_agent_mock(partial)
        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            planner = LessonPlannerAgent(llm=MagicMock())
            result = await planner.plan("Test", "Summary", 5)
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_enum_values_normalized(self):
        """Invalid enum values are replaced with defaults."""
        plan = json.loads(VALID_PLAN)
        plan["concept_approach"] = "invalid"
        plan["concept_depth"] = "invalid"
        plan["overall_tone"] = "invalid"
        plan["lab_strategy"]["game_mechanic"] = "invalid"
        mock_agent = _make_agent_mock(json.dumps(plan, ensure_ascii=False))
        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            planner = LessonPlannerAgent(llm=MagicMock())
            result = await planner.plan("Test", "Summary", 5)
        assert result is not None
        assert result["concept_approach"] == "analogy"
        assert result["concept_depth"] == "medium"
        assert result["overall_tone"] == "encouraging"
        assert result["lab_strategy"]["game_mechanic"] == "exploration"

    @pytest.mark.asyncio
    async def test_missing_game_concept_gets_fallback(self):
        """Missing game_concept gets a fallback value."""
        plan = json.loads(VALID_PLAN)
        del plan["lab_strategy"]["game_concept"]
        mock_agent = _make_agent_mock(json.dumps(plan, ensure_ascii=False))
        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            planner = LessonPlannerAgent(llm=MagicMock())
            result = await planner.plan("Test", "Summary", 5)
        assert result is not None
        assert result["lab_strategy"]["game_concept"] != ""

    @pytest.mark.asyncio
    async def test_exception_returns_none(self):
        """LLM exception returns None."""
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(side_effect=RuntimeError("LLM error"))
        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            planner = LessonPlannerAgent(llm=MagicMock())
            result = await planner.plan("Test", "Summary", 5)
        assert result is None

    @pytest.mark.asyncio
    async def test_difficulty_in_prompt(self):
        """Difficulty level appears in user prompt sent to agent."""
        mock_agent = _make_agent_mock(VALID_PLAN)
        for difficulty, expected in [(1, "入门级"), (5, "中级"), (9, "高级")]:
            mock_agent.ainvoke.reset_mock()
            with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
                planner = LessonPlannerAgent(llm=MagicMock())
                await planner.plan("Test", "Summary", difficulty)
            # Check that ainvoke was called with HumanMessage containing the difficulty desc
            call_args = mock_agent.ainvoke.call_args
            messages = call_args[0][0]["messages"]
            prompt_text = messages[0].content
            assert expected in prompt_text, f"Expected '{expected}' for difficulty={difficulty}"

    @pytest.mark.asyncio
    async def test_process_method(self):
        """Async process method delegates to plan()."""
        mock_agent = _make_agent_mock(VALID_PLAN)
        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            planner = LessonPlannerAgent(llm=MagicMock())
            result = await planner.process("树叶分类", context={"summary": "分类学习", "difficulty": 3})
        assert result  # non-empty string
        parsed = json.loads(result)
        assert parsed["concept_approach"] == "analogy"

    def test_valid_game_mechanics_constant(self):
        """VALID_GAME_MECHANICS contains the expected values."""
        assert "simulation" in VALID_GAME_MECHANICS
        assert "exploration" in VALID_GAME_MECHANICS
        assert "construction" in VALID_GAME_MECHANICS
        assert "puzzle" in VALID_GAME_MECHANICS
        assert "narrative" in VALID_GAME_MECHANICS
        # Old interaction types should NOT be in VALID_GAME_MECHANICS
        assert "drag_classify" not in VALID_GAME_MECHANICS
        assert "connect_match" not in VALID_GAME_MECHANICS
