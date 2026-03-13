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
        "memory_context": "",
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

    @patch("agents.tutor.get_llm")
    def test_tutor_includes_memory_in_prompt(self, mock_get_llm):
        """When memory_context is provided, it appears in the system prompt."""
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="test")
        mock_get_llm.return_value = mock_llm

        state = _make_state(memory_context="- 学生喜欢用图表学习\n- 学生对数学有兴趣")
        tutor_node(state)

        call_args = mock_llm.invoke.call_args[0][0]
        system_msg = call_args[0].content
        assert "学生喜欢用图表学习" in system_msg
        assert "学生对数学有兴趣" in system_msg

    @patch("agents.tutor.get_llm")
    def test_tutor_works_without_memory(self, mock_get_llm):
        """When memory_context is empty, prompt still works normally."""
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="test")
        mock_get_llm.return_value = mock_llm

        state = _make_state(memory_context="")
        tutor_node(state)

        call_args = mock_llm.invoke.call_args[0][0]
        system_msg = call_args[0].content
        assert "关于这个学生的已知信息" not in system_msg


class TestMemoryNodes:
    @patch("agents.memory.get_memory")
    def test_retrieve_memory_node(self, mock_get_memory):
        """retrieve_memory_node populates memory_context from Mem0."""
        mock_mem = MagicMock()
        mock_mem.search.return_value = {
            "results": [
                {"memory": "学生喜欢编程", "score": 0.9},
                {"memory": "学生8岁", "score": 0.8},
            ]
        }
        mock_get_memory.return_value = mock_mem

        from agents.graph import retrieve_memory_node

        state = _make_state()
        result = retrieve_memory_node(state)

        assert "学生喜欢编程" in result["memory_context"]
        assert "学生8岁" in result["memory_context"]
        mock_mem.search.assert_called_once()

    @patch("agents.memory.get_memory")
    def test_retrieve_memory_node_empty(self, mock_get_memory):
        """When no memories found, memory_context is empty string."""
        mock_mem = MagicMock()
        mock_mem.search.return_value = {"results": []}
        mock_get_memory.return_value = mock_mem

        from agents.graph import retrieve_memory_node

        state = _make_state()
        result = retrieve_memory_node(state)

        assert result["memory_context"] == ""

    @patch("agents.memory.get_memory")
    def test_retrieve_memory_node_handles_error(self, mock_get_memory):
        """Memory retrieval errors don't crash the pipeline."""
        mock_get_memory.side_effect = Exception("Mem0 unavailable")

        from agents.graph import retrieve_memory_node

        state = _make_state()
        result = retrieve_memory_node(state)

        assert result["memory_context"] == ""

    @patch("agents.memory.get_memory")
    def test_store_memory_node(self, mock_get_memory):
        """store_memory_node sends conversation to Mem0."""
        mock_mem = MagicMock()
        mock_mem.add.return_value = {"results": []}
        mock_get_memory.return_value = mock_mem

        from agents.graph import store_memory_node

        state = _make_state(
            messages=[
                HumanMessage(content="什么是数据？"),
                AIMessage(content="数据就是信息。"),
            ]
        )
        store_memory_node(state)

        mock_mem.add.assert_called_once()
        call_args = mock_mem.add.call_args
        msgs = call_args[0][0]
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"
        assert msgs[1]["role"] == "assistant"

    @patch("agents.memory.get_memory")
    def test_store_memory_node_handles_error(self, mock_get_memory):
        """Memory storage errors don't crash the pipeline."""
        mock_mem = MagicMock()
        mock_mem.add.side_effect = Exception("Storage failed")
        mock_get_memory.return_value = mock_mem

        from agents.graph import store_memory_node

        state = _make_state(
            messages=[
                HumanMessage(content="test"),
                AIMessage(content="response"),
            ]
        )
        # Should not raise
        result = store_memory_node(state)
        assert result is not None


