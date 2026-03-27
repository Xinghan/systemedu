"""Tests for the 2-Agent lab pipeline: LabCoder, LabReviewer."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

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


VALID_HTML = (
    "<!DOCTYPE html><html><head>"
    '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>'
    "</head><body><div id='root'></div></body></html>"
)

VALID_LAB_STRATEGY = {
    "game_concept": "用户调节燃料滑块和推力滑块，点击发射按钮，右侧实时显示火箭飞行轨迹和高度",
    "game_mechanic": "simulation",
    "learning_connection": "通过参数调节直接感受变量对结果的影响",
}


class TestLabCoderAgent:
    @pytest.mark.asyncio
    async def test_generate_success(self):
        """Coder returns HTML from game concept."""
        mock_agent = _make_agent_mock(VALID_HTML)
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            coder = LabCoderAgent(llm=MagicMock())
            result = await coder.generate("火箭发射", "了解燃料与高度的关系", 5, VALID_LAB_STRATEGY)
        assert "<html" in result
        assert "react" in result.lower()

    @pytest.mark.asyncio
    async def test_generate_game_concept_in_prompt(self):
        """game_concept from lab_strategy appears in the prompt sent to LLM."""
        mock_agent = _make_agent_mock(VALID_HTML)
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            coder = LabCoderAgent(llm=MagicMock())
            await coder.generate("火箭发射", "了解燃料", 5, VALID_LAB_STRATEGY)
        call_args = mock_agent.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "用户调节燃料滑块" in prompt_text
        assert "simulation" in prompt_text

    @pytest.mark.asyncio
    async def test_generate_invalid_html_returns_empty(self):
        """Non-HTML output returns empty string."""
        mock_agent = _make_agent_mock("just plain text")
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            coder = LabCoderAgent(llm=MagicMock())
            result = await coder.generate("Test", "Summary", 3, {})
        assert result == ""

    @pytest.mark.asyncio
    async def test_generate_strips_markdown_fences(self):
        """Coder strips markdown code fences from output."""
        fenced = "```html\n" + VALID_HTML + "\n```"
        mock_agent = _make_agent_mock(fenced)
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            coder = LabCoderAgent(llm=MagicMock())
            result = await coder.generate("Test", "Summary", 3, {})
        assert not result.startswith("```")
        assert "<html" in result

    @pytest.mark.asyncio
    async def test_generate_strips_preamble(self):
        """Coder strips text before <!DOCTYPE html>."""
        with_preamble = "Here is the HTML code:\n\n" + VALID_HTML
        mock_agent = _make_agent_mock(with_preamble)
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            coder = LabCoderAgent(llm=MagicMock())
            result = await coder.generate("Test", "Summary", 3, {})
        assert result.startswith("<!DOCTYPE html")

    @pytest.mark.asyncio
    async def test_generate_empty_lab_strategy(self):
        """Coder works with empty lab_strategy dict."""
        mock_agent = _make_agent_mock(VALID_HTML)
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            coder = LabCoderAgent(llm=MagicMock())
            result = await coder.generate("Test", "Summary", 3, {})
        assert "<html" in result


def _make_simulation_spec_json() -> str:
    from systemedu.agents.builtin.gameagent.spec import GameFeedback, GameLevel, GameRules, GameSpec
    spec = GameSpec(
        mechanic="simulation",
        topic="火箭发射",
        theme="参数模拟",
        difficulty=5,
        entities=[
            {"id": "p1", "param_name": "fuel", "label": "燃料", "min": 0, "max": 100, "default": 30, "unit": "%", "effect_key": "height"},
            {"id": "p2", "param_name": "thrust", "label": "推力", "min": 0, "max": 100, "default": 20, "unit": "kN", "effect_key": "height"},
            {"id": "p3", "param_name": "angle", "label": "角度", "min": 0, "max": 90, "default": 45, "unit": "°", "effect_key": "height"},
        ],
        target_condition="调高参数使火箭飞行高度超过 70%",
        visual_description="火箭高度实时曲线",
        rules=GameRules(),
        levels=[GameLevel(prompt="调节参数，观察飞行高度变化")],
        feedback=GameFeedback(),
    )
    return spec.model_dump_json()


class TestLabPipeline:
    @pytest.mark.asyncio
    async def test_full_pipeline_success(self):
        """GameAgent pipeline produces HTML with GAME_SPEC."""
        spec_json = _make_simulation_spec_json()
        mock_agent = _make_agent_mock(spec_json)
        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            result = await _generate_interactive_lab("火箭发射", "学习火箭原理", 5, MagicMock())
        assert "const SPEC =" in result
        assert "__GAME_SPEC__" not in result

    @pytest.mark.asyncio
    async def test_pipeline_planner_failure_returns_empty(self):
        """If planner returns invalid output, pipeline returns empty."""
        mock_agent = _make_agent_mock("not json")
        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_pipeline_progress_callback(self):
        """Progress callback is invoked for game_spec_planner and game_compiler."""
        spec_json = _make_simulation_spec_json()
        mock_agent = _make_agent_mock(spec_json)
        callbacks = []

        def callback(step, status, preview):
            callbacks.append((step, status))

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            await _generate_interactive_lab("Test", "Summary", 3, MagicMock(), progress_callback=callback)

        step_names = [c[0] for c in callbacks]
        assert "game_spec_planner" in step_names
        assert "game_compiler" in step_names
        assert ("game_spec_planner", "in_progress") in callbacks
        assert ("game_spec_planner", "completed") in callbacks
        assert ("game_compiler", "completed") in callbacks
        # Old lab agent steps should NOT appear
        assert not any(s in step_names for s in ("lab_coder", "lab_reviewer"))

    @pytest.mark.asyncio
    async def test_pipeline_retry_on_coder_failure(self):
        """When planner fails first time, second call succeeds."""
        spec_json = _make_simulation_spec_json()
        mock_agent_bad = _make_agent_mock("not json")
        mock_agent_good = _make_agent_mock(spec_json)

        call_count = {"n": 0}

        def planner_side_effect(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return mock_agent_bad
            return mock_agent_good

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", side_effect=planner_side_effect):
            # First call fails (planner returns bad), so result is empty
            result1 = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert result1 == ""

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent_good):
            # Second call succeeds
            result2 = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert "const SPEC =" in result2


class TestValidateLabHtml:
    def test_valid_html(self):
        """Complete HTML passes validation."""
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

    def test_no_interaction_type_param(self):
        """validate_lab_html works without interaction_type parameter."""
        html = '<html><div>react onClick</div></html>'
        result = validate_lab_html(html)
        assert result is not None
        assert "fatal" in result
        assert "warnings" in result


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
            result = await reviewer.review(VALID_HTML, lab_strategy=VALID_LAB_STRATEGY)
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
    async def test_review_without_lab_strategy(self):
        """Review works without lab_strategy context."""
        mock_agent = _make_agent_mock(VALID_HTML)
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            result = await reviewer.review(VALID_HTML, lab_strategy=None)
        assert "<html" in result

    @pytest.mark.asyncio
    async def test_review_prompt_includes_game_concept(self):
        """game_concept is included in the review prompt."""
        mock_agent = _make_agent_mock(VALID_HTML)
        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            reviewer = LabReviewerAgent(llm=MagicMock())
            await reviewer.review(VALID_HTML, lab_strategy=VALID_LAB_STRATEGY)
        call_args = mock_agent.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "用户调节燃料滑块" in prompt_text
