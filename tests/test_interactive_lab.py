"""Tests for interactive lab generation pipeline (2-Agent version).

These tests validate the _generate_interactive_lab function which uses
the 2-Agent pipeline (LabCoder -> LabReviewer).
"""

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


VALID_HTML = (
    "<!DOCTYPE html><html><head>"
    '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
    "</head><body><div id='root'></div></body></html>"
)

VALID_LAB_STRATEGY = {
    "game_concept": "用户调节燃料和推力两个滑块，点击发射，右侧实时显示火箭飞行高度曲线和最终高度",
    "game_mechanic": "simulation",
    "learning_connection": "通过参数调节感受变量影响结果",
}


class TestGenerateInteractiveLab:
    @pytest.mark.asyncio
    async def test_successful_generation(self):
        """Full 2-agent pipeline returns valid HTML."""
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        with (
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Test Node", "A test summary", 3, MagicMock())
        assert "<html" in result
        assert "react" in result.lower()

    @pytest.mark.asyncio
    async def test_coder_failure_returns_empty(self):
        """If coder returns non-HTML, pipeline returns empty."""
        mock_coder = _make_agent_mock("just text, no html")
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder):
            result = await _generate_interactive_lab("Node", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_lesson_plan_passed_to_coder(self):
        """When lesson_plan is provided, game_concept is passed to the coder."""
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        plan = {"lab_strategy": VALID_LAB_STRATEGY}
        with (
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Node", "Summary", 3, MagicMock(), lesson_plan=plan)
        assert "<html" in result
        # Coder ainvoke called with game_concept in prompt
        call_args = mock_coder.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "用户调节燃料" in prompt_text

    @pytest.mark.asyncio
    async def test_progress_callback_called(self):
        """Progress callback is called for each pipeline stage including reviewer."""
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        calls = []

        def cb(step, status, preview):
            calls.append((step, status))

        with (
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            await _generate_interactive_lab("Node", "Summary", 3, MagicMock(), progress_callback=cb)

        assert len(calls) == 4  # 2 stages x 2 (in_progress + completed)
        assert ("lab_coder", "in_progress") in calls
        assert ("lab_coder", "completed") in calls
        assert ("lab_reviewer", "in_progress") in calls
        assert ("lab_reviewer", "completed") in calls
        # Old agent steps should NOT appear
        assert not any(s in [c[0] for c in calls] for s in ("lab_analyst", "lab_designer", "lab_image_search"))