class TestMemoryClient:
    @patch("agents.memory.get_memory")
    def test_retrieve_memories(self, mock_get_memory):
        mock_mem = MagicMock()
        mock_mem.search.return_value = {
            "results": [
                {"memory": "喜欢编程", "score": 0.9},
                {"memory": "讨厌背诵", "score": 0.7},
            ]
        }
        mock_get_memory.return_value = mock_mem

        from agents.memory import retrieve_memories

        result = retrieve_memories(user_id=1, query="学习偏好")

        assert len(result) == 2
        assert "喜欢编程" in result
        mock_mem.search.assert_called_once_with(
            query="学习偏好", user_id="user_1", limit=5,
        )

    @patch("agents.memory.get_memory")
    def test_retrieve_memories_with_project_filter(self, mock_get_memory):
        mock_mem = MagicMock()
        mock_mem.search.return_value = {"results": []}
        mock_get_memory.return_value = mock_mem

        from agents.memory import retrieve_memories

        retrieve_memories(user_id=1, query="test", project_id=42)

        mock_mem.search.assert_called_once_with(
            query="test",
            user_id="user_1",
            limit=5,
            filters={"project_id": "42"},
        )

    @patch("agents.memory.get_memory")
    def test_store_conversation(self, mock_get_memory):
        mock_mem = MagicMock()
        mock_mem.add.return_value = {"results": [{"id": "abc", "event": "ADD"}]}
        mock_get_memory.return_value = mock_mem

        from agents.memory import store_conversation

        msgs = [
            {"role": "user", "content": "你好"},
            {"role": "assistant", "content": "你好！"},
        ]
        result = store_conversation(user_id=5, messages=msgs, project_id=3, knode_id=10)

        mock_mem.add.assert_called_once_with(
            msgs,
            user_id="user_5",
            metadata={"project_id": "3", "knode_id": "10"},
        )

    def test_get_memory_without_key_raises(self):
        with patch("agents.memory.DASHSCOPE_API_KEY", ""):
            # Reset singleton
            import agents.memory
            agents.memory._memory_instance = None
            with pytest.raises(ValueError, match="DASHSCOPE_API_KEY"):
                agents.memory.get_memory()


class TestLearningGraph:
    @patch("agents.memory.get_memory")
    @patch("agents.tutor.get_llm")
    def test_graph_end_to_end(self, mock_get_llm, mock_get_memory):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="Hello from graph!")
        mock_get_llm.return_value = mock_llm

        mock_mem = MagicMock()
        mock_mem.search.return_value = {"results": []}
        mock_mem.add.return_value = {"results": []}
        mock_get_memory.return_value = mock_mem

        from agents.graph import build_learning_graph

        graph = build_learning_graph()
        state = _make_state()
        result = graph.invoke(state)

        assert result["response"] == "Hello from graph!"
        assert len(result["messages"]) == 2
        # Verify memory was searched and stored
        mock_mem.search.assert_called_once()
        mock_mem.add.assert_called_once()

    @patch("agents.memory.get_memory")
    @patch("agents.tutor.get_llm")
    def test_graph_with_memory_context(self, mock_get_llm, mock_get_memory):
        """Graph retrieves memories and passes them to tutor."""
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="个性化回答")
        mock_get_llm.return_value = mock_llm

        mock_mem = MagicMock()
        mock_mem.search.return_value = {
            "results": [{"memory": "学生对数学感兴趣", "score": 0.9}]
        }
        mock_mem.add.return_value = {"results": []}
        mock_get_memory.return_value = mock_mem

        from agents.graph import build_learning_graph

        graph = build_learning_graph()
        state = _make_state()
        result = graph.invoke(state)

        assert result["response"] == "个性化回答"
        # Check that memory context was included in the system prompt
        call_args = mock_llm.invoke.call_args[0][0]
        system_msg = call_args[0].content
        assert "学生对数学感兴趣" in system_msg


