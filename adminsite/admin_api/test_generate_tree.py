"""Tests for the AI knowledge tree generation endpoint."""

import json
from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status

from apps.projects.models import Project

GENERATE_URL = "/api/admin/projects/{pk}/generate-tree/"

MOCK_TREE_RESPONSE = {
    "milestones": [
        {
            "title": "Introduction to AI",
            "description": "Basic AI concepts",
            "order": 0,
            "knodes": [
                {
                    "title": "What is AI?",
                    "summary": "Introduction to artificial intelligence",
                    "difficulty_level": 1,
                    "content_type": "text",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 15,
                    "xp_reward": 20,
                    "order": 0,
                    "prerequisite_indices": [],
                },
                {
                    "title": "History of AI",
                    "summary": "Brief history",
                    "difficulty_level": 2,
                    "content_type": "text",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 20,
                    "xp_reward": 25,
                    "order": 1,
                    "prerequisite_indices": [0],
                },
            ],
        },
        {
            "title": "Machine Learning Basics",
            "description": "Core ML concepts",
            "order": 1,
            "knodes": [
                {
                    "title": "What is ML?",
                    "summary": "ML introduction",
                    "difficulty_level": 3,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 25,
                    "xp_reward": 30,
                    "order": 0,
                    "prerequisite_indices": [0, 1],
                },
            ],
        },
    ]
}


@pytest.fixture
def project(db):
    return Project.objects.create(
        title="AI for Kids",
        subtitle="Learn AI step by step",
        description="An introductory AI project for young learners.",
        category="ai",
        min_age=10,
        max_age=16,
        estimated_hours=20,
    )


def _mock_openai_response(content: str):
    """Create a mock OpenAI chat completion response."""
    mock_message = MagicMock()
    mock_message.content = content

    mock_choice = MagicMock()
    mock_choice.message = mock_message

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    return mock_response


# ---------------------------------------------------------------------------
# Success cases
# ---------------------------------------------------------------------------


class TestGenerateTreeSuccess:
    """Tests for successful tree generation."""

    @patch("admin_api.services.OpenAI")
    def test_generate_tree_default_granularity(self, mock_openai_cls, admin_client, project):
        """Default granularity is medium."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps(MOCK_TREE_RESPONSE)
        )
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "tree_data" in data
        assert "milestones" in data["tree_data"]
        assert len(data["tree_data"]["milestones"]) == 2

        # Default should use medium prompt
        call_args = mock_client.chat.completions.create.call_args
        user_msg = call_args.kwargs["messages"][1]["content"]
        assert "medium" in user_msg.lower()

    @patch("admin_api.services.OpenAI")
    def test_generate_tree_coarse(self, mock_openai_cls, admin_client, project):
        """Coarse granularity includes 20-50 range in prompt."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps(MOCK_TREE_RESPONSE)
        )
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(
                url, {"granularity": "coarse"}, format="json",
            )

        assert response.status_code == status.HTTP_200_OK
        call_args = mock_client.chat.completions.create.call_args
        user_msg = call_args.kwargs["messages"][1]["content"]
        assert "coarse" in user_msg.lower()
        assert "20-50" in user_msg

    @patch("admin_api.services.OpenAI")
    def test_generate_tree_fine(self, mock_openai_cls, admin_client, project):
        """Fine granularity includes 500-1500 range in prompt."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps(MOCK_TREE_RESPONSE)
        )
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(
                url, {"granularity": "fine"}, format="json",
            )

        assert response.status_code == status.HTTP_200_OK
        call_args = mock_client.chat.completions.create.call_args
        user_msg = call_args.kwargs["messages"][1]["content"]
        assert "fine" in user_msg.lower()
        assert "500-1500" in user_msg

    @patch("admin_api.services.OpenAI")
    def test_generate_tree_with_instructions(self, mock_openai_cls, admin_client, project):
        """Instructions are included in the prompt."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps(MOCK_TREE_RESPONSE)
        )
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(
                url,
                {"granularity": "medium", "instructions": "Focus on coding exercises"},
                format="json",
            )

        assert response.status_code == status.HTTP_200_OK
        call_args = mock_client.chat.completions.create.call_args
        user_msg = call_args.kwargs["messages"][1]["content"]
        assert "Focus on coding exercises" in user_msg

    @patch("admin_api.services.OpenAI")
    def test_generate_does_not_auto_import(self, mock_openai_cls, admin_client, project):
        """Generated tree is returned, not automatically imported."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps(MOCK_TREE_RESPONSE)
        )
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert project.milestones.count() == 0

    @patch("admin_api.services.OpenAI")
    def test_prompt_includes_project_info(self, mock_openai_cls, admin_client, project):
        """Verify the prompt includes project title, category, age range."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps(MOCK_TREE_RESPONSE)
        )
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            admin_client.post(url, {}, format="json")

        call_args = mock_client.chat.completions.create.call_args
        user_msg = call_args.kwargs["messages"][1]["content"]
        assert "AI for Kids" in user_msg
        assert "Learn AI step by step" in user_msg
        assert "10-16" in user_msg


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------


