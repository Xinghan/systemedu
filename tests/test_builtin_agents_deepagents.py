"""Tests for builtin pipeline agents using deepagents framework."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage


def _make_mock_agent(response_text: str):
    """Create a mock deep agent returning a given response."""
    mock_agent = MagicMock()
    mock_agent.ainvoke = AsyncMock(return_value={
        "messages": [AIMessage(content=response_text)]
    })
    return mock_agent


# --- LessonPlannerAgent tests ---


class TestLessonPlannerAgent:
    @pytest.mark.asyncio
    async def test_plan_returns_valid_dict(self):
        """plan() should return a parsed dict on valid JSON output."""
        plan_json = json.dumps({
            "concept_emphasis": "核心要点",
            "concept_approach": "analogy",
            "concept_depth": "medium",
            "example_strategy": {"total_count": 5},
            "lab_strategy": {
                "game_concept": "用户拖拽树叶到对应分类框，正确时弹跳反馈",
                "game_mechanic": "exploration",
                "learning_connection": "通过分类操作理解特征",
            },
            "practice_strategy": {},
            "overall_tone": "encouraging",
            "key_vocabulary": ["词1"],
        })
        mock_agent = _make_mock_agent(plan_json)
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lesson_planner import LessonPlannerAgent
            agent = LessonPlannerAgent(llm=mock_llm)
            result = await agent.plan("变量", "变量是存储数据的容器", 3)

        assert result is not None
        assert result["concept_approach"] == "analogy"
        assert result["lab_strategy"]["game_mechanic"] == "exploration"
        assert result["lab_strategy"]["game_concept"] != ""

    @pytest.mark.asyncio
    async def test_plan_returns_none_on_invalid_json(self):
        """plan() should return None when LLM output is not valid JSON."""
        mock_agent = _make_mock_agent("not json at all")
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lesson_planner import LessonPlannerAgent
            agent = LessonPlannerAgent(llm=mock_llm)
            result = await agent.plan("Test", "desc", 5)

        assert result is None

    @pytest.mark.asyncio
    async def test_plan_normalizes_invalid_game_mechanic(self):
        """Invalid game_mechanic in lab_strategy should fall back to exploration."""
        plan_json = json.dumps({
            "concept_emphasis": "key point",
            "concept_approach": "visual",
            "concept_depth": "medium",
            "lab_strategy": {
                "game_concept": "some concept",
                "game_mechanic": "invalid_type",
                "learning_connection": "connection",
            },
            "overall_tone": "encouraging",
        })
        mock_agent = _make_mock_agent(plan_json)
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lesson_planner import LessonPlannerAgent
            agent = LessonPlannerAgent(llm=mock_llm)
            result = await agent.plan("Test", "desc", 5)

        assert result["lab_strategy"]["game_mechanic"] == "exploration"

    @pytest.mark.asyncio
    async def test_process_returns_json_string(self):
        """process() should return a JSON string."""
        plan_json = json.dumps({
            "concept_emphasis": "key",
            "concept_approach": "analogy",
            "concept_depth": "medium",
            "lab_strategy": {
                "game_concept": "concept game",
                "game_mechanic": "simulation",
                "learning_connection": "link",
            },
            "overall_tone": "playful",
        })
        mock_agent = _make_mock_agent(plan_json)
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lesson_planner.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lesson_planner import LessonPlannerAgent
            agent = LessonPlannerAgent(llm=mock_llm)
            result = await agent.process("变量", {"summary": "test", "difficulty": 3})

        parsed = json.loads(result)
        assert "concept_approach" in parsed


# --- LabCoderAgent tests ---


class TestLabCoderAgent:
    @pytest.mark.asyncio
    async def test_generate_returns_html(self):
        """generate() should return a valid HTML string."""
        html = """<!DOCTYPE html>
<html>
<head><style>body{margin:0}</style></head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script type="text/babel">
    function App() { return <div onClick={()=>{}}>Game</div>; }
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
  <svg><circle cx="10" cy="10" r="5"/></svg>
  <style>@keyframes bounce{} @keyframes shake{}</style>
