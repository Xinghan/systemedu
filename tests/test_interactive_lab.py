"""Tests for interactive lab generation pipeline (4-Agent version).

These tests validate the _generate_interactive_lab function which uses
the 4-Agent pipeline (LabAnalyst -> LabDesigner -> LabCoder -> LabReviewer).
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from systemedu.education.lesson_generator import _generate_interactive_lab


def _make_agent_mock(response: str) -> MagicMock:
    """Create a mock deep agent returning the given response."""
    mock_agent = MagicMock()
    mock_agent.ainvoke = AsyncMock(return_value={
        "messages": [AIMessage(content=response)]
    })
    return mock_agent


VALID_ANALYSIS = json.dumps({
    "topic": "测试主题",
    "core_concept": "核心概念",
    "interactive_objects": [
        {"name": "obj1", "category": "cat1", "features": {"f1": "v1", "f2": "v2"}},
        {"name": "obj2", "category": "cat2", "features": {"f1": "v1", "f2": "v2"}},
        {"name": "obj3", "category": "cat1", "features": {"f1": "v1", "f2": "v2"}},
        {"name": "obj4", "category": "cat2", "features": {"f1": "v1", "f2": "v2"}},
    ],
    "categories": ["cat1", "cat2"],
    "best_interaction": "drag_classify",
    "cause_effect_pairs": [],
    "learning_goal": "学习目标",
}, ensure_ascii=False)

VALID_DESIGN = json.dumps({
    "game_title": "测试游戏",
    "interaction_type": "drag_classify",
    "layout": "layout",
    "background_color": "#FFF",
    "items": [{"id": "i1", "label": "item1", "svg_description": "desc", "correct_target": "t1", "features_hint": "hint"}],
    "targets": [{"id": "t1", "label": "target1", "color": "#4CAF50", "icon_description": "icon"}],
    "animations": {"item_idle": "a", "item_hover": "b", "item_drag": "c", "correct_drop": "d", "wrong_drop": "e", "all_complete": "f"},
    "scoring": {"correct_points": 10, "wrong_penalty": -5, "total_items": 1, "perfect_score": 10, "encouragement": {"perfect": "!", "good": "!", "try_again": "!"}},
    "instructions": "instructions",
}, ensure_ascii=False)

VALID_HTML = (
    "<!DOCTYPE html><html><head>"
    '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
    "</head><body><div id='root'></div></body></html>"
)


class TestGenerateInteractiveLab:
    @pytest.mark.asyncio
    async def test_successful_generation(self):
        """Full 4-agent pipeline returns valid HTML."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock(VALID_DESIGN)
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Test Node", "A test summary", 3, MagicMock())
        assert "<html" in result
        assert "react" in result.lower()

    @pytest.mark.asyncio
    async def test_analyst_failure_returns_empty(self):
        """If analyst returns invalid JSON, pipeline returns empty."""
        mock_analyst = _make_agent_mock("This is just plain text, no JSON here")
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst):
            result = await _generate_interactive_lab("Node", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_designer_failure_returns_empty(self):
        """If designer fails, pipeline returns empty."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock("not json at all")
        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
        ):
            result = await _generate_interactive_lab("Node", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_coder_failure_returns_empty(self):
        """If coder returns non-HTML, pipeline returns empty."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock(VALID_DESIGN)
        mock_coder = _make_agent_mock("just text, no html")
        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
        ):
            result = await _generate_interactive_lab("Node", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_lesson_plan_passed_to_analyst(self):
        """When lesson_plan is provided, it's passed to the analyst."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock(VALID_DESIGN)
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        plan = {"lab_strategy": {"interaction_type": "cause_effect", "interaction_rationale": "test", "game_theme": "test", "item_count": 4}}
        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Node", "Summary", 3, MagicMock(), lesson_plan=plan)
        assert "<html" in result
        # Analyst ainvoke called with plan guidance in prompt
        call_args = mock_analyst.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "策划师指引" in prompt_text

    @pytest.mark.asyncio
    async def test_progress_callback_called(self):
        """Progress callback is called for each pipeline stage including reviewer."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock(VALID_DESIGN)
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        calls = []

        def cb(step, status, preview):
            calls.append((step, status))

        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            await _generate_interactive_lab("Node", "Summary", 3, MagicMock(), progress_callback=cb)

        assert len(calls) == 10  # 5 stages x 2 (in_progress + completed)
        assert ("lab_analyst", "in_progress") in calls
        assert ("lab_analyst", "completed") in calls
        assert ("lab_image_search", "in_progress") in calls
        assert ("lab_image_search", "completed") in calls
        assert ("lab_coder", "completed") in calls
        assert ("lab_reviewer", "in_progress") in calls
        assert ("lab_reviewer", "completed") in calls
