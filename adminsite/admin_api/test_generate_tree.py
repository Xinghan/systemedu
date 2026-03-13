"""Tests for the AI knowledge tree generation endpoint (async task kickoff)."""

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


# ---------------------------------------------------------------------------
# Success cases — endpoint now returns 202 + task_id
# ---------------------------------------------------------------------------


class TestGenerateTreeKickoff:
    """Tests for async task kickoff via generate-tree endpoint."""

    @patch("admin_api.views.run_generate_task")
    def test_returns_202_with_task_id(self, mock_run, admin_client, project):
        """POST returns 202 with task_id and pending status."""
        url = GENERATE_URL.format(pk=project.pk)
        response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "pending"
        mock_run.assert_called_once_with(data["task_id"])

    @patch("admin_api.views.run_generate_task")
    def test_task_created_with_default_granularity(self, mock_run, admin_client, project):
        """Default granularity is medium."""
        from admin_api.models import GenerationTask

        url = GENERATE_URL.format(pk=project.pk)
        response = admin_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_202_ACCEPTED
        task = GenerationTask.objects.get(pk=response.json()["task_id"])
        assert task.granularity == "medium"
        assert task.instructions == ""
        assert task.project == project

    @patch("admin_api.views.run_generate_task")
    def test_task_created_with_custom_params(self, mock_run, admin_client, project):
        """Custom granularity and instructions are stored on the task."""
        from admin_api.models import GenerationTask

        url = GENERATE_URL.format(pk=project.pk)
        response = admin_client.post(
            url,
            {"granularity": "fine", "instructions": "Focus on coding"},
            format="json",
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        task = GenerationTask.objects.get(pk=response.json()["task_id"])
        assert task.granularity == "fine"
        assert task.instructions == "Focus on coding"

    @patch("admin_api.views.run_generate_task")
    def test_task_created_by_user(self, mock_run, admin_client, admin_user, project):
        """Task records the requesting user."""
        from admin_api.models import GenerationTask

        url = GENERATE_URL.format(pk=project.pk)
        response = admin_client.post(url, {}, format="json")

        task = GenerationTask.objects.get(pk=response.json()["task_id"])
        assert task.created_by == admin_user


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


# ---------------------------------------------------------------------------
# Sanitize tree data
# ---------------------------------------------------------------------------


class TestSanitizeTreeData:
    """Unit tests for _sanitize_tree_data()."""

    def _make_knode(self, **overrides):
        base = {
            "title": "Test Node",
            "summary": "Test",
            "difficulty_level": 3,
            "content_type": "text",
            "acceptance_type": "quiz",
            "estimated_minutes": 15,
            "xp_reward": 20,
            "order": 0,
            "prerequisite_indices": [],
        }
        base.update(overrides)
        return base

    def _make_tree(self, knodes):
        return {
            "milestones": [
                {"title": "M1", "description": "", "order": 0, "knodes": knodes}
            ]
        }

    def test_valid_data_unchanged(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode()
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["content_type"] == "text"
        assert knode["acceptance_type"] == "quiz"
        assert knode["difficulty_level"] == 3
        assert knode["estimated_minutes"] == 15
        assert knode["xp_reward"] == 20

    def test_invalid_content_type_falls_back_to_text(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(content_type="essay")
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["content_type"] == "text"

    def test_invalid_acceptance_type_falls_back_to_quiz(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(acceptance_type="video")
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["acceptance_type"] == "quiz"

    def test_all_valid_content_types_preserved(self):
        from admin_api.services import _sanitize_tree_data, VALID_CONTENT_TYPES

        for ct in VALID_CONTENT_TYPES:
            knode = self._make_knode(content_type=ct)
            tree = self._make_tree([knode])
            _sanitize_tree_data(tree)
            assert knode["content_type"] == ct

    def test_all_valid_acceptance_types_preserved(self):
        from admin_api.services import _sanitize_tree_data, VALID_ACCEPTANCE_TYPES

        for at in VALID_ACCEPTANCE_TYPES:
            knode = self._make_knode(acceptance_type=at)
            tree = self._make_tree([knode])
            _sanitize_tree_data(tree)
            assert knode["acceptance_type"] == at

    def test_difficulty_level_clamped_to_1(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(difficulty_level=0)
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["difficulty_level"] == 1

    def test_difficulty_level_clamped_to_10(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(difficulty_level=15)
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["difficulty_level"] == 10

    def test_difficulty_level_float_truncated(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(difficulty_level=3.7)
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["difficulty_level"] == 3

    def test_negative_estimated_minutes_defaults(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(estimated_minutes=-5)
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["estimated_minutes"] == 15

    def test_zero_estimated_minutes_defaults(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(estimated_minutes=0)
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["estimated_minutes"] == 15

    def test_negative_xp_reward_defaults(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(xp_reward=-10)
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["xp_reward"] == 20

    def test_zero_xp_reward_defaults(self):
        from admin_api.services import _sanitize_tree_data

        knode = self._make_knode(xp_reward=0)
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["xp_reward"] == 20

    def test_missing_fields_get_defaults(self):
        from admin_api.services import _sanitize_tree_data

        knode = {"title": "Bare Node", "order": 0}
        tree = self._make_tree([knode])
        _sanitize_tree_data(tree)
        assert knode["content_type"] == "text"
        assert knode["acceptance_type"] == "quiz"
        assert knode["difficulty_level"] == 1
        assert knode["estimated_minutes"] == 15
        assert knode["xp_reward"] == 20

    def test_multiple_knodes_all_sanitized(self):
        from admin_api.services import _sanitize_tree_data

        knodes = [
            self._make_knode(content_type="essay", difficulty_level=0),
            self._make_knode(acceptance_type="video", xp_reward=-1),
        ]
        tree = self._make_tree(knodes)
        _sanitize_tree_data(tree)
        assert knodes[0]["content_type"] == "text"
        assert knodes[0]["difficulty_level"] == 1
        assert knodes[1]["acceptance_type"] == "quiz"
        assert knodes[1]["xp_reward"] == 20
