"""Tests for interactive lab LLM generation pipeline."""

from unittest.mock import MagicMock

import pytest

from systemedu.education.lesson_generator import _generate_interactive_lab


def _make_llm_mock(response: str) -> MagicMock:
    """Create a mock LLM that returns the given response."""
    mock = MagicMock()
    resp = MagicMock()
    resp.content = response
    mock.invoke = MagicMock(return_value=resp)
    return mock


class TestGenerateInteractiveLab:
    VALID_HTML = (
        "<!DOCTYPE html><html><head>"
        '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
        "</head><body><div id='root'></div></body></html>"
    )

    def test_successful_generation(self):
        """LLM returns valid HTML, function returns it."""
        llm = _make_llm_mock(self.VALID_HTML)
        result = _generate_interactive_lab("Test Node", "A test summary", 3, llm)
        assert "<html" in result
        assert "react" in result.lower()
        assert llm.invoke.call_count == 1

    def test_code_fences_stripped(self):
        """Output wrapped in markdown code fences is handled."""
        llm = _make_llm_mock(f"```html\n{self.VALID_HTML}\n```")
        result = _generate_interactive_lab("Node", "Summary", 5, llm)
        assert "<html" in result
        assert not result.startswith("```")

    def test_no_html_returns_empty(self):
        """If output doesn't look like HTML, returns empty."""
        llm = _make_llm_mock("This is just plain text, no HTML here")
        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""

    def test_exception_returns_empty(self):
        """If LLM raises exception, returns empty."""
        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=RuntimeError("LLM error"))
        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""

    def test_difficulty_levels_in_prompt(self):
        """Difficulty level is reflected in prompt text."""
        for difficulty, expected_label in [(1, "入门级"), (5, "中级"), (8, "高级")]:
            llm = _make_llm_mock(self.VALID_HTML)
            _generate_interactive_lab("Node", "Summary", difficulty, llm)
            prompt_text = llm.invoke.call_args[0][0][0].content
            assert expected_label in prompt_text

    def test_prompt_forbids_sliders(self):
        """Prompt explicitly forbids slider/parameter mode."""
        llm = _make_llm_mock(self.VALID_HTML)
        _generate_interactive_lab("Node", "Summary", 3, llm)
        prompt_text = llm.invoke.call_args[0][0][0].content
        assert "不要使用滑块" in prompt_text
        assert "拖拽分类" in prompt_text

    def test_prompt_constrains_height(self):
        """Prompt tells LLM to fit within 600px iframe height."""
        llm = _make_llm_mock(self.VALID_HTML)
        _generate_interactive_lab("Node", "Summary", 3, llm)
        prompt_text = llm.invoke.call_args[0][0][0].content
        assert "600px" in prompt_text
        assert "overflow:hidden" in prompt_text
