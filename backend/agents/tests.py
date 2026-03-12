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
