"""Tests for gateway HTTP server."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml
from langchain_core.messages import AIMessage
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
    return home


@pytest.fixture
def client(config_env):
    app = create_app()
    return TestClient(app)


class TestGatewayAPI:
    def test_status_endpoint(self, client):
        resp = client.get("/api/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["running"] is True
        assert "version" in data
        assert "uptime" in data
        assert data["sessions"] == 0

    def test_config_endpoint(self, client):
        resp = client.get("/api/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["llm"]["default"] == "test"
        # API key should be masked
        assert data["llm"]["providers"]["test"]["api_key"] == "***"

    def test_sessions_empty(self, client):
        resp = client.get("/api/sessions")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_session_not_found(self, client):
        resp = client.get("/api/sessions/nonexistent")
        assert resp.status_code == 404

    def test_chat_requires_message(self, client):
        resp = client.post("/api/chat", json={"message": ""})
        assert resp.status_code == 400

    def test_dashboard_page(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "SystemEdu" in resp.text


class TestGatewayNewEndpoints:
    """Tests for newly added API endpoints (projects, agents, skills, mcp, config)."""

    def test_projects_endpoint(self, config_env, tmp_path, monkeypatch):
        """GET /api/projects returns project list."""
        # Create a test project
        projects_dir = tmp_path / "projects"
        projects_dir.mkdir()
        proj = projects_dir / "test-proj"
        proj.mkdir()
        (proj / "project.yaml").write_text(
            yaml.dump(
                {
                    "name": "test-proj",
                    "title": "Test Project",
                    "description": "A test",
                    "category": "ai",
                }
            )
        )
        monkeypatch.chdir(tmp_path)

        app = create_app()
        client = TestClient(app)
        resp = client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        proj_data = [p for p in data if p["name"] == "test-proj"]
        assert len(proj_data) == 1
        assert proj_data[0]["title"] == "Test Project"
        assert proj_data[0]["category"] == "ai"

    def test_projects_empty(self, config_env, tmp_path, monkeypatch):
        """GET /api/projects returns empty list when no projects exist."""
        empty_dir = tmp_path / "empty_cwd"
        empty_dir.mkdir()
        monkeypatch.chdir(empty_dir)
        # Override home to avoid scanning real ~/projects
        monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path / "fakehome")
        app = create_app()
        client = TestClient(app)
        resp = client.get("/api/projects")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_project_detail_not_found(self, client):
        """GET /api/projects/{name} returns 404 for missing project."""
        resp = client.get("/api/projects/nonexistent")
        assert resp.status_code == 404

    def test_agents_endpoint(self, client):
        """GET /api/agents returns agent list."""
        resp = client.get("/api/agents")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 3
        names = [a["name"] for a in data]
        assert "tutor" in names
        assert "planner" in names
        assert "assessor" in names

    def test_skills_endpoint(self, client):
        """GET /api/skills returns skill list."""
        resp = client.get("/api/skills")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # Each skill should have expected fields
        for skill in data:
            assert "name" in skill
            assert "description" in skill

    def test_mcp_servers_empty(self, client):
        """GET /api/mcp/servers returns empty list when no servers configured."""
        resp = client.get("/api/mcp/servers")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_mcp_add_and_remove(self, config_env):
        """POST/DELETE /api/mcp/servers lifecycle."""
        app = create_app()
        client = TestClient(app)

        # Add
        resp = client.post(
            "/api/mcp/servers",
            json={"name": "test-mcp", "command": "npx", "args": ["@test/mcp"]},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "added"

        # Verify it's listed
        reset_config()
        app2 = create_app()
        client2 = TestClient(app2)
        resp = client2.get("/api/mcp/servers")
        assert resp.status_code == 200
        names = [s["name"] for s in resp.json()]
        assert "test-mcp" in names

        # Remove
        reset_config()
        app3 = create_app()
        client3 = TestClient(app3)
        resp = client3.delete("/api/mcp/servers/test-mcp")
        assert resp.status_code == 200
        assert resp.json()["status"] == "removed"

    def test_mcp_add_requires_fields(self, client):
        """POST /api/mcp/servers requires name and command."""
        resp = client.post("/api/mcp/servers", json={"name": ""})
        assert resp.status_code == 400

    def test_mcp_remove_not_found(self, client):
        """DELETE /api/mcp/servers/{name} returns 404 for missing server."""
        resp = client.delete("/api/mcp/servers/nonexistent")
        assert resp.status_code == 404

    def test_config_update(self, config_env):
        """PUT /api/config updates config values."""
        app = create_app()
        client = TestClient(app)

        resp = client.put(
            "/api/config",
            json={"llm": {"default": "claude"}},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "updated"

        # Verify the change persists
        reset_config()
        app2 = create_app()
        client2 = TestClient(app2)
        resp = client2.get("/api/config")
        assert resp.json()["llm"]["default"] == "claude"


class TestGatewayChatUserId:
    def test_chat_with_user_id(self, config_env):
        """POST /api/chat with user_id should pass it to process_message."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="hello user"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            app = create_app()
            client = TestClient(app)

            resp = client.post(
                "/api/chat",
                json={"message": "hi", "user_id": "user42"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["response"] == "hello user"

    def test_chat_default_user_id(self, config_env):
        """POST /api/chat without user_id should default to 'default'."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="ok"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            app = create_app()
            client = TestClient(app)

            resp = client.post(
                "/api/chat",
                json={"message": "test"},
            )
            assert resp.status_code == 200
            assert resp.json()["response"] == "ok"
