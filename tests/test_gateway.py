"""Tests for gateway HTTP server."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml
from langchain_core.messages import AIMessage
from starlette.testclient import TestClient

from systemedu.core.config import reset_config
from systemedu.gateway.server import create_app


def _auth_client(app) -> TestClient:
    """Create an authenticated TestClient."""
    c = TestClient(app)
    token = c.post("/api/auth/login", json={"username": "root", "password": "123systemedu"}).json()["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


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
    # Point DB to temp dir so sessions load from a clean database
    db_file = home / "systemedu.db"
    monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
    from systemedu.storage.db import reset_db
    reset_db()
    return home


@pytest.fixture
def client(config_env):
    from systemedu.gateway import server
    server._runtime = None  # Reset cached runtime
    app = create_app()
    c = TestClient(app)
    token = c.post("/api/auth/login", json={"username": "root", "password": "123systemedu"}).json()["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


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
        client = _auth_client(app)
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
        client = _auth_client(app)
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
        client = _auth_client(app)

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
        client2 = _auth_client(app2)
        resp = client2.get("/api/mcp/servers")
        assert resp.status_code == 200
        names = [s["name"] for s in resp.json()]
        assert "test-mcp" in names

        # Remove
        reset_config()
        app3 = create_app()
        client3 = _auth_client(app3)
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
        client = _auth_client(app)

        resp = client.put(
            "/api/config",
            json={"llm": {"default": "claude"}},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "updated"

        # Verify the change persists
        reset_config()
        app2 = create_app()
        client2 = _auth_client(app2)
        resp = client2.get("/api/config")
        assert resp.json()["llm"]["default"] == "claude"


class TestGatewayNodeContext:
    """Tests for GET /api/projects/{name}/nodes/{node_id}/context."""

    def test_node_context_project_not_found(self, client):
        """Returns 404 when project doesn't exist."""
        resp = client.get("/api/projects/nonexistent/nodes/0/context")
        assert resp.status_code == 404

    def test_node_context_returns_cached(self, config_env, tmp_path, monkeypatch):
        """Returns cached context if available."""
        from systemedu.storage.db import NodeContextCache, get_session as get_db_session, reset_db

        # Set up DB in tmp
        db_file = tmp_path / "test_ctx.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        reset_db()

        db = get_db_session()
        cache = NodeContextCache(
            project_name="test-proj",
            knode_id=0,
            prerequisites_trace="prereq text",
            learning_suggestions="suggestions text",
            related_extensions="extensions text",
        )
        db.add(cache)
        db.commit()
        db.close()

        app = create_app()
        client = _auth_client(app)
        resp = client.get("/api/projects/test-proj/nodes/0/context")
        assert resp.status_code == 200
        data = resp.json()
        assert data["knode_id"] == 0
        assert data["prerequisites_trace"] == "prereq text"
        assert data["learning_suggestions"] == "suggestions text"
        assert data["related_extensions"] == "extensions text"

        reset_db()


