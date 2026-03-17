"""Tests for the 4-Agent lab pipeline: LabAnalyst, LabDesigner, LabCoder, LabReviewer."""

import json
from unittest.mock import MagicMock, call

import pytest

from systemedu.agents.builtin.lab_analyst import LabAnalystAgent
from systemedu.agents.builtin.lab_designer import LabDesignerAgent
from systemedu.agents.builtin.lab_coder import LabCoderAgent, validate_lab_html
from systemedu.agents.builtin.lab_reviewer import LabReviewerAgent
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
    "topic": "树叶分类",
    "core_concept": "按特征将树叶分类",
    "interactive_objects": [
        {"name": "银杏叶", "category": "扇形叶", "features": {"形状": "扇形", "颜色": "黄色"}},
        {"name": "枫叶", "category": "掌状叶", "features": {"形状": "掌状", "颜色": "红色"}},
        {"name": "松针", "category": "针形叶", "features": {"形状": "针形", "颜色": "绿色"}},
        {"name": "柳叶", "category": "披针叶", "features": {"形状": "细长", "颜色": "绿色"}},
    ],
    "categories": ["扇形叶", "掌状叶", "针形叶", "披针叶"],
    "best_interaction": "drag_classify",
    "cause_effect_pairs": [],
    "learning_goal": "学会按特征分类树叶",
}, ensure_ascii=False)

VALID_DESIGN = json.dumps({
    "game_title": "树叶分类小能手",
    "interaction_type": "drag_classify",
    "layout": "上方4片树叶，下方4个分类框",
    "background_color": "#F0F4F8",
    "items": [
        {"id": "item1", "label": "银杏叶", "svg_description": "扇形黄色", "correct_target": "box_1", "features_hint": "扇形"},
    ],
    "targets": [
        {"id": "box_1", "label": "扇形叶", "color": "#4CAF50", "icon_description": "扇形图标"},
    ],
    "animations": {
        "item_idle": "float", "item_hover": "scale(1.1)", "item_drag": "opacity 0.7",
        "correct_drop": "bounceIn", "wrong_drop": "shake", "all_complete": "confetti",
    },
    "scoring": {
        "correct_points": 10, "wrong_penalty": -5, "total_items": 4, "perfect_score": 40,
        "encouragement": {"perfect": "满分！", "good": "不错！", "try_again": "加油！"},
    },
    "instructions": "把树叶拖到正确的分类框中",
}, ensure_ascii=False)

VALID_HTML = (
    "<!DOCTYPE html><html><head>"
    '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
    "</head><body><div id='root'></div></body></html>"
)


class TestLabAnalystAgent:
    def test_analyze_success(self):
        llm = _make_llm_mock(VALID_ANALYSIS)
        analyst = LabAnalystAgent(llm=llm)
        result = analyst.analyze("树叶分类", "学习分类", 3)
        assert result is not None
        assert result["best_interaction"] == "drag_classify"
        assert len(result["interactive_objects"]) == 4

    def test_analyze_with_lesson_plan(self):
        """Lesson plan guidance is injected into the prompt."""
        llm = _make_llm_mock(VALID_ANALYSIS)
        analyst = LabAnalystAgent(llm=llm)
        plan = {
            "lab_strategy": {
                "interaction_type": "cause_effect",
                "interaction_rationale": "火箭发射适合因果操作",
                "game_theme": "调节参数发射火箭",
                "item_count": 4,
            }
        }
        result = analyst.analyze("火箭发射", "学习火箭", 5, lesson_plan=plan)
        assert result is not None
        # Check prompt contains plan guidance
        prompt_text = llm.invoke.call_args[0][0][1].content
        assert "策划师指引" in prompt_text
        assert "cause_effect" in prompt_text

    def test_analyze_without_lesson_plan(self):
        """Works fine without lesson plan."""
        llm = _make_llm_mock(VALID_ANALYSIS)
        analyst = LabAnalystAgent(llm=llm)
        result = analyst.analyze("Test", "Summary", 3, lesson_plan=None)
        assert result is not None
        prompt_text = llm.invoke.call_args[0][0][1].content
        assert "策划师指引" not in prompt_text

    def test_invalid_interaction_defaults(self):
        """Invalid interaction type defaults to drag_classify."""
        analysis = json.loads(VALID_ANALYSIS)
        analysis["best_interaction"] = "unknown_type"
        llm = _make_llm_mock(json.dumps(analysis, ensure_ascii=False))
        analyst = LabAnalystAgent(llm=llm)
        result = analyst.analyze("Test", "Summary", 3)
        assert result["best_interaction"] == "drag_classify"


