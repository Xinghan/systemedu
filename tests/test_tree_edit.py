"""Tests for PUT /api/projects/{name}/tree endpoint."""

import json
from pathlib import Path

import pytest
import yaml
from starlette.testclient import TestClient

from systemedu.core.config import reset_config


# -- Minimal valid knowledge tree --

MINIMAL_TREE = {
    "milestones": [
        {
            "title": "Milestone 1",
            "description": "First milestone",
            "order": 0,
            "xp_reward": 100,
            "knodes": [
                {
                    "id": 0,
                    "title": "Node 1",
                    "summary": "First node",
                    "difficulty_level": 3,
                    "content_type": "text",
                    "acceptance_type": "auto",
                    "estimated_minutes": 10,
                    "xp_reward": 50,
                    "prerequisite_indices": [],
                },
                {
                    "id": 1,
                    "title": "Node 2",
                    "summary": "Second node",
                    "difficulty_level": 5,
                    "content_type": "text",
                    "acceptance_type": "auto",
                    "estimated_minutes": 15,
                    "xp_reward": 75,
                    "prerequisite_indices": [0],
                },
            ],
        }
    ]
}


@pytest.fixture(autouse=True)
def clean_config():
    reset_config()
    yield
    reset_config()


@pytest.fixture
def project_dir(tmp_path):
    """Create a minimal project directory with project.yaml and knowledge_tree.json."""
    pdir = tmp_path / "projects" / "test-proj"
    pdir.mkdir(parents=True)

    proj_data = {
        "name": "test-proj",
        "title": "Test Project",
        "description": "A test project",
        "category": "test",
        "age_range": [8, 14],
        "estimated_hours": 2,
        "tags": [],
    }
    (pdir / "project.yaml").write_text(yaml.dump(proj_data), encoding="utf-8")
    (pdir / "knowledge_tree.json").write_text(
        json.dumps(MINIMAL_TREE, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return pdir


@pytest.fixture
def client(tmp_path, monkeypatch, project_dir):
    """Create a test client with a temp config and project dir."""
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
    monkeypatch.setattr("systemedu.core.storage.db.DB_FILE", db_file)

    from systemedu.core.storage.db import reset_db
    reset_db()

    # Patch find_project_dir to return our temp project dir
    monkeypatch.setattr(
        "systemedu.cloud.gateway.server.api_update_tree.__module__",
        "systemedu.cloud.gateway.server",
    )

    def _fake_find(name: str) -> Path:
        if name == "test-proj":
            return project_dir
        raise FileNotFoundError(f"Project '{name}' not found")

    monkeypatch.setattr(
        "systemedu.core.education.project_loader.find_project_dir",
        _fake_find,
    )

    from systemedu.cloud.gateway import server
    server._runtime = None
    from systemedu.cloud.gateway.server import create_app
    app = create_app()
    c = TestClient(app)
    token = c.post("/api/auth/login", json={"username": "root", "password": "123systemedu"}).json()["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


class TestUpdateTreeAPI:
    def test_put_tree_updates_file(self, client, project_dir):
        """PUT /api/projects/{name}/tree should write updated tree to knowledge_tree.json."""
        updated_tree = {
            "milestones": [
                {
                    "title": "Updated Milestone",
                    "description": "Updated description",
                    "order": 0,
                    "xp_reward": 200,
                    "knodes": [
                        {
                            "id": 0,
                            "title": "Updated Node",
                            "summary": "Updated summary",
                            "difficulty_level": 7,
                            "content_type": "text",
                            "acceptance_type": "auto",
                            "estimated_minutes": 20,
                            "xp_reward": 100,
                            "prerequisite_indices": [],
                        }
                    ],
                }
            ]
        }

        resp = client.put("/api/projects/test-proj/tree", json=updated_tree)
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True

        # Verify file was written (now stored as v5 format)
        written = json.loads((project_dir / "knowledge_tree.json").read_text())
        assert "stages" in written
        assert "modules" in written
        assert written["stages"][0]["title"] == "Updated Milestone"
        assert written["modules"][0]["title"] == "Updated Node"

    def test_put_tree_not_found(self, client):
        """PUT for non-existent project should return 404."""
        resp = client.put("/api/projects/nonexistent/tree", json={"milestones": []})
        assert resp.status_code == 404
        assert "not found" in resp.json()["error"].lower()

    def test_put_tree_invalid_body(self, client):
        """PUT with missing milestones key should return 400."""
        resp = client.put("/api/projects/test-proj/tree", json={"foo": "bar"})
        assert resp.status_code == 400

    def test_put_tree_multiple_milestones(self, client, project_dir):
        """PUT with multiple milestones preserves all of them."""
        tree = {
            "milestones": [
                {
                    "title": "MS A",
                    "description": "A",
                    "order": 0,
                    "xp_reward": 100,
                    "knodes": [
                        {
                            "id": 0,
                            "title": "Node A1",
                            "summary": "",
                            "difficulty_level": 2,
                            "content_type": "text",
                            "acceptance_type": "auto",
                            "estimated_minutes": 10,
                            "xp_reward": 50,
                            "prerequisite_indices": [],
                        }
                    ],
                },
                {
                    "title": "MS B",
                    "description": "B",
                    "order": 1,
                    "xp_reward": 200,
                    "knodes": [
                        {
                            "id": 1,
                            "title": "Node B1",
                            "summary": "",
                            "difficulty_level": 4,
                            "content_type": "text",
                            "acceptance_type": "auto",
                            "estimated_minutes": 15,
                            "xp_reward": 75,
                            "prerequisite_indices": [0],
                        }
                    ],
                },
            ]
        }
        resp = client.put("/api/projects/test-proj/tree", json=tree)
        assert resp.status_code == 200

        written = json.loads((project_dir / "knowledge_tree.json").read_text())
        assert len(written["stages"]) == 2
        assert written["stages"][1]["title"] == "MS B"

    def test_put_tree_returns_milestones(self, client):
        """PUT response body should include the updated milestones."""
        tree = {
            "milestones": [
                {
                    "title": "Return Check",
                    "description": "desc",
                    "order": 0,
                    "xp_reward": 50,
                    "knodes": [
                        {
                            "id": 0,
                            "title": "N",
                            "summary": "",
                            "difficulty_level": 1,
                            "content_type": "text",
                            "acceptance_type": "auto",
                            "estimated_minutes": 5,
                            "xp_reward": 25,
                            "prerequisite_indices": [],
                        }
                    ],
                }
            ]
        }
        resp = client.put("/api/projects/test-proj/tree", json=tree)
        assert resp.status_code == 200
        data = resp.json()
        assert data["milestones"][0]["title"] == "Return Check"