</body>
</html>"""
        mock_agent = _make_mock_agent(html)
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lab_coder import LabCoderAgent
            agent = LabCoderAgent(llm=mock_llm)
            result = await agent.generate("火箭发射", "了解燃料与高度", 3, {"game_mechanic": "simulation"})

        assert "<html" in result.lower()

    @pytest.mark.asyncio
    async def test_generate_returns_empty_on_invalid_html(self):
        """generate() should return empty string if HTML fails validation."""
        mock_agent = _make_mock_agent("this is not html at all")
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lab_coder import LabCoderAgent
            agent = LabCoderAgent(llm=mock_llm)
            result = await agent.generate("Test", "desc", 5, {})

        assert result == ""

    @pytest.mark.asyncio
    async def test_generate_strips_code_fences(self):
        """generate() should strip markdown code fences from output."""
        html_inner = """<!DOCTYPE html>
<html>
<head><style>body{} @keyframes a{} @keyframes b{}</style></head>
<body>
  <div id="root"></div>
  <svg><rect/></svg>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script type="text/babel">
    function App(){return <div onClick={()=>{}}>X</div>;}
    ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
  </script>
</body></html>"""
        wrapped = f"```html\n{html_inner}\n```"
        mock_agent = _make_mock_agent(wrapped)
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lab_coder.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lab_coder import LabCoderAgent
            agent = LabCoderAgent(llm=mock_llm)
            result = await agent.generate("Test", "desc", 5, {"game_mechanic": "exploration"})

        assert not result.startswith("```")
        assert "<html" in result.lower()


# --- LabReviewerAgent tests ---


class TestLabReviewerAgent:
    @pytest.mark.asyncio
    async def test_review_returns_fixed_html(self):
        """review() should return the HTML from LLM (reviewed version)."""
        original_html = "<!DOCTYPE html><html><body>original</body></html>"
        fixed_html = "<!DOCTYPE html><html><body>fixed</body></html>"
        mock_agent = _make_mock_agent(fixed_html)
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lab_reviewer import LabReviewerAgent
            agent = LabReviewerAgent(llm=mock_llm)
            result = await agent.review(original_html)

        assert result == fixed_html

    @pytest.mark.asyncio
    async def test_review_returns_original_on_missing_html_tag(self):
        """review() should return original if reviewed output is missing <html>."""
        original_html = "<!DOCTYPE html><html><body>original</body></html>"
        bad_reviewed = "just plain text, no html"
        mock_agent = _make_mock_agent(bad_reviewed)
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lab_reviewer import LabReviewerAgent
            agent = LabReviewerAgent(llm=mock_llm)
            result = await agent.review(original_html)

        assert result == original_html

    @pytest.mark.asyncio
    async def test_review_empty_html_returns_empty(self):
        """review() with empty HTML should return empty string without calling LLM."""
        mock_agent = _make_mock_agent("anything")
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent) as mock_create:
            from systemedu.agents.builtin.lab_reviewer import LabReviewerAgent
            agent = LabReviewerAgent(llm=mock_llm)
            result = await agent.review("")

        assert result == ""
        mock_create.assert_not_called()

    @pytest.mark.asyncio
    async def test_review_returns_original_on_suspiciously_short_output(self):
        """review() should keep original if reviewed output is too short (< 50% of original)."""
        original_html = "<!DOCTYPE html><html><body>" + "x" * 1000 + "</body></html>"
        short_reviewed = "<!DOCTYPE html><html><body>short</body></html>"
        mock_agent = _make_mock_agent(short_reviewed)
        mock_llm = MagicMock()

        with patch("systemedu.agents.builtin.lab_reviewer.create_deep_agent", return_value=mock_agent):
            from systemedu.agents.builtin.lab_reviewer import LabReviewerAgent
            agent = LabReviewerAgent(llm=mock_llm)
            result = await agent.review(original_html)

        assert result == original_html
