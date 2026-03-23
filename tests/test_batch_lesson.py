"""Tests for batch lesson pre-generation API."""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
import yaml
from starlette.testclient import TestClient

from systemedu.core.config import reset_config
from systemedu.gateway.server import create_app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clean_config():
    reset_config()
    yield
    reset_config()


@pytest.fixture
def config_env(tmp_path, monkeypatch):
    """Isolated config + DB for each test."""
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
    server._lesson_queue_tasks.clear()
    app = create_app()
    c = TestClient(app)
    token = c.post("/api/auth/login", json={"username": "root", "password": "123systemedu"}).json()["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


@pytest.fixture
def db_session(config_env):
    """Direct DB session for assertions."""
    from systemedu.storage.db import get_session, get_engine, Base
    get_engine()  # ensure tables created
    session = get_session()
    yield session
    session.close()


def _make_mock_ctx(node_count: int = 5):
    """Build a minimal mock project context."""
    from systemedu.education.models import (
        AcceptanceType, Category, ContentType, KnowledgeNode, KnowledgeTree,
        Milestone, Project,
    )

    knodes = [
        KnowledgeNode(
            title=f"Node {i}",
            summary=f"Summary {i}",
            difficulty_level=1,
            content_type=ContentType.TEXT,
            acceptance_type=AcceptanceType.QUIZ,
            estimated_minutes=10,
            xp_reward=100,
            prerequisite_indices=[],
        )
        for i in range(node_count)
    ]
    milestone = Milestone(title="M1", description="", order=1, xp_reward=0, knodes=knodes)
    tree = KnowledgeTree(milestones=[milestone])
    project = Project(
        name="testproject",
        title="Test",
        description="",
        category=Category.OTHER,
        age_range=[6, 18],
        estimated_hours=5,
        tags=[],
        agents={},
    )
    ctx = MagicMock()
    ctx.tree = tree
    ctx.project = project
    ctx.progress = []
    return ctx


# ---------------------------------------------------------------------------
# DB model tests
# ---------------------------------------------------------------------------

class TestLessonQueueItemModel:
    def test_create_and_read(self, db_session):
        from systemedu.storage.db import LessonQueueItem

        item = LessonQueueItem(
            project_name="proj1",
            knode_id=3,
            knode_title="Node Title",
            batch_id=1,
            status="pending",
            created_at=datetime.now(),
        )
        db_session.add(item)
        db_session.commit()
        db_session.refresh(item)

        assert item.id is not None
        fetched = db_session.query(LessonQueueItem).filter_by(project_name="proj1").first()
        assert fetched.knode_id == 3
        assert fetched.knode_title == "Node Title"
        assert fetched.batch_id == 1
        assert fetched.status == "pending"
        assert fetched.error == ""

    def test_status_lifecycle(self, db_session):
        from systemedu.storage.db import LessonQueueItem

        item = LessonQueueItem(
            project_name="proj2",
            knode_id=0,
            knode_title="Test",
            batch_id=1,
            status="pending",
            created_at=datetime.now(),
        )
        db_session.add(item)
        db_session.commit()

        item.status = "generating"
        item.started_at = datetime.now()
        db_session.commit()

        item.status = "done"
        item.completed_at = datetime.now()
        db_session.commit()

        fetched = db_session.query(LessonQueueItem).filter_by(project_name="proj2").first()
        assert fetched.status == "done"
        assert fetched.started_at is not None
        assert fetched.completed_at is not None

    def test_error_field(self, db_session):
        from systemedu.storage.db import LessonQueueItem

        item = LessonQueueItem(
            project_name="proj3",
            knode_id=0,
            knode_title="Fail node",
            batch_id=1,
            status="failed",
            error="LLM timeout",
            created_at=datetime.now(),
        )
        db_session.add(item)
        db_session.commit()

        fetched = db_session.query(LessonQueueItem).filter_by(project_name="proj3").first()
        assert fetched.status == "failed"
        assert fetched.error == "LLM timeout"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

class TestBatchGenerateAPI:
    def test_project_not_found(self, client):
        resp = client.post("/api/projects/nonexistent_xyz/lessons/batch-generate", json={})
        assert resp.status_code == 404

    def test_queues_items_and_returns_ids(self, client):
        mock_ctx = _make_mock_ctx(node_count=5)

        with patch("systemedu.education.project_loader.load_project_context", return_value=mock_ctx), \
             patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()

            resp = client.post("/api/projects/testproject/lessons/batch-generate", json={})

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["total"] == 5
        assert data["batch_id"] == 1
        assert len(data["queued_knode_ids"]) == 5

    def test_skips_ready_nodes(self, client, db_session):
        from systemedu.storage.db import LessonContent

        for kid in [0, 1]:
            db_session.add(LessonContent(
                project_name="testproject",
                knode_id=kid,
                status="ready",
                generated_at=datetime.now(),
            ))
        db_session.commit()

        mock_ctx = _make_mock_ctx(node_count=5)

        with patch("systemedu.education.project_loader.load_project_context", return_value=mock_ctx), \
             patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()

            resp = client.post("/api/projects/testproject/lessons/batch-generate", json={})

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["total"] == 3
        assert 0 not in data["queued_knode_ids"]
        assert 1 not in data["queued_knode_ids"]

    def test_max_10_nodes(self, client):
        mock_ctx = _make_mock_ctx(node_count=15)

        with patch("systemedu.education.project_loader.load_project_context", return_value=mock_ctx), \
             patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()

            resp = client.post("/api/projects/testproject/lessons/batch-generate", json={})

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["total"] == 10
        assert len(data["queued_knode_ids"]) == 10

    def test_conflict_when_already_running(self, client):
        from systemedu.gateway.server import _lesson_queue_tasks
        _lesson_queue_tasks["testproject"] = True

        resp = client.post("/api/projects/testproject/lessons/batch-generate", json={})

        assert resp.status_code == 409
        _lesson_queue_tasks.pop("testproject", None)

    def test_increments_batch_id(self, client, db_session):
        from systemedu.storage.db import LessonQueueItem

        db_session.add(LessonQueueItem(
            project_name="testproject",
            knode_id=0,
            knode_title="Old",
            batch_id=3,
            status="done",
            created_at=datetime.now(),
        ))
        db_session.commit()

        mock_ctx = _make_mock_ctx(node_count=3)

        with patch("systemedu.education.project_loader.load_project_context", return_value=mock_ctx), \
             patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()

            resp = client.post("/api/projects/testproject/lessons/batch-generate", json={})

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["batch_id"] == 4

    def test_empty_project_no_nodes(self, client):
        mock_ctx = _make_mock_ctx(node_count=0)

        with patch("systemedu.education.project_loader.load_project_context", return_value=mock_ctx):
            resp = client.post("/api/projects/testproject/lessons/batch-generate", json={})

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["queued_knode_ids"] == []


class TestGetLessonQueueAPI:
    def test_empty_when_no_batches(self, client):
        from systemedu.gateway.server import _lesson_queue_tasks
        _lesson_queue_tasks.pop("testproject", None)

        resp = client.get("/api/projects/testproject/lessons/queue")

        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["batch_id"] == 0
        assert data["running"] is False

    def test_returns_latest_batch(self, client, db_session):
        from systemedu.storage.db import LessonQueueItem

        for batch_id, kid in [(1, 0), (1, 1), (2, 2)]:
            db_session.add(LessonQueueItem(
                project_name="testproject",
                knode_id=kid,
                knode_title=f"Node {kid}",
                batch_id=batch_id,
                status="done",
                created_at=datetime.now(),
            ))
        db_session.commit()

        resp = client.get("/api/projects/testproject/lessons/queue")

        assert resp.status_code == 200
        data = resp.json()
        assert data["batch_id"] == 2
        assert len(data["items"]) == 1
        assert data["items"][0]["knode_id"] == 2

    def test_running_flag_reflects_task_state(self, client):
        from systemedu.gateway.server import _lesson_queue_tasks
        _lesson_queue_tasks["testproject"] = True

        resp = client.get("/api/projects/testproject/lessons/queue")

        assert resp.status_code == 200
        data = resp.json()
        assert data["running"] is True

        _lesson_queue_tasks.pop("testproject", None)

    def test_item_fields(self, client, db_session):
        from systemedu.storage.db import LessonQueueItem

        now = datetime.now()
        db_session.add(LessonQueueItem(
            project_name="testproject",
            knode_id=5,
            knode_title="Node 5",
            batch_id=1,
            status="pending",
            created_at=now,
        ))
        db_session.commit()

        resp = client.get("/api/projects/testproject/lessons/queue")

        assert resp.status_code == 200
        item = resp.json()["items"][0]
        assert item["knode_id"] == 5
        assert item["knode_title"] == "Node 5"
        assert item["status"] == "pending"
        assert item["error"] == ""
        assert "created_at" in item


class TestCancelLessonQueueAPI:
    def test_cancel_marks_pending_as_skipped(self, client, db_session):
        from systemedu.storage.db import LessonQueueItem

        db_session.add(LessonQueueItem(
            project_name="testproject",
            knode_id=0,
            knode_title="Node 0",
            batch_id=1,
            status="pending",
            created_at=datetime.now(),
        ))
        db_session.add(LessonQueueItem(
            project_name="testproject",
            knode_id=1,
            knode_title="Node 1",
            batch_id=1,
            status="done",
            created_at=datetime.now(),
        ))
        db_session.commit()

        resp = client.delete("/api/projects/testproject/lessons/queue")

        assert resp.status_code == 200
        assert resp.json()["skipped"] == 1

        db_session.expire_all()
        items = db_session.query(LessonQueueItem).filter_by(project_name="testproject").all()
        statuses = {i.knode_id: i.status for i in items}
        assert statuses[0] == "skipped"
        assert statuses[1] == "done"

    def test_cancel_no_batches(self, client):
        resp = client.delete("/api/projects/testproject/lessons/queue")
        assert resp.status_code == 200
        assert resp.json()["skipped"] == 0


class TestAuthRequired:
    def test_batch_generate_requires_auth(self, config_env):
        from systemedu.gateway import server
        server._runtime = None
        app = create_app()
        c = TestClient(app)
        resp = c.post("/api/projects/testproject/lessons/batch-generate", json={})
        assert resp.status_code == 401

    def test_get_queue_requires_auth(self, config_env):
        from systemedu.gateway import server
        server._runtime = None
        app = create_app()
        c = TestClient(app)
        resp = c.get("/api/projects/testproject/lessons/queue")
        assert resp.status_code == 401

    def test_delete_queue_requires_auth(self, config_env):
        from systemedu.gateway import server
        server._runtime = None
        app = create_app()
        c = TestClient(app)
        resp = c.delete("/api/projects/testproject/lessons/queue")
        assert resp.status_code == 401
