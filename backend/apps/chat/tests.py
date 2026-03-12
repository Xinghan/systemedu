from unittest.mock import patch

import pytest
from langchain_core.messages import AIMessage
from rest_framework import status

from apps.chat.models import ChatMessage, LearningSession
from apps.projects.models import KnowledgeNode, Milestone, Project

SEND_URL = "/api/chat/message/"


@pytest.fixture
def project(db):
    return Project.objects.create(
        title="Test Project",
        description="A test project.",
        category="ai",
        is_published=True,
    )


@pytest.fixture
def milestone(project):
    return Milestone.objects.create(
        project=project, title="M1", order=0,
    )


@pytest.fixture
def knode(project, milestone):
    return KnowledgeNode.objects.create(
        project=project,
        milestone=milestone,
        title="Test Node",
        summary="Test summary.",
        order=0,
    )


def _mock_graph_invoke(state):
    """Mock learning_graph.invoke to return a deterministic response."""
    return {**state, "response": "这是AI导师的回复。"}


class TestSendMessage:
    @patch("apps.chat.views.learning_graph")
    def test_send_message_creates_session(self, mock_graph, auth_client, user, project):
        mock_graph.invoke.side_effect = _mock_graph_invoke

        resp = auth_client.post(SEND_URL, {
            "project_id": project.pk,
            "message": "你好！",
        })
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["session_id"] is not None
        assert resp.data["message"]["role"] == "assistant"
        assert resp.data["message"]["content"] == "这是AI导师的回复。"

        # Verify session and messages created
        session = LearningSession.objects.get(pk=resp.data["session_id"])
        assert session.user == user
        assert session.project == project
        assert session.messages_count == 2  # user + assistant

    @patch("apps.chat.views.learning_graph")
    def test_send_message_with_knode(self, mock_graph, auth_client, project, knode):
        mock_graph.invoke.side_effect = _mock_graph_invoke

        resp = auth_client.post(SEND_URL, {
            "project_id": project.pk,
            "knode_id": knode.pk,
            "message": "这个节点讲什么？",
        })
        assert resp.status_code == status.HTTP_200_OK

        session = LearningSession.objects.get(pk=resp.data["session_id"])
        assert session.knode == knode

    @patch("apps.chat.views.learning_graph")
    def test_send_message_continue_session(self, mock_graph, auth_client, user, project):
        mock_graph.invoke.side_effect = _mock_graph_invoke

        # First message creates session
        resp1 = auth_client.post(SEND_URL, {
            "project_id": project.pk,
            "message": "第一条消息",
        })
        session_id = resp1.data["session_id"]

        # Second message continues session
        resp2 = auth_client.post(SEND_URL, {
            "project_id": project.pk,
            "session_id": session_id,
            "message": "第二条消息",
        })
        assert resp2.data["session_id"] == session_id

        session = LearningSession.objects.get(pk=session_id)
        assert session.messages_count == 4  # 2 user + 2 assistant

    @patch("apps.chat.views.learning_graph")
    def test_send_message_passes_context_to_agent(self, mock_graph, auth_client, user, project, knode):
        mock_graph.invoke.side_effect = _mock_graph_invoke

        auth_client.post(SEND_URL, {
            "project_id": project.pk,
            "knode_id": knode.pk,
            "message": "测试",
        })

        # Check the state passed to the graph
        call_args = mock_graph.invoke.call_args[0][0]
        assert call_args["user_id"] == user.pk
        assert call_args["project_id"] == project.pk
        assert call_args["knode_id"] == knode.pk
        assert call_args["knode_title"] == "Test Node"
        assert call_args["user_age"] == 14  # from conftest user fixture

    def test_send_message_unauthenticated(self, api_client, project):
        resp = api_client.post(SEND_URL, {
            "project_id": project.pk,
            "message": "hi",
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_send_message_invalid_project(self, auth_client):
        resp = auth_client.post(SEND_URL, {
            "project_id": 9999,
            "message": "hi",
        })
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_send_message_invalid_knode(self, auth_client, project):
        resp = auth_client.post(SEND_URL, {
            "project_id": project.pk,
            "knode_id": 9999,
            "message": "hi",
        })
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_send_message_missing_message(self, auth_client, project):
        resp = auth_client.post(SEND_URL, {
            "project_id": project.pk,
        })
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


class TestSessionHistory:
    @patch("apps.chat.views.learning_graph")
    def test_get_session_history(self, mock_graph, auth_client, user, project):
        mock_graph.invoke.side_effect = _mock_graph_invoke

        # Create a session with messages
        resp = auth_client.post(SEND_URL, {
            "project_id": project.pk,
            "message": "hello",
        })
        session_id = resp.data["session_id"]

        resp = auth_client.get(f"/api/chat/history/{session_id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["id"] == session_id
        assert len(resp.data["messages"]) == 2

    def test_session_history_unauthenticated(self, api_client):
        resp = api_client.get("/api/chat/history/1/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_session_history_other_user(self, auth_client, db):
        """Cannot view another user's session."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        other = User.objects.create_user(username="other", password="pass123")
        project = Project.objects.create(
            title="P", description="d", is_published=True,
        )
        session = LearningSession.objects.create(user=other, project=project)

        resp = auth_client.get(f"/api/chat/history/{session.pk}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


class TestModels:
    def test_session_str(self, user, project, db):
        s = LearningSession.objects.create(user=user, project=project)
        assert "Session" in str(s)

    def test_message_str(self, user, project, db):
        s = LearningSession.objects.create(user=user, project=project)
        m = ChatMessage.objects.create(session=s, role="user", content="Hello world test message")
        assert "user:" in str(m)