class TestLabDesignerAgent:
    def test_design_success(self):
        analysis = json.loads(VALID_ANALYSIS)
        llm = _make_llm_mock(VALID_DESIGN)
        designer = LabDesignerAgent(llm=llm)
        result = designer.design(analysis, 3)
        assert result is not None
        assert result["game_title"] == "树叶分类小能手"
        assert len(result["items"]) >= 1

    def test_design_invalid_json(self):
        analysis = json.loads(VALID_ANALYSIS)
        llm = _make_llm_mock("not json")
        designer = LabDesignerAgent(llm=llm)
        result = designer.design(analysis, 3)
        assert result is None


class TestLabCoderAgent:
    def test_generate_success(self):
        design = json.loads(VALID_DESIGN)
        llm = _make_llm_mock(VALID_HTML)
        coder = LabCoderAgent(llm=llm)
        result = coder.generate(design, 3)
        assert "<html" in result
        assert "react" in result.lower()

    def test_generate_invalid_html(self):
        design = json.loads(VALID_DESIGN)
        llm = _make_llm_mock("just plain text")
        coder = LabCoderAgent(llm=llm)
        result = coder.generate(design, 3)
        assert result == ""


class TestLabPipeline:
    def test_full_pipeline_success(self):
        """Full 4-agent pipeline produces HTML."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, VALID_DESIGN, VALID_HTML, VALID_HTML])
        result = _generate_interactive_lab("树叶分类", "学习分类", 3, llm)
        assert "<html" in result
        # analyst + designer + coder + reviewer = 4
        assert llm.invoke.call_count == 4

    def test_pipeline_with_lesson_plan(self):
        """Pipeline passes lesson plan to analyst."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, VALID_DESIGN, VALID_HTML, VALID_HTML])
        plan = {"lab_strategy": {"interaction_type": "drag_classify"}}
        result = _generate_interactive_lab("Test", "Summary", 3, llm, lesson_plan=plan)
        assert "<html" in result
        # First call is analyst — check plan guidance in prompt
        analyst_prompt = llm.invoke.call_args_list[0][0][0][1].content
        assert "策划师指引" in analyst_prompt

    def test_pipeline_analyst_failure(self):
        """If analyst fails, pipeline returns empty."""
        llm = _make_llm_mock("not valid json")
        result = _generate_interactive_lab("Test", "Summary", 3, llm)
        assert result == ""

    def test_pipeline_designer_failure(self):
        """If designer fails, pipeline returns empty."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, "not json"])
        result = _generate_interactive_lab("Test", "Summary", 3, llm)
        assert result == ""

    def test_pipeline_progress_callback(self):
        """Progress callback is invoked for each stage including reviewer."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, VALID_DESIGN, VALID_HTML, VALID_HTML])
        callbacks = []
        def callback(step, status, preview):
            callbacks.append((step, status))

        _generate_interactive_lab("Test", "Summary", 3, llm, progress_callback=callback)

        step_names = [c[0] for c in callbacks]
        assert "lab_analyst" in step_names
        assert "lab_designer" in step_names
        assert "lab_coder" in step_names
        assert "lab_reviewer" in step_names
        # Check status progression
        assert ("lab_analyst", "in_progress") in callbacks
        assert ("lab_analyst", "completed") in callbacks
        assert ("lab_reviewer", "in_progress") in callbacks
        assert ("lab_reviewer", "completed") in callbacks

    def test_pipeline_progress_callback_on_failure(self):
        """Progress callback reports failure when analyst fails."""
        llm = _make_llm_mock("not json")
        callbacks = []
        def callback(step, status, preview):
            callbacks.append((step, status))

        _generate_interactive_lab("Test", "Summary", 3, llm, progress_callback=callback)
        assert ("lab_analyst", "failed") in callbacks

    def test_pipeline_retry_on_analyst_failure(self):
        """Pipeline retries analyst once before failing."""
        # First call returns invalid, second returns valid
        llm = _make_multi_llm_mock(["not json", VALID_ANALYSIS, VALID_DESIGN, VALID_HTML, VALID_HTML])
        result = _generate_interactive_lab("Test", "Summary", 3, llm)
        assert "<html" in result
        # 2 analyst calls + 1 designer + 1 coder + 1 reviewer = 5
        assert llm.invoke.call_count == 5

    def test_pipeline_retry_on_designer_failure(self):
        """Pipeline retries designer once before failing."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, "not json", VALID_DESIGN, VALID_HTML, VALID_HTML])
        result = _generate_interactive_lab("Test", "Summary", 3, llm)
        assert "<html" in result
        assert llm.invoke.call_count == 5

    def test_pipeline_retry_on_coder_failure(self):
        """Pipeline retries coder once before failing."""
        llm = _make_multi_llm_mock([VALID_ANALYSIS, VALID_DESIGN, "not html", VALID_HTML, VALID_HTML])
        result = _generate_interactive_lab("Test", "Summary", 3, llm)
        assert "<html" in result
        assert llm.invoke.call_count == 5


class TestValidateLabHtml:
    def test_valid_html(self):
        """Complete HTML passes validation."""
        # Build HTML > 1000 chars to avoid short-content warning
        padding = "/* " + "x" * 500 + " */"
        html = (
            '<!DOCTYPE html><html><head>'
            '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
            '<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>'
            '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>'
            f'<style>@keyframes fadeIn {{}} @keyframes shake {{}} .game {{ color: red; }} {padding}</style>'
            '</head><body><div id="root"></div>'
            '<script type="text/babel">'
            'const App = () => { const [s, setS] = React.useState(0);'
            ' const handleDragStart = (e) => { e.dataTransfer.setData("text/plain", "1"); };'
            ' return <div draggable onDragStart={handleDragStart} onClick={() => setS(1)}><svg><circle/></svg></div>; };'
            'ReactDOM.createRoot(document.getElementById("root")).render(<App/>);'
            '</script></body></html>'
        )
        result = validate_lab_html(html)
        assert result["fatal"] is None
        assert len(result["warnings"]) == 0

    def test_no_html_tag(self):
        """Missing html tag is fatal."""
        result = validate_lab_html("<div>hello</div>")
        assert result["fatal"] is not None

    def test_no_react(self):
        """Missing react reference is fatal."""
        result = validate_lab_html("<html><div>hello</div></html>")
        assert result["fatal"] is not None

    def test_no_div(self):
        """Missing div is fatal."""
        result = validate_lab_html("<html>react only text</html>")
        assert result["fatal"] is not None

    def test_missing_babel_warning(self):
        """Missing Babel is a warning, not fatal."""
        html = '<html><div id="root"></div><script src="react@18">React useState createRoot</script></html>'
        result = validate_lab_html(html)
        assert result["fatal"] is None
        assert any("Babel" in w for w in result["warnings"])

    def test_short_html_warning(self):
        """Very short HTML generates a warning."""
        html = '<html><div>react</div></html>'
        result = validate_lab_html(html)
        assert result["fatal"] is None
        assert any("short" in w for w in result["warnings"])


class TestLabReviewerAgent:
    def test_review_returns_fixed_html(self):
        """Reviewer returns fixed HTML from LLM."""
        fixed_html = (
            "<!DOCTYPE html><html><head></head><body>"
            "<div id='root'>fixed content</div></body></html>"
        )
        llm = _make_llm_mock(fixed_html)
        reviewer = LabReviewerAgent(llm=llm)
        result = reviewer.review(VALID_HTML, design=json.loads(VALID_DESIGN))
        assert "<html" in result
        assert "fixed content" in result

    def test_review_strips_markdown_fences(self):
        """Reviewer strips markdown code fences from LLM output."""
        fenced = "```html\n" + VALID_HTML + "\n```"
        llm = _make_llm_mock(fenced)
        reviewer = LabReviewerAgent(llm=llm)
        result = reviewer.review(VALID_HTML)
        assert not result.startswith("```")
        assert "<html" in result

    def test_review_keeps_original_on_invalid_output(self):
        """If reviewer returns non-HTML, keep original."""
        llm = _make_llm_mock("Here are the bugs I found...")
        reviewer = LabReviewerAgent(llm=llm)
        result = reviewer.review(VALID_HTML)
        assert result == VALID_HTML

    def test_review_keeps_original_on_short_output(self):
        """If reviewer output is suspiciously short, keep original."""
        short_html = "<html><div>x</div></html>"
        llm = _make_llm_mock(short_html)
        reviewer = LabReviewerAgent(llm=llm)
        result = reviewer.review(VALID_HTML)
        assert result == VALID_HTML

    def test_review_keeps_original_on_exception(self):
        """If LLM raises, return original HTML."""
        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=RuntimeError("LLM error"))
        reviewer = LabReviewerAgent(llm=llm)
        result = reviewer.review(VALID_HTML)
        assert result == VALID_HTML

    def test_review_empty_html_passthrough(self):
        """Empty HTML is returned as-is without calling LLM."""
        llm = _make_llm_mock("should not be called")
        reviewer = LabReviewerAgent(llm=llm)
        result = reviewer.review("")
        assert result == ""
        llm.invoke.assert_not_called()

    def test_review_without_design_context(self):
        """Review works without design context."""
        llm = _make_llm_mock(VALID_HTML)
        reviewer = LabReviewerAgent(llm=llm)
        result = reviewer.review(VALID_HTML, design=None)
        assert "<html" in result

    def test_review_prompt_includes_design_context(self):
        """Design context is included in the review prompt."""
        llm = _make_llm_mock(VALID_HTML)
        reviewer = LabReviewerAgent(llm=llm)
        design = json.loads(VALID_DESIGN)
        reviewer.review(VALID_HTML, design=design)
        prompt_text = llm.invoke.call_args[0][0][1].content
        assert "树叶分类小能手" in prompt_text
        assert "drag_classify" in prompt_text
