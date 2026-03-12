"""Tests for the AI agent system."""

from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from agents.state import LearningState
from agents.tutor import TUTOR_SYSTEM_PROMPT, tutor_node


def _make_state(**overrides) -> LearningState:
    """Create a test LearningState with defaults."""
    defaults: LearningState = {
        "user_id": 1,
        "project_id": 1,
        "knode_id": 1,
        "user_age": 12,
        "knode_title": "What is Data?",
        "knode_summary": "Introduction to the concept of data.",
        "messages": [HumanMessage(content="什么是数据？")],
        "response": "",
    }
    defaults.update(overrides)
    return defaults


class TestTutorAgent:
    @patch("agents.tutor.get_llm")
    def test_tutor_returns_response(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="数据就是我们收集的信息哦！")
        mock_get_llm.return_value = mock_llm

        state = _make_state()
        result = tutor_node(state)

        assert result["response"] == "数据就是我们收集的信息哦！"
        assert len(result["messages"]) == 2  # original + AI response
        assert isinstance(result["messages"][-1], AIMessage)

    @patch("agents.tutor.get_llm")
    def test_tutor_uses_age_in_prompt(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="test")
        mock_get_llm.return_value = mock_llm

        state = _make_state(user_age=8)
        tutor_node(state)

        # Check the system message passed to LLM contains the age
        call_args = mock_llm.invoke.call_args[0][0]
        system_msg = call_args[0].content
        assert "8" in system_msg

    @patch("agents.tutor.get_llm")
    def test_tutor_uses_knode_context(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="test")
        mock_get_llm.return_value = mock_llm

        state = _make_state(knode_title="K-Means算法", knode_summary="聚类算法入门")
        tutor_node(state)

        call_args = mock_llm.invoke.call_args[0][0]
        system_msg = call_args[0].content
        assert "K-Means算法" in system_msg
        assert "聚类算法入门" in system_msg

    @patch("agents.tutor.get_llm")
    def test_tutor_preserves_state_fields(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="reply")
        mock_get_llm.return_value = mock_llm

        state = _make_state(user_id=42, project_id=7, knode_id=99)
        result = tutor_node(state)

        assert result["user_id"] == 42
        assert result["project_id"] == 7
        assert result["knode_id"] == 99

    @patch("agents.tutor.get_llm")
    def test_tutor_multi_turn(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="第二轮回答")
        mock_get_llm.return_value = mock_llm

        state = _make_state(
            messages=[
                HumanMessage(content="什么是数据？"),
                AIMessage(content="数据就是信息。"),
                HumanMessage(content="能举个例子吗？"),
            ]
        )
        result = tutor_node(state)

        assert len(result["messages"]) == 4
        assert result["response"] == "第二轮回答"


class TestLearningGraph:
    @patch("agents.tutor.get_llm")
    def test_graph_end_to_end(self, mock_get_llm):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="Hello from graph!")
        mock_get_llm.return_value = mock_llm

        from agents.graph import build_learning_graph

        graph = build_learning_graph()
        state = _make_state()
        result = graph.invoke(state)

        assert result["response"] == "Hello from graph!"
        assert len(result["messages"]) == 2


class TestLLMConfig:
    def test_get_llm_without_key_raises(self):
        with patch("agents.llm.DASHSCOPE_API_KEY", ""):
            from agents.llm import get_llm
            with pytest.raises(ValueError, match="DASHSCOPE_API_KEY"):
                get_llm()

    def test_get_llm_returns_chat_model(self):
        with patch("agents.llm.DASHSCOPE_API_KEY", "sk-test"):
            from agents.llm import get_llm
            llm = get_llm()
            assert llm.model_name == "qwen-plus"