class TestGatewayLessonAPI:
    """Tests for lesson content API endpoints."""

    def test_lesson_get_pending(self, config_env, tmp_path, monkeypatch):
        """GET /api/projects/{name}/nodes/{id}/lesson returns pending when no content exists."""
        db_file = tmp_path / "test_lesson.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.get("/api/projects/test-proj/nodes/0/lesson")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data["knode_id"] == 0
        assert data["concept"] == ""

        reset_db()

    def test_lesson_get_existing(self, config_env, tmp_path, monkeypatch):
        """GET /api/projects/{name}/nodes/{id}/lesson returns content when it exists."""
        db_file = tmp_path / "test_lesson2.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import LessonContent, get_session as get_db_session, reset_db
        reset_db()

        db = get_db_session()
        lesson = LessonContent(
            project_name="test-proj",
            knode_id=0,
            status="ready",
            concept="Test concept",
            examples="Test examples",
        )
        db.add(lesson)
        db.commit()
        db.close()

        app = create_app()
        client = _auth_client(app)
        resp = client.get("/api/projects/test-proj/nodes/0/lesson")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ready"
        assert data["concept"] == "Test concept"
        assert data["examples"] == "Test examples"

        reset_db()

    def test_lesson_get_json_examples(self, config_env, tmp_path, monkeypatch):
        """GET lesson with JSON examples returns valid structured content."""
        import json as json_mod
        db_file = tmp_path / "test_lesson_json.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import LessonContent, get_session as get_db_session, reset_db
        reset_db()

        examples_json = json_mod.dumps({
            "examples": [
                {
                    "template": "step-by-step",
                    "title": "测试步骤",
                    "data": {
                        "steps": [
                            {"title": "步骤1", "content": "内容1", "highlight": "关键"},
                            {"title": "步骤2", "content": "内容2"},
                        ]
                    },
                    "fallback_markdown": "## 步骤\n1. 步骤1\n2. 步骤2",
                },
                {
                    "template": "comparison",
                    "title": "对比示例",
                    "data": {
                        "left": {"label": "A", "points": ["点1"]},
                        "right": {"label": "B", "points": ["点2"]},
                        "conclusion": "总结",
                    },
                    "fallback_markdown": "A vs B",
                },
            ]
        })

        db = get_db_session()
        lesson = LessonContent(
            project_name="test-proj",
            knode_id=1,
            status="ready",
            concept="Test concept",
            examples=examples_json,
        )
        db.add(lesson)
        db.commit()
        db.close()

        app = create_app()
        client = _auth_client(app)
        resp = client.get("/api/projects/test-proj/nodes/1/lesson")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ready"
        # Verify examples is valid JSON with expected structure
        parsed = json_mod.loads(data["examples"])
        assert "examples" in parsed
        assert len(parsed["examples"]) == 2
        assert parsed["examples"][0]["template"] == "step-by-step"
        assert parsed["examples"][1]["template"] == "comparison"

        reset_db()

    def test_update_progress(self, config_env, tmp_path, monkeypatch):
        """PATCH /api/projects/{name}/nodes/{id}/progress updates status and returns full progress."""
        db_file = tmp_path / "test_progress.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.patch(
            "/api/projects/test-proj/nodes/0/progress",
            json={"status": "passed"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "passed"
        assert data["knode_id"] == 0
        assert "progress" in data
        assert isinstance(data["progress"], list)
        assert "unlocked" in data

        reset_db()

    def test_update_progress_invalid_status(self, config_env, tmp_path, monkeypatch):
        """PATCH /api/projects/{name}/nodes/{id}/progress rejects invalid status."""
        db_file = tmp_path / "test_progress2.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.patch(
            "/api/projects/test-proj/nodes/0/progress",
            json={"status": "invalid"},
        )
        assert resp.status_code == 400

        reset_db()

    def test_update_progress_missing_status(self, config_env, tmp_path, monkeypatch):
        """PATCH /api/projects/{name}/nodes/{id}/progress requires status field."""
        db_file = tmp_path / "test_progress3.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.patch(
            "/api/projects/test-proj/nodes/0/progress",
            json={},
        )
        assert resp.status_code == 400

        reset_db()


