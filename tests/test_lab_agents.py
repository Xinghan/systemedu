"""Tests for the 4-Agent lab pipeline: LabAnalyst, LabDesigner, LabCoder, LabReviewer."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from systemedu.agents.builtin.lab_analyst import LabAnalystAgent
from systemedu.agents.builtin.lab_designer import LabDesignerAgent
from systemedu.agents.builtin.lab_coder import LabCoderAgent, validate_lab_html
from systemedu.agents.builtin.lab_reviewer import LabReviewerAgent
from systemedu.education.lesson_generator import _generate_interactive_lab


def _make_agent_mock(response: str) -> MagicMock:
    """Create a mock deep agent returning the given response."""
    mock_agent = MagicMock()
    mock_agent.ainvoke = AsyncMock(return_value={
        "messages": [AIMessage(content=response)]
    })
    return mock_agent


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
    @pytest.mark.asyncio
    async def test_analyze_success(self):
        mock_agent = _make_agent_mock(VALID_ANALYSIS)
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("树叶分类", "学习分类", 3)
        assert result is not None
        assert result["best_interaction"] == "drag_classify"
        assert len(result["interactive_objects"]) == 4

    @pytest.mark.asyncio
    async def test_analyze_with_lesson_plan(self):
        """Lesson plan guidance is injected into the prompt."""
        mock_agent = _make_agent_mock(VALID_ANALYSIS)
        plan = {
            "lab_strategy": {
                "interaction_type": "cause_effect",
                "interaction_rationale": "火箭发射适合因果操作",
                "game_theme": "调节参数发射火箭",
                "item_count": 4,
            }
        }
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("火箭发射", "学习火箭", 5, lesson_plan=plan)
        assert result is not None
        # Check ainvoke was called with a prompt containing plan guidance
        call_args = mock_agent.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "策划师指引" in prompt_text
        assert "cause_effect" in prompt_text

    @pytest.mark.asyncio
    async def test_analyze_without_lesson_plan(self):
        """Works fine without lesson plan."""
        mock_agent = _make_agent_mock(VALID_ANALYSIS)
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("Test", "Summary", 3, lesson_plan=None)
        assert result is not None
        call_args = mock_agent.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "策划师指引" not in prompt_text

    @pytest.mark.asyncio
    async def test_invalid_interaction_defaults(self):
        """Invalid interaction type defaults to drag_classify."""
        analysis = json.loads(VALID_ANALYSIS)
        analysis["best_interaction"] = "unknown_type"
        mock_agent = _make_agent_mock(json.dumps(analysis, ensure_ascii=False))
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("Test", "Summary", 3)
        assert result["best_interaction"] == "drag_classify"

    @pytest.mark.asyncio
    async def test_analyze_click_select(self):
        """Analyst returns valid click_select analysis."""
        mock_agent = _make_agent_mock(CLICK_SELECT_ANALYSIS)
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("识别哺乳动物", "根据特征识别", 3)
        assert result is not None
        assert result["best_interaction"] == "click_select"
        assert "questions" in result

    @pytest.mark.asyncio
    async def test_analyze_drag_sort(self):
        """Analyst returns valid drag_sort analysis."""
        mock_agent = _make_agent_mock(DRAG_SORT_ANALYSIS)
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("食物链", "排序食物链", 5)
        assert result is not None
        assert result["best_interaction"] == "drag_sort"
        assert "sortable_items" in result
        assert "sort_criteria" in result

    @pytest.mark.asyncio
    async def test_analyze_connect_match(self):
        """Analyst returns valid connect_match analysis."""
        mock_agent = _make_agent_mock(CONNECT_MATCH_ANALYSIS)
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("动物栖息地", "配对动物和栖息地", 4)
        assert result is not None
        assert result["best_interaction"] == "connect_match"
        assert "left_items" in result
        assert "right_items" in result

    @pytest.mark.asyncio
    async def test_analyze_cause_effect(self):
        """Analyst returns valid cause_effect analysis."""
        mock_agent = _make_agent_mock(CAUSE_EFFECT_ANALYSIS)
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("火箭发射", "燃料与高度", 7)
        assert result is not None
        assert result["best_interaction"] == "cause_effect"
        assert "controls" in result
        assert "effects" in result

    @pytest.mark.asyncio
    async def test_analyze_missing_type_fields_returns_none(self):
        """Analyst returns None if type-specific fields are missing."""
        bad = {"topic": "T", "core_concept": "C", "best_interaction": "click_select", "learning_goal": "G"}
        mock_agent = _make_agent_mock(json.dumps(bad))
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("T", "S", 3)
        assert result is None


class TestLabDesignerAgent:
    @pytest.mark.asyncio
    async def test_design_success(self):
        analysis = json.loads(VALID_ANALYSIS)
        mock_agent = _make_agent_mock(VALID_DESIGN)
        with patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_agent):
            designer = LabDesignerAgent(llm=MagicMock())
            result = await designer.design(analysis, 3)
        assert result is not None
        assert result["game_title"] == "树叶分类小能手"
        assert len(result["items"]) >= 1

    @pytest.mark.asyncio
    async def test_design_click_select(self):
        """Designer handles click_select analysis."""
        analysis = json.loads(CLICK_SELECT_ANALYSIS)
        mock_agent = _make_agent_mock(CLICK_SELECT_DESIGN)
        with patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_agent):
            designer = LabDesignerAgent(llm=MagicMock())
            result = await designer.design(analysis, 3)
        assert result is not None
        assert result["interaction_type"] == "click_select"
        assert "questions" in result

    @pytest.mark.asyncio
    async def test_design_invalid_json(self):
        mock_agent = _make_agent_mock("not json")
        with patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_agent):
            designer = LabDesignerAgent(llm=MagicMock())
            result = await designer.design(json.loads(VALID_ANALYSIS), 3)
        assert result is None


class TestLabCoderAgent:
    @pytest.mark.asyncio
    async def test_generate_success(self):
        design = json.loads(VALID_DESIGN)
        mock_agent = _make_agent_mock(VALID_HTML)
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            coder = LabCoderAgent(llm=MagicMock())
            result = await coder.generate(design, 3)
        assert "<html" in result
        assert "react" in result.lower()

    @pytest.mark.asyncio
    async def test_generate_invalid_html(self):
        mock_agent = _make_agent_mock("just plain text")
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            coder = LabCoderAgent(llm=MagicMock())
            result = await coder.generate(json.loads(VALID_DESIGN), 3)
        assert result == ""


class TestLabPipeline:
    @pytest.mark.asyncio
    async def test_full_pipeline_success(self):
        """Full 4-agent pipeline produces HTML."""
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
            result = await _generate_interactive_lab("树叶分类", "学习分类", 3, MagicMock())
        assert "<html" in result

    @pytest.mark.asyncio
    async def test_pipeline_with_lesson_plan(self):
        """Pipeline passes lesson plan to analyst."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock(VALID_DESIGN)
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        plan = {"lab_strategy": {"interaction_type": "drag_classify"}}
        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock(), lesson_plan=plan)
        assert "<html" in result
        # Analyst ainvoke was called with plan guidance in prompt
        call_args = mock_analyst.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "策划师指引" in prompt_text

    @pytest.mark.asyncio
    async def test_pipeline_analyst_failure(self):
        """If analyst fails, pipeline returns empty."""
        mock_analyst = _make_agent_mock("not valid json")
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_pipeline_designer_failure(self):
        """If designer fails, pipeline returns empty."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock("not json")
        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
        ):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_pipeline_progress_callback(self):
        """Progress callback is invoked for each stage including reviewer."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock(VALID_DESIGN)
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        callbacks = []

        def callback(step, status, preview):
            callbacks.append((step, status))

        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            await _generate_interactive_lab("Test", "Summary", 3, MagicMock(), progress_callback=callback)

        step_names = [c[0] for c in callbacks]
        assert "lab_analyst" in step_names
        assert "lab_designer" in step_names
        assert "lab_coder" in step_names
        assert "lab_reviewer" in step_names
        assert ("lab_analyst", "in_progress") in callbacks
        assert ("lab_analyst", "completed") in callbacks
        assert ("lab_reviewer", "in_progress") in callbacks
        assert ("lab_reviewer", "completed") in callbacks

    @pytest.mark.asyncio
    async def test_pipeline_progress_callback_on_failure(self):
        """Progress callback reports failure when analyst fails."""
        mock_analyst = _make_agent_mock("not json")
        callbacks = []

        def callback(step, status, preview):
            callbacks.append((step, status))

        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst):
            await _generate_interactive_lab("Test", "Summary", 3, MagicMock(), progress_callback=callback)

        assert ("lab_analyst", "failed") in callbacks

    @pytest.mark.asyncio
    async def test_pipeline_retry_on_analyst_failure(self):
        """Pipeline retries analyst once before failing."""
        # First call returns invalid, second returns valid
        mock_analyst_bad = _make_agent_mock("not json")
        mock_analyst_good = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock(VALID_DESIGN)
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)

        call_count = {"n": 0}
        original_create = None

        def analyst_side_effect(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return mock_analyst_bad
            return mock_analyst_good

        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", side_effect=analyst_side_effect),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert "<html" in result
        assert call_count["n"] == 2  # analyst called twice

    @pytest.mark.asyncio
    async def test_pipeline_retry_on_designer_failure(self):
        """Pipeline retries designer once before failing."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer_bad = _make_agent_mock("not json")
        mock_designer_good = _make_agent_mock(VALID_DESIGN)
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)

        call_count = {"n": 0}

        def designer_side_effect(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return mock_designer_bad
            return mock_designer_good

        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", side_effect=designer_side_effect),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert "<html" in result
        assert call_count["n"] == 2

    @pytest.mark.asyncio
    async def test_pipeline_retry_on_coder_failure(self):
        """Pipeline retries coder once before failing."""
        mock_analyst = _make_agent_mock(VALID_ANALYSIS)
        mock_designer = _make_agent_mock(VALID_DESIGN)
        mock_coder_bad = _make_agent_mock("not html")
        mock_coder_good = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)

        call_count = {"n": 0}

        def coder_side_effect(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return mock_coder_bad
            return mock_coder_good

        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", side_effect=coder_side_effect),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert "<html" in result
        assert call_count["n"] == 2

    @pytest.mark.asyncio
    async def test_pipeline_click_select(self):
        """Pipeline works with click_select interaction type."""
        mock_analyst = _make_agent_mock(CLICK_SELECT_ANALYSIS)
        mock_designer = _make_agent_mock(CLICK_SELECT_DESIGN)
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("识别哺乳动物", "识别特征", 3, MagicMock())
        assert "<html" in result


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
    @pytest.mark.asyncio
    async def test_review_returns_fixed_html(self):
        """Reviewer returns fixed HTML from LLM."""
        fixed_html = (
            "<!DOCTYPE html><html><head></head><body>"
            "<div id='root'>fixed content</div></body></html>"
        )
        mock_agent = _make_agent_mock(fixed_html)
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            result = await reviewer.review(VALID_HTML, design=json.loads(VALID_DESIGN))
        assert "<html" in result
        assert "fixed content" in result

    @pytest.mark.asyncio
    async def test_review_strips_markdown_fences(self):
        """Reviewer strips markdown code fences from LLM output."""
        fenced = "```html\n" + VALID_HTML + "\n```"
        mock_agent = _make_agent_mock(fenced)
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            result = await reviewer.review(VALID_HTML)
        assert not result.startswith("```")
        assert "<html" in result

    @pytest.mark.asyncio
    async def test_review_keeps_original_on_invalid_output(self):
        """If reviewer returns non-HTML, keep original."""
        mock_agent = _make_agent_mock("Here are the bugs I found...")
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            result = await reviewer.review(VALID_HTML)
        assert result == VALID_HTML

    @pytest.mark.asyncio
    async def test_review_keeps_original_on_short_output(self):
        """If reviewer output is suspiciously short, keep original."""
        short_html = "<html><div>x</div></html>"
        mock_agent = _make_agent_mock(short_html)
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            result = await reviewer.review(VALID_HTML)
        assert result == VALID_HTML

    @pytest.mark.asyncio
    async def test_review_keeps_original_on_exception(self):
        """If LLM raises, return original HTML."""
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(side_effect=RuntimeError("LLM error"))
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            result = await reviewer.review(VALID_HTML)
        assert result == VALID_HTML

    @pytest.mark.asyncio
    async def test_review_empty_html_passthrough(self):
        """Empty HTML is returned as-is without calling LLM."""
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent") as mock_create:
            reviewer = LabReviewerAgent(llm=MagicMock())
            result = await reviewer.review("")
        assert result == ""
        mock_create.assert_not_called()

    @pytest.mark.asyncio
    async def test_review_without_design_context(self):
        """Review works without design context."""
        mock_agent = _make_agent_mock(VALID_HTML)
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            result = await reviewer.review(VALID_HTML, design=None)
        assert "<html" in result

    @pytest.mark.asyncio
    async def test_review_prompt_includes_design_context(self):
        """Design context is included in the review prompt."""
        mock_agent = _make_agent_mock(VALID_HTML)
        design = json.loads(VALID_DESIGN)
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            await reviewer.review(VALID_HTML, design=design)
        call_args = mock_agent.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "树叶分类小能手" in prompt_text
        assert "drag_classify" in prompt_text

    @pytest.mark.asyncio
    async def test_review_prompt_includes_interaction_type(self):
        """Review prompt mentions interaction type for type-specific checks."""
        mock_agent = _make_agent_mock(VALID_HTML)
        design = json.loads(CLICK_SELECT_DESIGN)
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            await reviewer.review(VALID_HTML, design=design)
        call_args = mock_agent.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "click_select" in prompt_text


ANIMATED_STORY_ANALYSIS = json.dumps({
    "topic": "认识地址栏与搜索框",
    "core_concept": "地址栏用来输入网址，搜索框用来搜索内容",
    "best_interaction": "animated_story",
    "scene_description": "一个浏览器窗口，顶部有地址栏和搜索框，底部有一个卡通小人",
    "characters": [
        {"id": "char1", "name": "小明", "description": "圆头卡通小人，蓝色身体"}
    ],
    "animation_steps": [
        {
            "step": 1,
            "narration": "这是浏览器的地址栏，输入网址可以直接跳转",
            "action": "小明走到地址栏下方，地址栏发蓝色光晕",
            "highlight": "地址栏",
            "duration_ms": 2000,
        },
        {
            "step": 2,
            "narration": "这是搜索框，输入关键词可以搜索信息",
            "action": "小明走向搜索框，搜索框发橙色光晕",
            "highlight": "搜索框",
            "duration_ms": 2000,
        },
    ],
    "interactive_prompt": "点击「继续」跟着小明一起认识浏览器",
    "learning_goal": "区分地址栏和搜索框的用途",
}, ensure_ascii=False)

ANIMATED_STORY_DESIGN = json.dumps({
    "game_title": "跟小明认识浏览器",
    "interaction_type": "animated_story",
    "layout": "上方SVG场景区，下方旁白区+继续按钮",
    "background_color": "linear-gradient(135deg, #EEF2FF, #F0FDF4)",
    "scene": {
        "width": 760,
        "height": 320,
        "description": "浏览器窗口场景",
        "elements": [
            {"id": "addr-bar", "name": "地址栏", "type": "rect", "x": 80, "y": 40,
             "width": 400, "height": 36, "fill": "#FFFFFF", "stroke": "#CBD5E1", "rx": 8, "label": "地址栏"},
        ],
    },
    "characters": [
        {"id": "char1", "name": "小明", "start_x": 30, "start_y": 240,
         "svg_description": "圆形头部填充#FCD34D，矩形身体填充#4F8EF7，宽30px高50px"},
    ],
    "animation_steps": [
        {
            "step": 1,
            "narration": "这是浏览器的地址栏，输入网址可以直接跳转",
            "actions": [
                {"target": "char1", "type": "move", "to_x": 120, "to_y": 240, "duration_ms": 1000},
                {"target": "addr-bar", "type": "highlight", "color": "#4F8EF7", "glow": True, "duration_ms": 800},
            ],
            "label_popup": {"text": "地址栏", "point_to": "addr-bar", "color": "#4F8EF7"},
        },
    ],
    "narration_style": {"font_size": 16, "color": "#1E293B", "background": "#FFFFFF"},
    "continue_button": {"label": "继续", "color": "#4F8EF7"},
    "animations": {
        "character_walk": "小人水平移动",
        "highlight_glow": "box-shadow脉冲动画",
        "scene_complete": "彩色圆点飘落",
    },
    "scoring": {"type": "progress", "total_steps": 2, "encouragement": "太棒了！"},
    "instructions": "点击继续跟着小明认识浏览器",
}, ensure_ascii=False)

ANIMATED_STORY_HTML = (
    '<!DOCTYPE html><html><head>'
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>'
    '<style>body{margin:0;} @keyframes float{0%{opacity:1}100%{opacity:0}} @keyframes walk{} </style>'
    '</head><body>'
    '<svg id="scene-area" viewBox="0 0 760 320"><rect id="addr-bar" x="80" y="40" width="400" height="36"/>'
    '<g id="char1"><circle cx="45" cy="15" r="15" fill="#FCD34D"/></g></svg>'
    '<div id="progress">第 1 / 2 步</div>'
    '<div id="narration">点击继续开始</div>'
    '<button id="continue-btn" onClick="nextStep()">继续</button>'
    '<script>const steps=[{narration:"地址栏",run:()=>{anime({targets:"#char1",translateX:90,duration:1000});}},{narration:"完成",run:()=>{}}];'
    'let cur=0; function nextStep(){if(cur<steps.length){document.getElementById("narration").textContent=steps[cur].narration;steps[cur].run();cur++;}}</script>'
    '</body></html>'
)


class TestAnimatedStoryMode:
    @pytest.mark.asyncio
    async def test_analyst_accepts_animated_story(self):
        """LabAnalystAgent accepts animated_story as a valid interaction type."""
        mock_agent = _make_agent_mock(ANIMATED_STORY_ANALYSIS)
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("认识地址栏与搜索框", "区分地址栏和搜索框", 2)
        assert result is not None
        assert result["best_interaction"] == "animated_story"
        assert "scene_description" in result
        assert "animation_steps" in result

    @pytest.mark.asyncio
    async def test_analyst_animated_story_missing_steps_returns_none(self):
        """Analyst returns None if animated_story is missing animation_steps."""
        bad = json.dumps({
            "topic": "认识地址栏",
            "core_concept": "地址栏用途",
            "best_interaction": "animated_story",
            "scene_description": "浏览器窗口",
            "learning_goal": "认识地址栏",
            # missing animation_steps
        }, ensure_ascii=False)
        mock_agent = _make_agent_mock(bad)
        with patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_agent):
            analyst = LabAnalystAgent(llm=MagicMock())
            result = await analyst.analyze("认识地址栏", "了解地址栏", 2)
        assert result is None

    @pytest.mark.asyncio
    async def test_pipeline_animated_story_end_to_end(self):
        """Full pipeline works with animated_story interaction type."""
        mock_analyst = _make_agent_mock(ANIMATED_STORY_ANALYSIS)
        mock_designer = _make_agent_mock(ANIMATED_STORY_DESIGN)
        mock_coder = _make_agent_mock(ANIMATED_STORY_HTML)
        mock_reviewer = _make_agent_mock(ANIMATED_STORY_HTML)
        with (
            patch("systemedu.agents.builtin.lab_analyst.create_deep_agent", return_value=mock_analyst),
            patch("systemedu.agents.builtin.lab_designer.create_deep_agent", return_value=mock_designer),
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("认识地址栏与搜索框", "区分地址栏和搜索框", 2, MagicMock())
        assert "<html" in result
        assert "anime" in result

    def test_validate_animated_story_warns_no_anime(self):
        """Validator warns if animated_story HTML lacks anime.js."""
        html = '<html><div>react onClick step</div></html>'
        result = validate_lab_html(html, interaction_type="animated_story")
        assert any("anime" in w.lower() for w in result["warnings"])

    def test_validate_animated_story_no_drag_warning(self):
        """animated_story HTML should NOT warn about missing draggable."""
        html = (
            '<!DOCTYPE html><html><head>'
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>'
            '<style>@keyframes float{} @keyframes walk{}</style>'
            '</head><body><div id="root"></div>'
            '<svg><rect/></svg>'
            '<script>const steps=[]; let cur=0; document.querySelector("button").onclick=()=>{};</script>'
            '</body></html>'
        )
        result = validate_lab_html(html, interaction_type="animated_story")
        assert not any("draggable" in w.lower() or "onDragStart" in w for w in result["warnings"])
