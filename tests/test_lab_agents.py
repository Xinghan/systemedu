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

CLICK_SELECT_ANALYSIS = json.dumps({
    "topic": "识别哺乳动物",
    "core_concept": "根据特征识别哺乳动物",
    "best_interaction": "click_select",
    "questions": [
        {
            "prompt": "下面哪个是哺乳动物？",
            "options": [
                {"label": "猫", "is_correct": True, "svg_hint": "橙色猫咪"},
                {"label": "金鱼", "is_correct": False, "svg_hint": "红色金鱼"},
                {"label": "蜥蜴", "is_correct": False, "svg_hint": "绿色蜥蜴"},
            ],
        }
    ],
    "learning_goal": "识别常见哺乳动物",
}, ensure_ascii=False)

CLICK_SELECT_DESIGN = json.dumps({
    "game_title": "找出哺乳动物",
    "interaction_type": "click_select",
    "layout": "题目+选项卡片",
    "background_color": "#FFF8E1",
    "questions": [
        {
            "id": "q1",
            "prompt": "哪个是哺乳动物？",
            "options": [
                {"id": "q1_a", "label": "猫", "svg_description": "橙色猫", "is_correct": True},
                {"id": "q1_b", "label": "金鱼", "svg_description": "红色鱼", "is_correct": False},
            ],
        }
    ],
    "animations": {"option_hover": "scale(1.05)", "correct_select": "绿色边框", "wrong_select": "shake", "all_complete": "confetti"},
    "scoring": {"correct_points": 10, "wrong_penalty": -5, "total_items": 1, "perfect_score": 10,
                "encouragement": {"perfect": "满分！", "good": "不错！", "try_again": "加油！"}},
    "instructions": "点击选出正确答案",
}, ensure_ascii=False)

DRAG_SORT_ANALYSIS = json.dumps({
    "topic": "食物链排序",
    "core_concept": "按食物链顺序排列",
    "best_interaction": "drag_sort",
    "sortable_items": [
        {"label": "草", "correct_position": 1, "svg_hint": "绿色草"},
        {"label": "兔子", "correct_position": 2, "svg_hint": "白色兔子"},
        {"label": "狐狸", "correct_position": 3, "svg_hint": "橙色狐狸"},
        {"label": "老鹰", "correct_position": 4, "svg_hint": "棕色老鹰"},
    ],
    "sort_criteria": "从低到高排列食物链",
    "learning_goal": "理解食物链层级",
}, ensure_ascii=False)

CONNECT_MATCH_ANALYSIS = json.dumps({
    "topic": "动物与栖息地",
    "core_concept": "将动物与其栖息地配对",
    "best_interaction": "connect_match",
    "left_items": [
        {"id": "l1", "label": "企鹅", "svg_hint": "黑白企鹅"},
        {"id": "l2", "label": "骆驼", "svg_hint": "棕色骆驼"},
    ],
    "right_items": [
        {"id": "r1", "label": "南极", "match_id": "l1", "svg_hint": "冰川"},
        {"id": "r2", "label": "沙漠", "match_id": "l2", "svg_hint": "沙丘"},
    ],
    "learning_goal": "了解动物与栖息地的关系",
}, ensure_ascii=False)

