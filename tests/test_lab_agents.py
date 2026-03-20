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


class TestLabPipeline:
    @pytest.mark.asyncio
    async def test_full_pipeline_success(self):
        """Full 2-agent pipeline produces HTML."""
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        with (
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("火箭发射", "学习火箭原理", 5, MagicMock())
        assert "<html" in result

    @pytest.mark.asyncio
    async def test_pipeline_with_lesson_plan(self):
        """Pipeline passes game_concept from lesson plan to coder."""
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        plan = {"lab_strategy": VALID_LAB_STRATEGY}
        with (
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("火箭发射", "学习火箭", 5, MagicMock(), lesson_plan=plan)
        assert "<html" in result
        # Coder ainvoke called with game_concept in prompt
        call_args = mock_coder.ainvoke.call_args
        messages = call_args[0][0]["messages"]
        prompt_text = messages[0].content
        assert "用户调节燃料滑块" in prompt_text

    @pytest.mark.asyncio
    async def test_pipeline_coder_failure_returns_empty(self):
        """If coder fails, pipeline returns empty."""
        mock_coder = _make_agent_mock("not html")
        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert result == ""

    @pytest.mark.asyncio
    async def test_pipeline_progress_callback(self):
        """Progress callback is invoked for coder and reviewer."""
        mock_coder = _make_agent_mock(VALID_HTML)
        mock_reviewer = _make_agent_mock(VALID_HTML)
        callbacks = []

        def callback(step, status, preview):
            callbacks.append((step, status))

        with (
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_coder),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            await _generate_interactive_lab("Test", "Summary", 3, MagicMock(), progress_callback=callback)

        step_names = [c[0] for c in callbacks]
        assert "lab_coder" in step_names
        assert "lab_reviewer" in step_names
        assert ("lab_coder", "in_progress") in callbacks
        assert ("lab_coder", "completed") in callbacks
        assert ("lab_reviewer", "in_progress") in callbacks
        assert ("lab_reviewer", "completed") in callbacks
        # Should NOT include old agent names
        assert not any(s in step_names for s in ("lab_analyst", "lab_designer", "lab_image_search"))

    @pytest.mark.asyncio
    async def test_pipeline_retry_on_coder_failure(self):
        """Pipeline retries coder once before failing."""
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
            patch("systemedu.agents.builtin.lab_coder.create_deep_agent", side_effect=coder_side_effect),
            patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_reviewer),
        ):
            result = await _generate_interactive_lab("Test", "Summary", 3, MagicMock())
        assert "<html" in result
        assert call_count["n"] == 2


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
