"""Tests for capstone submission endpoints and DB model."""

import json
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
import yaml
from starlette.testclient import TestClient

from systemedu.core.config import reset_config
from systemedu.gateway.server import create_app


@pytest.fixture(autouse=True)
def clean_config():
    reset_config()
    yield
    reset_config()


@pytest.fixture
def config_env(tmp_path, monkeypatch):
    """Set up config for gateway tests."""
    home = tmp_path / ".systemedu"
    home.mkdir()
    config_file = home / "config.yaml"
    config_data = {
        "llm": {
            "default": "test",
            "providers": {
                "test": {
                    "base_url": "http://localhost:9999/v1",
                    "api_key": "test-key",
                    "model": "test-model",
                },
            },
        },
        "gateway": {"port": 18820, "host": "127.0.0.1"},
    }
    config_file.write_text(yaml.dump(config_data))
    monkeypatch.setattr("systemedu.core.config.CONFIG_FILE", config_file)
    monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", home)
    db_file = home / "systemedu.db"
    monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
    from systemedu.storage.db import reset_db
    reset_db()
    return home


@pytest.fixture
def client(config_env):
    from systemedu.gateway import server
    server._runtime = None
    app = create_app()
    c = TestClient(app)
    token = c.post("/api/auth/login", json={"username": "root", "password": "123systemedu"}).json()["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


class TestCapstoneDB:
    """Test CapstoneSubmission DB model."""

    def test_create_submission(self, config_env):
        from systemedu.storage.db import CapstoneSubmission, get_session

        db = get_session()
        try:
            sub = CapstoneSubmission(
                user_id="test_user",
                project_name="test-project",
                knode_id=12,
                attempt=1,
                checklist_json=json.dumps([{"artifact_id": "A1", "checked": True}]),
                reflections_json=json.dumps([{"criterion_idx": 0, "description": "I did it well"}]),
                file_url="/api/media/capstone/test.zip",
                file_name="test.zip",
                file_size=1024,
            )
            db.add(sub)
            db.commit()
            db.refresh(sub)
            assert sub.id is not None
            assert sub.status == "submitted"
            assert sub.score == 0.0
        finally:
            db.close()

    def test_unique_constraint(self, config_env):
        from sqlalchemy.exc import IntegrityError
        from systemedu.storage.db import CapstoneSubmission, get_session

        db = get_session()
        try:
            for _ in range(2):
                db.add(CapstoneSubmission(
                    user_id="u1", project_name="p1", knode_id=1, attempt=1,
                ))
            with pytest.raises(IntegrityError):
                db.commit()
        finally:
            db.rollback()
            db.close()


class TestCapstoneEndpoints:
    """Test capstone API endpoints."""

    def test_status_no_submissions(self, client):
        resp = client.get("/api/projects/test/nodes/12/capstone/status?user_id=default")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "none"
        assert data["submission_id"] is None

    def test_submissions_empty(self, client):
        resp = client.get("/api/projects/test/nodes/12/capstone/submissions?user_id=default")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_submit_requires_reflections(self, client):
        # Use files= to trigger multipart form encoding
        resp = client.post(
            "/api/projects/test/nodes/12/capstone/submit",
            data={"checklist": "[]", "reflections": "[]", "user_id": "default"},
            files={"_dummy": ("", BytesIO(b""), "application/octet-stream")},
        )
        assert resp.status_code == 400
        assert "Reflections are required" in resp.json()["error"]

    @patch("systemedu.gateway.server._grade_capstone_sync")
    @patch("systemedu.education.project_loader.load_project_context")
    def test_submit_with_reflections(self, mock_load, mock_grade, client, config_env):
        """Submit with reflections (no file) should succeed."""
        mock_knode = MagicMock()
        mock_knode.acceptance_standard = ["criterion 1", "criterion 2"]
        mock_ctx = MagicMock()
        mock_ctx.get_node_by_id.return_value = mock_knode
        mock_load.return_value = mock_ctx

        reflections = json.dumps([
            {"criterion_idx": 0, "description": "I completed this by doing X"},
            {"criterion_idx": 1, "description": "I completed this by doing Y"},
        ])
        checklist = json.dumps([{"artifact_id": "A1", "checked": True}])

        resp = client.post(
            "/api/projects/test/nodes/12/capstone/submit",
            data={
                "checklist": checklist,
                "reflections": reflections,
                "user_id": "default",
            },
            files={"_dummy": ("", BytesIO(b""), "application/octet-stream")},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "submitted"
        assert data["attempt"] == 1
        assert data["submission_id"] > 0

    @patch("systemedu.gateway.server._grade_capstone_sync")
    @patch("systemedu.education.project_loader.load_project_context")
    def test_submit_with_file(self, mock_load, mock_grade, client, config_env):
        """Submit with a file should store the file."""
        mock_knode = MagicMock()
        mock_knode.acceptance_standard = ["criterion 1"]
        mock_ctx = MagicMock()
        mock_ctx.get_node_by_id.return_value = mock_knode
        mock_load.return_value = mock_ctx

        reflections = json.dumps([
            {"criterion_idx": 0, "description": "I did this task carefully"},
        ])

        resp = client.post(
            "/api/projects/test/nodes/12/capstone/submit",
            data={
                "checklist": "[]",
                "reflections": reflections,
                "user_id": "default",
            },
            files={"file": ("my-work.zip", BytesIO(b"fake zip content"), "application/zip")},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["file_url"].endswith("my-work.zip")

        # Verify file was saved
        file_path = config_env / "media" / "capstone" / "test" / "12" / "default" / "attempt_1" / "my-work.zip"
        assert file_path.exists()
        assert file_path.read_bytes() == b"fake zip content"

    def test_submit_rejects_bad_extension(self, client):
        reflections = json.dumps([{"criterion_idx": 0, "description": "test description"}])
        resp = client.post(
            "/api/projects/test/nodes/12/capstone/submit",
            data={"checklist": "[]", "reflections": reflections, "user_id": "default"},
            files={"file": ("malware.exe", BytesIO(b"bad"), "application/octet-stream")},
        )
        assert resp.status_code == 400
        assert "not allowed" in resp.json()["error"]

    @patch("systemedu.gateway.server._grade_capstone_sync")
    @patch("systemedu.education.project_loader.load_project_context")
    def test_submissions_list(self, mock_load, mock_grade, client, config_env):
        """After submit, submissions list should return the record."""
        mock_knode = MagicMock()
        mock_knode.acceptance_standard = ["c1"]
        mock_ctx = MagicMock()
        mock_ctx.get_node_by_id.return_value = mock_knode
        mock_load.return_value = mock_ctx

        reflections = json.dumps([{"criterion_idx": 0, "description": "I did it well enough"}])

        client.post(
            "/api/projects/test/nodes/99/capstone/submit",
            data={"checklist": "[]", "reflections": reflections, "user_id": "default"},
            files={"_dummy": ("", BytesIO(b""), "application/octet-stream")},
        )

        resp = client.get("/api/projects/test/nodes/99/capstone/submissions?user_id=default")
        assert resp.status_code == 200
        subs = resp.json()
        assert len(subs) == 1
        assert subs[0]["attempt"] == 1
        assert subs[0]["status"] == "submitted"

    @patch("systemedu.gateway.server._grade_capstone_sync")
    @patch("systemedu.education.project_loader.load_project_context")
    def test_status_after_submit(self, mock_load, mock_grade, client, config_env):
        """Status should be 'submitted' right after submit."""
        mock_knode = MagicMock()
        mock_knode.acceptance_standard = ["c1"]
        mock_ctx = MagicMock()
        mock_ctx.get_node_by_id.return_value = mock_knode
        mock_load.return_value = mock_ctx

        reflections = json.dumps([{"criterion_idx": 0, "description": "good enough text"}])

        client.post(
            "/api/projects/test/nodes/50/capstone/submit",
            data={"checklist": "[]", "reflections": reflections, "user_id": "default"},
            files={"_dummy": ("", BytesIO(b""), "application/octet-stream")},
        )

        resp = client.get("/api/projects/test/nodes/50/capstone/status?user_id=default")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "submitted"