class TestGatewayUnlockNodes:
    """Tests for node unlock on progress update."""

    def test_passing_node_unlocks_dependents(self, config_env, tmp_path, monkeypatch):
        """When a node is marked 'passed', dependent nodes should be unlocked."""
        import json
        db_file = tmp_path / "test_unlock.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        # Create a project with prerequisite chain: node0 → node1
        project_dir = tmp_path / "projects" / "unlock-test"
        project_dir.mkdir(parents=True)
        (project_dir / "project.yaml").write_text(
            yaml.dump({
                "name": "unlock-test",
                "title": "Unlock Test",
                "knowledge_tree": "./knowledge_tree.json",
            })
        )
        tree_data = {
            "milestones": [
                {
                    "title": "基础",
                    "knodes": [
                        {
                            "title": "Node 0",
                            "summary": "First node",
                            "difficulty_level": 1,
                            "estimated_minutes": 10,
                            "xp_reward": 100,
                            "prerequisite_indices": [],
                        },
                        {
                            "title": "Node 1",
                            "summary": "Second node, depends on Node 0",
                            "difficulty_level": 2,
                            "estimated_minutes": 15,
                            "xp_reward": 150,
                            "prerequisite_indices": [0],
                        },
                    ],
                }
            ],
        }
        (project_dir / "knowledge_tree.json").write_text(
            json.dumps(tree_data, ensure_ascii=False)
        )

        monkeypatch.setattr(
            "systemedu.education.project_loader.find_project_dir",
            lambda name: project_dir,
        )

        # Initialize progress via loading context (creates initial records)
        from systemedu.education.project_loader import load_project_context
        ctx = load_project_context("unlock-test", user_id="default", project_dir=project_dir)
        # Node 0 should be available, node 1 should be locked
        assert ctx.progress[0].status.value == "available"
        assert ctx.progress[1].status.value == "locked"

        app = create_app()
        client = _auth_client(app)

        # Mark node 0 as passed
        resp = client.patch(
            "/api/projects/unlock-test/nodes/0/progress",
            json={"status": "passed"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "passed"
        assert 1 in data["unlocked"]

        # Check the full progress list: node 1 should now be available
        progress_map = {p["knode_id"]: p["status"] for p in data["progress"]}
        assert progress_map[0] == "passed"
        assert progress_map[1] == "available"

        reset_db()


class TestGatewayCreateProject:
    """Tests for POST /api/projects and POST /api/projects/preview-tree."""

    TREE_LEAF_DATA = {
        "项目名称": "测试项目",
        "模块依赖图": [
            {"模块id": "M01", "模块标题": "基础", "前置模块": []},
        ],
        "知识树节点": [
            {
                "id": "M01N01",
                "模块id": "M01",
                "标题": "节点1",
                "详细描述": "描述1",
                "知识等级": "L0-启蒙",
                "预估学习时长_分钟": 10,
                "先修节点": [],
                "学习目标": ["目标1"],
                "完成标记": "quiz",
                "是否核心": True,
            },
        ],
    }

    MILESTONES_DATA = {
        "milestones": [
            {
                "title": "基础",
                "knodes": [
                    {
                        "title": "节点1",
                        "summary": "描述1",
                        "difficulty_level": 1,
                        "estimated_minutes": 10,
                        "prerequisite_indices": [],
                    }
                ],
            }
        ]
    }

    def test_preview_tree_leaf_format(self, config_env):
        """POST /api/projects/preview-tree converts and validates tree_leaf format."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects/preview-tree",
            json={"tree_data": self.TREE_LEAF_DATA},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True
        assert data["stats"]["node_count"] == 1
        assert data["stats"]["milestone_count"] == 1
        assert len(data["milestones"]) == 1
        assert data["errors"] == []

    def test_preview_milestones_format(self, config_env):
        """POST /api/projects/preview-tree passes through milestones format."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects/preview-tree",
            json={"tree_data": self.MILESTONES_DATA},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True

    def test_preview_invalid_format(self, config_env):
        """POST /api/projects/preview-tree rejects unrecognized format."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects/preview-tree",
            json={"tree_data": {"random": "data"}},
        )
        assert resp.status_code == 400

    def test_preview_missing_tree_data(self, config_env):
        """POST /api/projects/preview-tree requires tree_data."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post("/api/projects/preview-tree", json={})
        assert resp.status_code == 400

    def test_create_project(self, config_env, tmp_path, monkeypatch):
        """POST /api/projects creates a project on disk."""
        monkeypatch.chdir(tmp_path)
        (tmp_path / "projects").mkdir()

        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects",
            json={
                "name": "test-proj-new",
                "tree_data": self.TREE_LEAF_DATA,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["created"] is True
        assert data["name"] == "test-proj-new"

        # Verify files on disk
        proj_dir = tmp_path / "projects" / "test-proj-new"
        assert (proj_dir / "project.yaml").exists()
        assert (proj_dir / "knowledge_tree.json").exists()

    def test_create_project_missing_name(self, config_env):
        """POST /api/projects requires name."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects",
            json={"tree_data": self.MILESTONES_DATA},
        )
        assert resp.status_code == 400

    def test_create_project_duplicate(self, config_env, tmp_path, monkeypatch):
        """POST /api/projects returns 409 for existing project."""
        monkeypatch.chdir(tmp_path)
        proj_dir = tmp_path / "projects" / "existing-proj"
        proj_dir.mkdir(parents=True)

        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects",
            json={
                "name": "existing-proj",
                "tree_data": self.MILESTONES_DATA,
            },
        )
        assert resp.status_code == 409

    def test_create_project_with_milestones_format(self, config_env, tmp_path, monkeypatch):
        """POST /api/projects works with milestones format directly."""
        monkeypatch.chdir(tmp_path)
        (tmp_path / "projects").mkdir()

        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects",
            json={
                "name": "ms-proj",
                "title": "Milestones Project",
                "tree_data": self.MILESTONES_DATA,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["created"] is True

    def test_create_project_saves_tags_and_description(self, config_env, tmp_path, monkeypatch):
        """POST /api/projects persists tags and description to project.yaml."""
        import yaml as _yaml
        monkeypatch.chdir(tmp_path)
        (tmp_path / "projects").mkdir()

        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects",
            json={
                "name": "tagged-proj",
                "title": "Tagged Project",
                "tree_data": self.MILESTONES_DATA,
                "description": "A project about rockets.",
                "tags": ["aerospace", "physics"],
                "age_range": [10, 14],
            },
        )
        assert resp.status_code == 200

        # Verify project.yaml on disk contains the tags and description
        yaml_path = tmp_path / "projects" / "tagged-proj" / "project.yaml"
        assert yaml_path.exists()
        data = _yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        assert data["tags"] == ["aerospace", "physics"]
        assert data["description"] == "A project about rockets."
        assert data["age_range"] == [10, 14]


class TestGatewayEnrollment:
    """Tests for enrollment API endpoints."""

    def test_enroll_project_not_found(self, config_env, tmp_path, monkeypatch):
        """POST /api/projects/{name}/enroll returns 404 for missing project."""
        monkeypatch.chdir(tmp_path)
        db_file = tmp_path / "test_enroll.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.post("/api/projects/nonexistent/enroll", json={})
        assert resp.status_code == 404

        reset_db()

    def test_enroll_creates_enrollment(self, config_env, tmp_path, monkeypatch):
        """POST /api/projects/{name}/enroll creates an enrollment record."""
        # Create a minimal project on disk
        monkeypatch.chdir(tmp_path)
        projects_dir = tmp_path / "projects"
        projects_dir.mkdir()
        proj = projects_dir / "enroll-test"
        proj.mkdir()
        (proj / "project.yaml").write_text(
            yaml.dump({
                "name": "enroll-test",
                "title": "Enroll Test",
                "description": "Test project",
                "category": "ai",
            })
        )
        import json
        (proj / "knowledge_tree.json").write_text(json.dumps({
            "milestones": [{
                "title": "M1",
                "description": "",
                "order": 0,
                "xp_reward": 100,
                "knodes": [{
                    "title": "N1",
                    "summary": "node",
                    "difficulty_level": 1,
                    "content_type": "text",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 10,
                    "xp_reward": 10,
                    "prerequisite_indices": [],
                }],
            }],
        }))

        db_file = tmp_path / "test_enroll2.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.post("/api/projects/enroll-test/enroll", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["started_at"] is not None
        assert data["total_nodes"] == 1
        assert data["nodes_passed"] == 0

        reset_db()

    def test_get_enrollment_not_enrolled(self, config_env, tmp_path, monkeypatch):
        """GET /api/projects/{name}/enrollment returns null when not enrolled."""
        db_file = tmp_path / "test_enroll3.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.get("/api/projects/some-proj/enrollment")
        assert resp.status_code == 200
        assert resp.json() is None

        reset_db()

    def test_get_enrollment_exists(self, config_env, tmp_path, monkeypatch):
        """GET /api/projects/{name}/enrollment returns enrollment data."""
        db_file = tmp_path / "test_enroll4.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import Enrollment, get_session as get_db_session, reset_db
        from datetime import datetime
        reset_db()

        db = get_db_session()
        enrollment = Enrollment(
            user_id="default",
            project_name="test-proj",
            status="active",
            started_at=datetime(2026, 1, 1, 10, 0, 0),
            total_nodes=5,
            nodes_passed=2,
            total_time_seconds=3600,
        )
        db.add(enrollment)
        db.commit()
        db.close()

        app = create_app()
        client = _auth_client(app)
        resp = client.get("/api/projects/test-proj/enrollment")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["total_nodes"] == 5
        assert data["nodes_passed"] == 2
        assert data["total_time_seconds"] == 3600

        reset_db()

    def test_update_enrollment_not_enrolled(self, config_env, tmp_path, monkeypatch):
        """PATCH /api/projects/{name}/enrollment returns 404 when not enrolled."""
        db_file = tmp_path / "test_enroll5.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.patch(
            "/api/projects/some-proj/enrollment",
            json={"add_time_seconds": 60},
        )
        assert resp.status_code == 404

        reset_db()

    def test_update_enrollment_add_time(self, config_env, tmp_path, monkeypatch):
        """PATCH /api/projects/{name}/enrollment adds learning time."""
        db_file = tmp_path / "test_enroll6.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import Enrollment, get_session as get_db_session, reset_db
        from datetime import datetime
        reset_db()

        db = get_db_session()
        enrollment = Enrollment(
            user_id="default",
            project_name="time-proj",
            status="active",
            started_at=datetime.now(),
            total_time_seconds=100,
        )
        db.add(enrollment)
        db.commit()
        db.close()

        app = create_app()
        client = _auth_client(app)
        resp = client.patch(
            "/api/projects/time-proj/enrollment",
            json={"add_time_seconds": 60},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_time_seconds"] == 160

        reset_db()

    def test_update_enrollment_pause(self, config_env, tmp_path, monkeypatch):
        """PATCH /api/projects/{name}/enrollment can pause enrollment."""
        db_file = tmp_path / "test_enroll7.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import Enrollment, get_session as get_db_session, reset_db
        from datetime import datetime
        reset_db()

        db = get_db_session()
        enrollment = Enrollment(
            user_id="default",
            project_name="pause-proj",
            status="active",
            started_at=datetime.now(),
        )
        db.add(enrollment)
        db.commit()
        db.close()

        app = create_app()
        client = _auth_client(app)
        resp = client.patch(
            "/api/projects/pause-proj/enrollment",
            json={"status": "paused"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "paused"

        reset_db()

    def test_project_detail_includes_enrollment(self, config_env, tmp_path, monkeypatch):
        """GET /api/projects/{name} includes enrollment field."""
        monkeypatch.chdir(tmp_path)
        projects_dir = tmp_path / "projects"
        projects_dir.mkdir()
        proj = projects_dir / "detail-test"
        proj.mkdir()
        (proj / "project.yaml").write_text(
            yaml.dump({
                "name": "detail-test",
                "title": "Detail Test",
                "description": "Test",
                "category": "ai",
            })
        )
        import json
        (proj / "knowledge_tree.json").write_text(json.dumps({
            "milestones": [{
                "title": "M1",
                "description": "",
                "order": 0,
                "xp_reward": 100,
                "knodes": [{
                    "title": "N1",
                    "summary": "node",
                    "difficulty_level": 1,
                    "content_type": "text",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 10,
                    "xp_reward": 10,
                    "prerequisite_indices": [],
                }],
            }],
        }))

        db_file = tmp_path / "test_detail.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)
        resp = client.get("/api/projects/detail-test")
        assert resp.status_code == 200
        data = resp.json()
        # No enrollment yet
        assert data["enrollment"] is None

        # Now enroll
        resp = client.post("/api/projects/detail-test/enroll", json={})
        assert resp.status_code == 200

        # Check detail again
        resp = client.get("/api/projects/detail-test")
        data = resp.json()
        assert data["enrollment"] is not None
        assert data["enrollment"]["status"] == "active"

        reset_db()

    def test_auto_complete_on_all_nodes_passed(self, config_env, tmp_path, monkeypatch):
        """When all nodes pass, enrollment status changes to completed."""
        monkeypatch.chdir(tmp_path)
        projects_dir = tmp_path / "projects"
        projects_dir.mkdir()
        proj = projects_dir / "complete-test"
        proj.mkdir()
        (proj / "project.yaml").write_text(
            yaml.dump({
                "name": "complete-test",
                "title": "Complete Test",
                "description": "Test",
                "category": "ai",
            })
        )
        import json
        (proj / "knowledge_tree.json").write_text(json.dumps({
            "milestones": [{
                "title": "M1",
                "description": "",
                "order": 0,
                "xp_reward": 100,
                "knodes": [{
                    "title": "N1",
                    "summary": "node",
                    "difficulty_level": 1,
                    "content_type": "text",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 10,
                    "xp_reward": 10,
                    "prerequisite_indices": [],
                }],
            }],
        }))

        db_file = tmp_path / "test_complete.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()

        app = create_app()
        client = _auth_client(app)

        # Enroll first (total_nodes=1)
        resp = client.post("/api/projects/complete-test/enroll", json={})
        assert resp.status_code == 200
        assert resp.json()["total_nodes"] == 1

        # Pass the only node
        resp = client.patch(
            "/api/projects/complete-test/nodes/0/progress",
            json={"status": "passed"},
        )
        assert resp.status_code == 200

        # Check enrollment is now completed
        resp = client.get("/api/projects/complete-test/enrollment")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["nodes_passed"] == 1

        reset_db()


class TestGatewayChatUserId:
    def test_chat_with_user_id(self, config_env):
        """POST /api/chat with user_id should pass it to process_message."""
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content="hello user")]
        })

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=MagicMock()),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent),
        ):
            app = create_app()
            client = _auth_client(app)

            resp = client.post(
                "/api/chat",
                json={"message": "hi", "user_id": "user42"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["response"] == "hello user"

    def test_chat_default_user_id(self, config_env):
        """POST /api/chat without user_id should default to 'default'."""
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content="ok")]
        })

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=MagicMock()),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent),
        ):
            app = create_app()
            client = _auth_client(app)

            resp = client.post(
                "/api/chat",
                json={"message": "test"},
            )
            assert resp.status_code == 200
            assert resp.json()["response"] == "ok"


class TestGatewayGenerateTree:
    """Tests for POST /api/projects/generate-tree."""

    def test_generate_tree_missing_fields(self, config_env):
        """POST /api/projects/generate-tree requires title and description."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post("/api/projects/generate-tree", json={"title": "test"})
        assert resp.status_code == 400
        assert "description" in resp.json()["error"]

    def test_generate_tree_empty_title(self, config_env):
        """POST /api/projects/generate-tree rejects empty title."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post(
            "/api/projects/generate-tree",
            json={"title": "", "description": "some desc"},
        )
        assert resp.status_code == 400

    def test_generate_tree_success(self, config_env):
        """POST /api/projects/generate-tree returns TreePreviewResponse on success."""
        from systemedu.education.models import KnowledgeTree, Milestone, KnowledgeNode

        mock_tree = KnowledgeTree(
            milestones=[
                Milestone(
                    title="基础模块",
                    knodes=[
                        KnowledgeNode(
                            title="节点1",
                            summary="描述",
                            difficulty_level=1,
                            estimated_minutes=20,
                            prerequisite_indices=[],
                        ),
                        KnowledgeNode(
                            title="节点2",
                            summary="描述2",
                            difficulty_level=2,
                            estimated_minutes=30,
                            prerequisite_indices=[0],
                        ),
                    ],
                )
            ]
        )

        with patch(
            "systemedu.education.tree_generator.generate_knowledge_tree",
            new_callable=AsyncMock,
            return_value=mock_tree,
        ):
            app = create_app()
            client = _auth_client(app)
            resp = client.post(
                "/api/projects/generate-tree",
                json={"title": "AI 树叶识别", "description": "学习用AI识别树叶种类", "age": 10},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["valid"] is True
            assert data["stats"]["milestone_count"] == 1
            assert data["stats"]["node_count"] == 2
            assert data["stats"]["total_minutes"] == 50
            assert data["stats"]["estimated_hours"] == 1
            assert len(data["milestones"]) == 1
            assert data["meta"]["title"] == "AI 树叶识别"
            assert data["errors"] == []

    def test_generate_tree_llm_failure(self, config_env):
        """POST /api/projects/generate-tree returns 500 when LLM fails."""
        with patch(
            "systemedu.education.tree_generator.generate_knowledge_tree",
            new_callable=AsyncMock,
            side_effect=RuntimeError("LLM timeout"),
        ):
            app = create_app()
            client = _auth_client(app)
            resp = client.post(
                "/api/projects/generate-tree",
                json={"title": "Test", "description": "Test project"},
            )
            assert resp.status_code == 500
            assert "AI 生成失败" in resp.json()["error"]

    def test_generate_tree_with_node_count(self, config_env):
        """POST /api/projects/generate-tree passes node_count to generate_knowledge_tree."""
        from systemedu.education.models import KnowledgeTree, Milestone, KnowledgeNode

        mock_tree = KnowledgeTree(
            milestones=[
                Milestone(
                    title="M1",
                    knodes=[
                        KnowledgeNode(
                            title="N1", summary="d", difficulty_level=1,
                            estimated_minutes=10, prerequisite_indices=[],
                        ),
                    ],
                )
            ]
        )

        with patch(
            "systemedu.education.tree_generator.generate_knowledge_tree",
            new_callable=AsyncMock,
            return_value=mock_tree,
        ) as mock_gen:
            app = create_app()
            client = _auth_client(app)
            resp = client.post(
                "/api/projects/generate-tree",
                json={"title": "Test", "description": "Desc", "node_count": 100},
            )
            assert resp.status_code == 200
            mock_gen.assert_called_once()
            call_kwargs = mock_gen.call_args[1]
            assert call_kwargs["target_nodes"] == 100

    def test_generate_tree_node_count_clamped(self, config_env):
        """node_count should be clamped to [5, 500]."""
        from systemedu.education.models import KnowledgeTree, Milestone, KnowledgeNode

        mock_tree = KnowledgeTree(
            milestones=[
                Milestone(
                    title="M1",
                    knodes=[
                        KnowledgeNode(
                            title="N1", summary="d", difficulty_level=1,
                            estimated_minutes=10, prerequisite_indices=[],
                        ),
                    ],
                )
            ]
        )

        with patch(
            "systemedu.education.tree_generator.generate_knowledge_tree",
            new_callable=AsyncMock,
            return_value=mock_tree,
        ) as mock_gen:
            app = create_app()
            client = _auth_client(app)
            # Test clamping below minimum
            resp = client.post(
                "/api/projects/generate-tree",
                json={"title": "T", "description": "D", "node_count": 1},
            )
            assert resp.status_code == 200
            assert mock_gen.call_args[1]["target_nodes"] == 5

    def test_generate_tree_node_count_default(self, config_env):
        """node_count defaults to 20 when not provided."""
        from systemedu.education.models import KnowledgeTree, Milestone, KnowledgeNode

        mock_tree = KnowledgeTree(
            milestones=[
                Milestone(
                    title="M1",
                    knodes=[
                        KnowledgeNode(
                            title="N1", summary="d", difficulty_level=1,
                            estimated_minutes=10, prerequisite_indices=[],
                        ),
                    ],
                )
            ]
        )

        with patch(
            "systemedu.education.tree_generator.generate_knowledge_tree",
            new_callable=AsyncMock,
            return_value=mock_tree,
        ) as mock_gen:
            app = create_app()
            client = _auth_client(app)
            resp = client.post(
                "/api/projects/generate-tree",
                json={"title": "T", "description": "D"},
            )
            assert resp.status_code == 200
            assert mock_gen.call_args[1]["target_nodes"] == 20


class TestGatewayGenerateDescription:
    """Tests for POST /api/projects/generate-description."""

    def test_generate_description_missing_title(self, config_env):
        """Returns 400 when title is missing."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post("/api/projects/generate-description", json={"age": 9})
        assert resp.status_code == 400
        assert "title" in resp.json()["error"]

    def test_generate_description_empty_title(self, config_env):
        """Returns 400 when title is empty string."""
        app = create_app()
        client = _auth_client(app)
        resp = client.post("/api/projects/generate-description", json={"title": "  "})
        assert resp.status_code == 400

    def test_generate_description_success(self, config_env):
        """Returns description and tags when LLM succeeds."""
        import json as json_lib
        mock_response = MagicMock()
        mock_response.content = json_lib.dumps({
            "description": "这是一个关于火箭科学的精彩学习项目。",
            "tags": ["航空航天", "物理学", "STEM"],
        })

        with patch("systemedu.core.llm_client.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)
            mock_get_llm.return_value = mock_llm

            app = create_app()
            client = _auth_client(app)
            resp = client.post(
                "/api/projects/generate-description",
                json={"title": "火箭科学家", "age": 13, "node_count": 25},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["description"] == "这是一个关于火箭科学的精彩学习项目。"
        assert data["tags"] == ["航空航天", "物理学", "STEM"]

    def test_generate_description_llm_fallback_on_invalid_json(self, config_env):
        """Falls back to raw content as description when LLM returns non-JSON."""
        mock_response = MagicMock()
        mock_response.content = "这是纯文本描述，没有JSON格式。"

        with patch("systemedu.core.llm_client.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)
            mock_get_llm.return_value = mock_llm

            app = create_app()
            client = _auth_client(app)
            resp = client.post(
                "/api/projects/generate-description",
                json={"title": "测试项目"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "纯文本描述" in data["description"]
        assert data["tags"] == []

    def test_generate_description_default_params(self, config_env):
        """Uses default age=9 and node_count=25 when not provided."""
        import json as json_lib
        mock_response = MagicMock()
        mock_response.content = json_lib.dumps({"description": "desc", "tags": []})

        with patch("systemedu.core.llm_client.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=mock_response)
            mock_get_llm.return_value = mock_llm

            app = create_app()
            client = _auth_client(app)
            resp = client.post(
                "/api/projects/generate-description",
                json={"title": "数学探索"},
            )

        assert resp.status_code == 200
        assert resp.json()["description"] == "desc"


class TestGatewayDeleteProject:
    """Tests for DELETE /api/projects/{name}."""

    MILESTONES_DATA = {
        "milestones": [
            {
                "title": "基础",
                "knodes": [
                    {
                        "title": "节点1",
                        "summary": "描述1",
                        "difficulty_level": 1,
                        "estimated_minutes": 10,
                        "prerequisite_indices": [],
                    }
                ],
            }
        ]
    }

    def _create_project(self, client, tmp_path, name="del-test-proj"):
        """Helper: create a project and return its name."""
        (tmp_path / "projects").mkdir(exist_ok=True)
        resp = client.post(
            "/api/projects",
            json={"name": name, "title": "Delete Test", "tree_data": self.MILESTONES_DATA},
        )
        assert resp.status_code == 200
        return name

    def test_delete_project_success(self, config_env, tmp_path, monkeypatch):
        """DELETE /api/projects/{name} removes project from disk and DB."""
        monkeypatch.chdir(tmp_path)
        app = create_app()
        client = _auth_client(app)
        name = self._create_project(client, tmp_path)

        # Confirm project exists
        assert client.get(f"/api/projects/{name}").status_code == 200

        # Delete it
        resp = client.delete(f"/api/projects/{name}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "deleted"
        assert data["name"] == name

        # Project directory should be gone
        proj_dir = tmp_path / "projects" / name
        assert not proj_dir.exists()

    def test_delete_project_not_found(self, config_env):
        """DELETE /api/projects/{name} returns 404 for unknown project."""
        app = create_app()
        client = _auth_client(app)
        resp = client.delete("/api/projects/nonexistent-xyz")
        assert resp.status_code == 404

    def test_delete_project_removes_from_list(self, config_env, tmp_path, monkeypatch):
        """After deletion, project no longer appears in GET /api/projects."""
        monkeypatch.chdir(tmp_path)
        app = create_app()
        client = _auth_client(app)
        name = self._create_project(client, tmp_path, name="list-del-proj")

        # Delete
        assert client.delete(f"/api/projects/{name}").status_code == 200

        # Project list should not contain it
        projects = client.get("/api/projects").json()
        assert not any(p["name"] == name for p in projects)

    def test_delete_project_cleans_db_records(self, config_env, tmp_path, monkeypatch):
        """Deletion removes associated DB records (progress, enrollment, etc.)."""
        monkeypatch.chdir(tmp_path)
        app = create_app()
        client = _auth_client(app)
        name = self._create_project(client, tmp_path, name="db-clean-proj")

        # Create an enrollment
        client.post(f"/api/projects/{name}/enroll", json={"user_id": "test-user"})

        # Delete project
        assert client.delete(f"/api/projects/{name}").status_code == 200

        # DB records should be cleaned up
        from systemedu.storage.db import Enrollment, get_session as get_db_session
        db = get_db_session()
        try:
            count = db.query(Enrollment).filter_by(project_name=name).count()
            assert count == 0
        finally:
            db.close()