SAMPLE_TREE_JSON = {
    "milestones": [
        {
            "title": "理解数据",
            "description": "学习数据的基本概念",
            "order": 0,
            "knodes": [
                {
                    "title": "什么是数据",
                    "summary": "数据的基本概念",
                    "difficulty_level": 1,
                    "content_type": "text",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 10,
                    "xp_reward": 20,
                    "order": 0,
                    "prerequisite_indices": [],
                },
                {
                    "title": "数据类型",
                    "summary": "数值、文本、图像数据",
                    "difficulty_level": 2,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 15,
                    "xp_reward": 25,
                    "order": 1,
                    "prerequisite_indices": [0],
                },
            ],
        },
        {
            "title": "数学基础",
            "description": "学习必要的数学知识",
            "order": 1,
            "knodes": [
                {
                    "title": "距离的概念",
                    "summary": "理解欧几里得距离",
                    "difficulty_level": 3,
                    "content_type": "text",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 20,
                    "xp_reward": 30,
                    "order": 0,
                    "prerequisite_indices": [0, 1],
                },
            ],
        },
    ],
}


class TestPlannerAgent:
    @patch("agents.planner.get_llm")
    def test_generate_knowledge_tree(self, mock_get_llm):
        import json

        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(
            content=f"```json\n{json.dumps(SAMPLE_TREE_JSON, ensure_ascii=False)}\n```"
        )
        mock_get_llm.return_value = mock_llm

        from agents.planner import generate_knowledge_tree

        result = generate_knowledge_tree("测试项目", "项目描述", user_age=10)

        assert len(result["milestones"]) == 2
        assert result["milestones"][0]["title"] == "理解数据"
        assert len(result["milestones"][0]["knodes"]) == 2

    @pytest.mark.django_db
    def test_save_knowledge_tree(self):
        from apps.projects.models import KnowledgeNode, Milestone, Project

        from agents.planner import save_knowledge_tree

        project = Project.objects.create(
            title="Test Project", description="Test", is_published=True,
        )
        result = save_knowledge_tree(project, SAMPLE_TREE_JSON)

        assert result["milestones_created"] == 2
        assert result["knodes_created"] == 3

        # Verify DB records
        assert Milestone.objects.filter(project=project).count() == 2
        assert KnowledgeNode.objects.filter(project=project).count() == 3

        # Verify prerequisites
        node_distance = KnowledgeNode.objects.get(title="距离的概念")
        prereqs = list(node_distance.prerequisites.values_list("title", flat=True))
        assert "什么是数据" in prereqs
        assert "数据类型" in prereqs

        node_types = KnowledgeNode.objects.get(title="数据类型")
        prereqs2 = list(node_types.prerequisites.values_list("title", flat=True))
        assert "什么是数据" in prereqs2

    @pytest.mark.django_db
    @patch("agents.planner.get_llm")
    def test_generate_tree_api(self, mock_get_llm, auth_client):
        import json

        from apps.projects.models import Project

        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(
            content=json.dumps(SAMPLE_TREE_JSON, ensure_ascii=False)
        )
        mock_get_llm.return_value = mock_llm

        project = Project.objects.create(
            title="API Test Project", description="Test", is_published=True,
        )
        resp = auth_client.post(
            f"/api/projects/{project.pk}/generate-tree/",
            {"user_age": 10},
        )
        assert resp.status_code == 201
        assert resp.data["milestones_created"] == 2
        assert resp.data["knodes_created"] == 3

    @pytest.mark.django_db
    def test_generate_tree_conflict_if_exists(self, auth_client):
        from apps.projects.models import Milestone, Project

        project = Project.objects.create(
            title="Existing", description="Test", is_published=True,
        )
        Milestone.objects.create(project=project, title="M1", order=0)

        resp = auth_client.post(f"/api/projects/{project.pk}/generate-tree/")
        assert resp.status_code == 409

    @pytest.mark.django_db
    def test_generate_tree_not_found(self, auth_client):
        resp = auth_client.post("/api/projects/9999/generate-tree/")
        assert resp.status_code == 404

    def test_generate_tree_unauthenticated(self, api_client, db):
        from apps.projects.models import Project

        project = Project.objects.create(
            title="Test", description="Test", is_published=True,
        )
        resp = api_client.post(f"/api/projects/{project.pk}/generate-tree/")
        assert resp.status_code == 401


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