class TestGenerateTreeValidation:
    """Tests for request validation."""

    def test_invalid_granularity(self, admin_client, project):
        url = GENERATE_URL.format(pk=project.pk)
        response = admin_client.post(url, {"granularity": "ultra"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_project_not_found(self, admin_client):
        url = GENERATE_URL.format(pk=99999)
        response = admin_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Permission checks
# ---------------------------------------------------------------------------


class TestGenerateTreePermissions:
    """Tests for authentication and permission checks."""

    def test_unauthenticated(self, api_client, project):
        url = GENERATE_URL.format(pk=project.pk)
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_admin_user(self, regular_client, project):
        url = GENERATE_URL.format(pk=project.pk)
        response = regular_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


class TestGenerateTreeErrors:
    """Tests for API/AI error handling."""

    def test_missing_api_key(self, admin_client, project):
        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {}, clear=True):
            import os
            os.environ.pop("DASHSCOPE_API_KEY", None)
            response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "DASHSCOPE_API_KEY" in response.json()["detail"]

    @patch("admin_api.services.OpenAI")
    def test_ai_returns_empty_response(self, mock_openai_cls, admin_client, project):
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response("")
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "empty" in response.json()["detail"].lower()

    @patch("admin_api.services.OpenAI")
    def test_ai_returns_invalid_json(self, mock_openai_cls, admin_client, project):
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            "not valid json {"
        )
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid json" in response.json()["detail"].lower()

    @patch("admin_api.services.OpenAI")
    def test_ai_returns_json_without_milestones(self, mock_openai_cls, admin_client, project):
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps({"nodes": []})
        )
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "milestones" in response.json()["detail"].lower()

    @patch("admin_api.services.OpenAI")
    def test_ai_timeout(self, mock_openai_cls, admin_client, project):
        """Timeout from the AI provider returns 502."""
        from openai import APITimeoutError

        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = APITimeoutError(request=MagicMock())
        mock_openai_cls.return_value = mock_client

        url = GENERATE_URL.format(pk=project.pk)
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert "generation failed" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Service unit tests
# ---------------------------------------------------------------------------


class TestBuildUserPrompt:
    """Unit tests for build_user_prompt()."""

    def test_includes_all_project_fields(self, project):
        from admin_api.services import build_user_prompt

        prompt = build_user_prompt(project, granularity="medium", instructions="Extra info")
        assert "AI for Kids" in prompt
        assert "Learn AI step by step" in prompt
        assert "introductory AI project" in prompt
        assert "10-16" in prompt
        assert "Extra info" in prompt

    def test_coarse_prompt(self, project):
        from admin_api.services import build_user_prompt

        prompt = build_user_prompt(project, granularity="coarse")
        assert "coarse" in prompt.lower()
        assert "20-50" in prompt

    def test_medium_prompt(self, project):
        from admin_api.services import build_user_prompt

        prompt = build_user_prompt(project, granularity="medium")
        assert "medium" in prompt.lower()
        assert "100-300" in prompt

    def test_fine_prompt(self, project):
        from admin_api.services import build_user_prompt

        prompt = build_user_prompt(project, granularity="fine")
        assert "fine" in prompt.lower()
        assert "500-1500" in prompt

    def test_no_instructions(self, project):
        from admin_api.services import build_user_prompt

        prompt = build_user_prompt(project, granularity="medium")
        assert "Additional Instructions" not in prompt

    def test_no_subtitle(self, db):
        from admin_api.services import build_user_prompt

        p = Project.objects.create(title="Bare Project", category="cs")
        prompt = build_user_prompt(p, granularity="medium")
        assert "Bare Project" in prompt
        assert "Subtitle" not in prompt

    def test_mentions_foundational_knowledge(self, project):
        from admin_api.services import build_user_prompt

        prompt = build_user_prompt(project, granularity="medium")
        assert "foundational" in prompt.lower()
