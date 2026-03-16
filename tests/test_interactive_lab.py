"""Tests for interactive lab two-stage LLM pipeline."""

import json
from unittest.mock import MagicMock

import pytest

from systemedu.education.lesson_generator import _generate_interactive_lab


def _make_llm_mock(responses: list[str]) -> MagicMock:
    """Create a mock LLM that returns given responses in sequence."""
    mock = MagicMock()
    side_effects = []
    for text in responses:
        resp = MagicMock()
        resp.content = text
        side_effects.append(resp)
    mock.invoke = MagicMock(side_effect=side_effects)
    return mock


class TestGenerateInteractiveLab:
    def test_successful_two_stage_pipeline(self):
        """Both stages succeed, returns HTML."""
        design_json = json.dumps({
            "experiment_title": "Test Experiment",
            "description": "A test",
            "parameters": [{"name": "p1", "label": "Param 1", "min": 0, "max": 100, "default": 50, "unit": ""}],
            "visualization": "SVG circle",
            "formula_logic": "r = p1",
            "interaction": "Drag slider",
        })
        html_code = (
            "<!DOCTYPE html><html><head>"
            '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
            "</head><body><div id='root'></div></body></html>"
        )
        llm = _make_llm_mock([design_json, html_code])

        result = _generate_interactive_lab("Test Node", "A test summary", 3, llm)
        assert "<html" in result
        assert "react" in result.lower()
        assert llm.invoke.call_count == 2

    def test_stage1_returns_code_fences(self):
        """Stage 1 output wrapped in markdown code fences is handled."""
        design_json = json.dumps({
            "experiment_title": "Fenced",
            "description": "test",
            "parameters": [],
            "visualization": "SVG",
            "formula_logic": "x=1",
            "interaction": "click",
        })
        html_code = "<html><head><script src='react'></script></head><body></body></html>"
        llm = _make_llm_mock([f"```json\n{design_json}\n```", html_code])

        result = _generate_interactive_lab("Node", "Summary", 5, llm)
        assert "<html" in result

    def test_stage2_returns_code_fences(self):
        """Stage 2 output wrapped in markdown code fences is handled."""
        design_json = json.dumps({
            "experiment_title": "Test",
            "description": "test",
            "parameters": [],
            "visualization": "SVG",
            "formula_logic": "x=1",
            "interaction": "click",
        })
        html_code = "<html><head><script src='react'></script></head><body></body></html>"
        llm = _make_llm_mock([design_json, f"```html\n{html_code}\n```"])

        result = _generate_interactive_lab("Node", "Summary", 5, llm)
        assert "<html" in result

    def test_stage1_invalid_json_returns_empty(self):
        """If stage 1 returns invalid JSON, result is empty string."""
        llm = _make_llm_mock(["not valid json at all"])

        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""
        # Only 1 call (stage 1 failed, stage 2 never called)
        assert llm.invoke.call_count == 1

    def test_stage2_no_html_returns_empty(self):
        """If stage 2 output doesn't look like HTML, returns empty."""
        design_json = json.dumps({
            "experiment_title": "Test",
            "description": "test",
            "parameters": [],
            "visualization": "SVG",
            "formula_logic": "x=1",
            "interaction": "click",
        })
        llm = _make_llm_mock([design_json, "This is just plain text, no HTML here"])

        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""

    def test_stage1_exception_returns_empty(self):
        """If LLM raises exception in stage 1, returns empty."""
        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=RuntimeError("LLM error"))

        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""

    def test_stage2_exception_returns_empty(self):
        """If LLM raises exception in stage 2, returns empty."""
        design_json = json.dumps({
            "experiment_title": "Test",
            "description": "test",
            "parameters": [],
            "visualization": "SVG",
            "formula_logic": "x=1",
            "interaction": "click",
        })
        resp1 = MagicMock()
        resp1.content = design_json
        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=[resp1, RuntimeError("LLM error")])

        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""

    def test_difficulty_levels_in_prompts(self):
        """Difficulty level is reflected in prompt text."""
        design_json = json.dumps({
            "experiment_title": "T",
            "description": "d",
            "parameters": [],
            "visualization": "v",
            "formula_logic": "f",
            "interaction": "i",
        })
        html = "<html><head><script src='react'></script></head><body></body></html>"

        for difficulty, expected_label in [(1, "入门级"), (5, "中级"), (8, "高级")]:
            llm = _make_llm_mock([design_json, html])
            _generate_interactive_lab("Node", "Summary", difficulty, llm)

            # Check stage 1 prompt contains difficulty description
            call_args = llm.invoke.call_args_list[0]
            prompt_text = call_args[0][0][0].content
            assert expected_label in prompt_text
