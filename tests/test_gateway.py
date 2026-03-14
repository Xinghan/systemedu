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


class TestGatewayChatUserId:
    def test_chat_with_user_id(self, config_env):
        """POST /api/chat with user_id should pass it to process_message."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="hello user"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
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

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            app = create_app()
            client = TestClient(app)

            resp = client.post(
                "/api/chat",
                json={"message": "test"},
            )
            assert resp.status_code == 200
            assert resp.json()["response"] == "ok"
