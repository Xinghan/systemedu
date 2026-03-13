"""Tests for async generation: task model, _execute_generation, task status endpoint, cleanup."""

import json
import uuid
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework import status

from admin_api.models import GenerationTask
from apps.projects.models import Project

ACTIVE_TASKS_URL = "/api/admin/tasks/"
TASK_STATUS_URL = "/api/admin/tasks/{task_id}/"

MOCK_TREE = {
    "milestones": [
        {
            "title": "Intro",
            "order": 0,
            "knodes": [
                {
                    "title": "Node 1",
                    "difficulty_level": 1,
                    "content_type": "text",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 15,
                    "xp_reward": 20,
                    "order": 0,
                    "prerequisite_indices": [],
                },
            ],
        },
    ]
}


@pytest.fixture
def project(db):
    return Project.objects.create(
        title="Test Project",
        category="cs",
        min_age=10,
        max_age=16,
    )


@pytest.fixture
def pending_task(project, admin_user):
    return GenerationTask.objects.create(
        project=project,
        created_by=admin_user,
        granularity="medium",
        instructions="",
    )


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------


class TestGenerationTaskModel:
    def test_default_status_is_pending(self, pending_task):
        assert pending_task.status == "pending"

    def test_uuid_primary_key(self, pending_task):
        assert isinstance(pending_task.id, uuid.UUID)

    def test_str_representation(self, pending_task):
        assert "pending" in str(pending_task)


# ---------------------------------------------------------------------------
# _execute_generation (called synchronously in tests)
# ---------------------------------------------------------------------------


class TestExecuteGeneration:
    @patch("admin_api.services.OpenAI")
    def test_successful_execution(self, mock_openai_cls, pending_task):
        """Successful generation marks task completed, auto-saves to DB."""
        mock_client = MagicMock()
        mock_msg = MagicMock()
        mock_msg.content = json.dumps(MOCK_TREE)
        mock_choice = MagicMock()
        mock_choice.message = mock_msg
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_cls.return_value = mock_client

        from admin_api.tasks import _execute_generation

        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            _execute_generation(str(pending_task.id))

        pending_task.refresh_from_db()
        assert pending_task.status == "completed"
        assert pending_task.result_json is not None
        assert "milestones" in pending_task.result_json
        assert pending_task.started_at is not None
        assert pending_task.completed_at is not None
        # Auto-save counts
        assert pending_task.milestones_created == 1
        assert pending_task.knodes_created == 1
        # Verify tree was actually saved to DB
        assert pending_task.project.milestones.count() == 1
        from apps.projects.models import KnowledgeNode
        assert KnowledgeNode.objects.filter(project=pending_task.project).count() == 1

    @patch("admin_api.services.OpenAI")
    def test_failed_execution(self, mock_openai_cls, pending_task):
        """Exception during generation marks task failed with error."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("API down")
        mock_openai_cls.return_value = mock_client

        from admin_api.tasks import _execute_generation

        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "test-key"}):
            _execute_generation(str(pending_task.id))

        pending_task.refresh_from_db()
        assert pending_task.status == "failed"
        assert "API down" in pending_task.error_message
        assert pending_task.completed_at is not None

    def test_missing_task_id(self, db):
        """Non-existent task_id logs error but doesn't crash."""
        from admin_api.tasks import _execute_generation

        _execute_generation(str(uuid.uuid4()))  # should not raise

    def test_missing_api_key(self, pending_task):
        """Missing API key results in failed task."""
        from admin_api.tasks import _execute_generation

        with patch.dict("os.environ", {}, clear=True):
            import os
            os.environ.pop("DASHSCOPE_API_KEY", None)
            _execute_generation(str(pending_task.id))

        pending_task.refresh_from_db()
        assert pending_task.status == "failed"
        assert "DASHSCOPE_API_KEY" in pending_task.error_message


# ---------------------------------------------------------------------------
# Task status endpoint
# ---------------------------------------------------------------------------


