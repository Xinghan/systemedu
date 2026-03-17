"""Tests for interactive lab generation pipeline (4-Agent version).

These tests validate the _generate_interactive_lab function which uses
the 4-Agent pipeline (LabAnalyst → LabDesigner → LabCoder → LabReviewer).
"""

import json
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


def _make_multi_llm_mock(responses: list[str]) -> MagicMock:
    """Create a mock LLM that returns different responses for sequential calls."""
    mock = MagicMock()
    resps = []
    for r in responses:
        resp = MagicMock()
        resp.content = r
        resps.append(resp)
    mock.invoke = MagicMock(side_effect=resps)
    return mock


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


class TestGenerateInteractiveLab:
    VALID_HTML = (
        "<!DOCTYPE html><html><head>"
        '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
        "</head><body><div id='root'></div></body></html>"
    )

    def test_successful_generation(self):
        """Full 4-agent pipeline returns valid HTML."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, VALID_DESIGN, self.VALID_HTML, self.VALID_HTML])
        result = _generate_interactive_lab("Test Node", "A test summary", 3, llm)
        assert "<html" in result
        assert "react" in result.lower()
        # analyst + designer + coder + reviewer = 4
        assert llm.invoke.call_count == 4

    def test_analyst_failure_returns_empty(self):
        """If analyst returns invalid JSON, pipeline returns empty."""
        llm = _make_llm_mock("This is just plain text, no JSON here")
        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""

    def test_designer_failure_returns_empty(self):
        """If designer fails, pipeline returns empty."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, "not json at all"])
        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""

    def test_coder_failure_returns_empty(self):
        """If coder returns non-HTML, pipeline returns empty."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, VALID_DESIGN, "just text, no html"])
        result = _generate_interactive_lab("Node", "Summary", 3, llm)
        assert result == ""

    def test_lesson_plan_passed_to_analyst(self):
        """When lesson_plan is provided, it's passed to the analyst."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, VALID_DESIGN, self.VALID_HTML, self.VALID_HTML])
        plan = {"lab_strategy": {"interaction_type": "cause_effect", "interaction_rationale": "test", "game_theme": "test", "item_count": 4}}
        result = _generate_interactive_lab("Node", "Summary", 3, llm, lesson_plan=plan)
        assert "<html" in result
        # First call is analyst — check that plan guidance is in prompt
        analyst_prompt = llm.invoke.call_args_list[0][0][0][1].content
        assert "策划师指引" in analyst_prompt

    def test_progress_callback_called(self):
        """Progress callback is called for each pipeline stage including reviewer."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, VALID_DESIGN, self.VALID_HTML, self.VALID_HTML])
        calls = []
        def cb(step, status, preview):
            calls.append((step, status))

        _generate_interactive_lab("Node", "Summary", 3, llm, progress_callback=cb)
        assert len(calls) == 8  # 4 stages x 2 (in_progress + completed)
        assert ("lab_analyst", "in_progress") in calls
        assert ("lab_analyst", "completed") in calls
        assert ("lab_coder", "completed") in calls
        assert ("lab_reviewer", "in_progress") in calls
        assert ("lab_reviewer", "completed") in calls