CAUSE_EFFECT_ANALYSIS = json.dumps({
    "topic": "火箭发射",
    "core_concept": "燃料量影响飞行高度",
    "best_interaction": "cause_effect",
    "controls": [
        {"id": "ctrl1", "label": "燃料量", "type": "slider", "min": 0, "max": 100, "default": 50, "unit": "升"}
    ],
    "effects": [
        {"id": "eff1", "label": "飞行高度", "depends_on": ["ctrl1"], "formula_hint": "燃料越多飞越高"}
    ],
    "cause_effect_pairs": [
        {"cause": "增加燃料", "effect": "飞行高度增加"}
    ],
    "learning_goal": "理解燃料与飞行高度的关系",
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

    def test_analyze_click_select(self):
        """Analyst returns valid click_select analysis."""
        llm = _make_llm_mock(CLICK_SELECT_ANALYSIS)
        analyst = LabAnalystAgent(llm=llm)
        result = analyst.analyze("识别哺乳动物", "根据特征识别", 3)
        assert result is not None
        assert result["best_interaction"] == "click_select"
        assert "questions" in result

    def test_analyze_drag_sort(self):
        """Analyst returns valid drag_sort analysis."""
        llm = _make_llm_mock(DRAG_SORT_ANALYSIS)
        analyst = LabAnalystAgent(llm=llm)
        result = analyst.analyze("食物链", "排序食物链", 5)
        assert result is not None
        assert result["best_interaction"] == "drag_sort"
        assert "sortable_items" in result
        assert "sort_criteria" in result

    def test_analyze_connect_match(self):
        """Analyst returns valid connect_match analysis."""
        llm = _make_llm_mock(CONNECT_MATCH_ANALYSIS)
        analyst = LabAnalystAgent(llm=llm)
        result = analyst.analyze("动物栖息地", "配对动物和栖息地", 4)
        assert result is not None
        assert result["best_interaction"] == "connect_match"
        assert "left_items" in result
        assert "right_items" in result

    def test_analyze_cause_effect(self):
        """Analyst returns valid cause_effect analysis."""
        llm = _make_llm_mock(CAUSE_EFFECT_ANALYSIS)
        analyst = LabAnalystAgent(llm=llm)
        result = analyst.analyze("火箭发射", "燃料与高度", 7)
        assert result is not None
        assert result["best_interaction"] == "cause_effect"
        assert "controls" in result
        assert "effects" in result

    def test_analyze_missing_type_fields_returns_none(self):
        """Analyst returns None if type-specific fields are missing."""
        # click_select without 'questions'
        bad = {"topic": "T", "core_concept": "C", "best_interaction": "click_select", "learning_goal": "G"}
        llm = _make_llm_mock(json.dumps(bad))
        analyst = LabAnalystAgent(llm=llm)
        result = analyst.analyze("T", "S", 3)
        assert result is None


class TestLabDesignerAgent:
    def test_design_success(self):
        analysis = json.loads(VALID_ANALYSIS)
        llm = _make_llm_mock(VALID_DESIGN)
        designer = LabDesignerAgent(llm=llm)
        result = designer.design(analysis, 3)
        assert result is not None
        assert result["game_title"] == "树叶分类小能手"
        assert len(result["items"]) >= 1

    def test_design_click_select(self):
        """Designer handles click_select analysis."""
        analysis = json.loads(CLICK_SELECT_ANALYSIS)
        llm = _make_llm_mock(CLICK_SELECT_DESIGN)
        designer = LabDesignerAgent(llm=llm)
        result = designer.design(analysis, 3)
        assert result is not None
        assert result["interaction_type"] == "click_select"
        assert "questions" in result

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

    def test_pipeline_click_select(self):
        """Pipeline works with click_select interaction type."""
        llm = _make_multi_llm_mock([CLICK_SELECT_ANALYSIS, CLICK_SELECT_DESIGN, VALID_HTML, VALID_HTML])
        result = _generate_interactive_lab("识别哺乳动物", "识别特征", 3, llm)
        assert "<html" in result
        assert llm.invoke.call_count == 4


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

    def test_click_select_no_drag_warning(self):
        """click_select HTML should NOT warn about missing draggable."""
        padding = "/* " + "x" * 500 + " */"
        html = (
            '<!DOCTYPE html><html><head>'
            '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
            '<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>'
            '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>'
            f'<style>@keyframes fadeIn {{}} @keyframes shake {{}} {padding}</style>'
            '</head><body><div id="root"></div>'
            '<script type="text/babel">'
            'const App = () => { const [s, setS] = React.useState(0);'
            ' return <div onClick={() => setS(1)}><svg><circle/></svg></div>; };'
            'ReactDOM.createRoot(document.getElementById("root")).render(<App/>);'
            '</script></body></html>'
        )
        result = validate_lab_html(html, interaction_type="click_select")
        assert result["fatal"] is None
        assert not any("draggable" in w.lower() or "onDragStart" in w for w in result["warnings"])

    def test_drag_classify_warns_no_draggable(self):
        """drag_classify HTML should warn about missing draggable."""
        html = (
            '<html><div>react onClick</div></html>'
        )
        result = validate_lab_html(html, interaction_type="drag_classify")
        assert any("draggable" in w.lower() or "onDragStart" in w for w in result["warnings"])

    def test_cause_effect_no_drag_warning(self):
        """cause_effect HTML should NOT warn about missing draggable."""
        padding = "/* " + "x" * 500 + " */"
        html = (
            '<!DOCTYPE html><html><head>'
            '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
            '<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>'
            '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>'
            f'<style>@keyframes fadeIn {{}} @keyframes pulse {{}} {padding}</style>'
            '</head><body><div id="root"></div>'
            '<script type="text/babel">'
            'const App = () => { const [v, setV] = React.useState(50);'
            ' return <div><input type="range" onChange={(e) => setV(+e.target.value)}/><svg><rect/></svg></div>; };'
            'ReactDOM.createRoot(document.getElementById("root")).render(<App/>);'
            '</script></body></html>'
        )
        result = validate_lab_html(html, interaction_type="cause_effect")
        assert result["fatal"] is None
        assert not any("draggable" in w.lower() or "onDragStart" in w for w in result["warnings"])


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

    def test_review_prompt_includes_interaction_type(self):
        """Review prompt mentions interaction type for type-specific checks."""
        llm = _make_llm_mock(VALID_HTML)
        reviewer = LabReviewerAgent(llm=llm)
        design = json.loads(CLICK_SELECT_DESIGN)
        reviewer.review(VALID_HTML, design=design)
        prompt_text = llm.invoke.call_args[0][0][1].content
        assert "click_select" in prompt_text