class TestTaskStatusEndpoint:
    def test_pending_task(self, admin_client, pending_task):
        url = TASK_STATUS_URL.format(task_id=pending_task.id)
        response = admin_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["task_id"] == str(pending_task.id)
        assert data["status"] == "pending"
        assert "tree_data" not in data
        assert "error" not in data

    def test_completed_task(self, admin_client, pending_task):
        pending_task.status = GenerationTask.Status.COMPLETED
        pending_task.result_json = MOCK_TREE
        pending_task.milestones_created = 1
        pending_task.knodes_created = 1
        pending_task.completed_at = timezone.now()
        pending_task.save()

        url = TASK_STATUS_URL.format(task_id=pending_task.id)
        response = admin_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
        assert data["tree_data"] is not None
        assert "milestones" in data["tree_data"]
        assert data["milestones_created"] == 1
        assert data["knodes_created"] == 1

    def test_failed_task(self, admin_client, pending_task):
        pending_task.status = GenerationTask.Status.FAILED
        pending_task.error_message = "Something went wrong"
        pending_task.completed_at = timezone.now()
        pending_task.save()

        url = TASK_STATUS_URL.format(task_id=pending_task.id)
        response = admin_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "failed"
        assert data["error"] == "Something went wrong"

    def test_task_not_found(self, admin_client):
        fake_id = uuid.uuid4()
        url = TASK_STATUS_URL.format(task_id=fake_id)
        response = admin_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated(self, api_client, pending_task):
        url = TASK_STATUS_URL.format(task_id=pending_task.id)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_admin(self, regular_client, pending_task):
        url = TASK_STATUS_URL.format(task_id=pending_task.id)
        response = regular_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Stale task cleanup
# ---------------------------------------------------------------------------


class TestCleanupStaleTasks:
    def test_cleans_stale_running_tasks(self, pending_task):
        pending_task.status = GenerationTask.Status.RUNNING
        pending_task.started_at = timezone.now() - timedelta(minutes=10)
        pending_task.save()

        from admin_api.tasks import cleanup_stale_tasks

        count = cleanup_stale_tasks()
        assert count == 1

        pending_task.refresh_from_db()
        assert pending_task.status == "failed"
        assert "timed out" in pending_task.error_message

    def test_does_not_clean_recent_tasks(self, pending_task):
        pending_task.status = GenerationTask.Status.RUNNING
        pending_task.started_at = timezone.now() - timedelta(minutes=2)
        pending_task.save()

        from admin_api.tasks import cleanup_stale_tasks

        count = cleanup_stale_tasks()
        assert count == 0

        pending_task.refresh_from_db()
        assert pending_task.status == "running"

    def test_does_not_clean_completed_tasks(self, pending_task):
        pending_task.status = GenerationTask.Status.COMPLETED
        pending_task.result_json = MOCK_TREE
        pending_task.save()

        from admin_api.tasks import cleanup_stale_tasks

        count = cleanup_stale_tasks()
        assert count == 0


# ---------------------------------------------------------------------------
# Active tasks list endpoint
# ---------------------------------------------------------------------------


class TestActiveTasksList:
    def test_lists_pending_and_running_tasks(self, admin_client, pending_task):
        response = admin_client.get(ACTIVE_TASKS_URL)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["task_id"] == str(pending_task.id)
        assert data[0]["status"] == "pending"
        assert data[0]["project_title"] == "Test Project"

    def test_excludes_completed_tasks(self, admin_client, pending_task):
        pending_task.status = GenerationTask.Status.COMPLETED
        pending_task.completed_at = timezone.now()
        pending_task.save()

        response = admin_client.get(ACTIVE_TASKS_URL)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 0

    def test_excludes_failed_tasks(self, admin_client, pending_task):
        pending_task.status = GenerationTask.Status.FAILED
        pending_task.completed_at = timezone.now()
        pending_task.save()

        response = admin_client.get(ACTIVE_TASKS_URL)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 0

    def test_filter_by_project_id(self, admin_client, pending_task, project):
        other_project = Project.objects.create(
            title="Other Project", category="ai", min_age=10, max_age=16,
        )
        GenerationTask.objects.create(
            project=other_project, granularity="coarse",
        )

        response = admin_client.get(f"{ACTIVE_TASKS_URL}?project_id={project.id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["project_id"] == project.id

    def test_unauthenticated(self, api_client):
        response = api_client.get(ACTIVE_TASKS_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_admin(self, regular_client):
        response = regular_client.get(ACTIVE_TASKS_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN
