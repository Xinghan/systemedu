"""Tests for interactive lab generation pipeline (GameAgent version).

These tests validate the _generate_interactive_lab function which uses
the GameAgent pipeline (GameSpecPlannerAgent -> GameCompiler).
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from systemedu.agents.builtin.gameagent.spec import GameFeedback, GameLevel, GameRules, GameSpec
from systemedu.education.lesson_generator import _generate_interactive_lab


def _make_agent_mock(response: str) -> MagicMock:
    """Create a mock deep agent returning the given response."""
    mock_agent = MagicMock()
    mock_agent.ainvoke = AsyncMock(return_value={
        "messages": [AIMessage(content=response)]
    })
    return mock_agent


def _make_drag_sort_spec_json() -> str:
    spec = GameSpec(
        mechanic="drag_sort",
        topic="火箭发射",
        theme="火箭探险",
        difficulty=5,
        entities=[
            {"id": "e1", "label": "燃料箱", "category": "cat1", "color": "#F87171"},
            {"id": "e2", "label": "发动机", "category": "cat1", "color": "#4F8EF7"},
            {"id": "e3", "label": "驾驶舱", "category": "cat2", "color": "#4ADE80"},
            {"id": "e4", "label": "太阳能板", "category": "cat2", "color": "#FB923C"},
        ],
        categories=[
            {"id": "cat1", "label": "动力系统"},
            {"id": "cat2", "label": "载荷系统"},
        ],
        rules=GameRules(),
        levels=[GameLevel(prompt="将组件拖入对应系统")],
        feedback=GameFeedback(),
    )
    return spec.model_dump_json()


VALID_LAB_STRATEGY = {
    "game_concept": "用户调节燃料和推力两个滑块，点击发射，右侧实时显示火箭飞行高度曲线和最终高度",
    "game_mechanic": "simulation",
    "learning_connection": "通过参数调节感受变量影响结果",
}


class TestGenerateInteractiveLab:
    @pytest.mark.asyncio
    async def test_successful_generation(self):
        """GameAgent pipeline returns valid HTML with GAME_SPEC."""
        spec_json = _make_drag_sort_spec_json()
        mock_agent = _make_agent_mock(spec_json)
        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            result = await _generate_interactive_lab("Test Node", "A test summary", 3, MagicMock())
        assert "const SPEC =" in result
        assert "__GAME_SPEC__" not in result

    @pytest.mark.asyncio
    async def test_planner_failure_returns_empty(self):
        """If planner returns invalid JSON, pipeline returns empty."""
        mock_agent = _make_agent_mock("just text, no json")
        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            result = await _generate_interactive_lab("Node", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_progress_callback_called(self):
        """Progress callback is called for game_spec_planner and game_compiler."""
        spec_json = _make_drag_sort_spec_json()
        mock_agent = _make_agent_mock(spec_json)
        calls = []

        def cb(step, status, preview):
            calls.append((step, status))

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            await _generate_interactive_lab("Node", "Summary", 3, MagicMock(), progress_callback=cb)

        step_names = [c[0] for c in calls]
        assert "game_spec_planner" in step_names
        assert "game_compiler" in step_names
        assert ("game_spec_planner", "in_progress") in calls
        assert ("game_spec_planner", "completed") in calls
        assert ("game_compiler", "in_progress") in calls
        assert ("game_compiler", "completed") in calls
        # Old agent steps should NOT appear
        assert not any(s in step_names for s in ("lab_coder", "lab_reviewer"))
