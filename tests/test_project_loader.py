"""Tests for project loading and progress persistence."""

import json

import pytest
import yaml

from systemedu.core.config import reset_config
from systemedu.core.education.models import NodeStatus
from systemedu.core.education.project_loader import (
    ProjectContext,
    find_project_dir,
    load_project_context,
    load_progress,
    save_progress,
)
from systemedu.core.storage.db import reset_db


@pytest.fixture(autouse=True)
def clean_state():
    reset_config()
    reset_db()
    yield
    reset_config()
    reset_db()


@pytest.fixture
def sample_project_dir(tmp_path):
    """Create a sample project directory with project.yaml and knowledge_tree.json."""
    project_dir = tmp_path / "projects" / "test-project"
    project_dir.mkdir(parents=True)

    project_yaml = {
        "name": "test-project",
        "version": "1.0.0",
        "title": "Test Project",
        "description": "A test project",
        "category": "ai",
        "agents": {
            "tutor": {
                "type": "builtin:tutor",
                "llm": "qwen",
                "skills": ["./skills/tutor"],
                "mcp_servers": ["code-runner"],
            },
        },
        "mcp": {
            "code-runner": {
                "command": "python",
                "args": ["-m", "mcp_code_runner"],
            },
        },
        "knowledge_tree": "./knowledge_tree.json",
    }
    (project_dir / "project.yaml").write_text(
        yaml.dump(project_yaml, allow_unicode=True)
    )

    tree_data = {
        "milestones": [
            {
                "title": "Milestone 1",
                "description": "First milestone",
                "order": 0,
                "knodes": [
                    {
                        "title": "Node A",
                        "summary": "First node",
                        "difficulty_level": 1,
                        "content_type": "text",
                        "acceptance_type": "quiz",
                        "estimated_minutes": 15,
                        "xp_reward": 20,
                        "order": 0,
                        "prerequisite_indices": [],
                    },
                    {
                        "title": "Node B",
                        "summary": "Second node",
                        "difficulty_level": 2,
                        "content_type": "code",
                        "acceptance_type": "code_submit",
                        "estimated_minutes": 30,
                        "xp_reward": 30,
                        "order": 1,
                        "prerequisite_indices": [0],
                    },
                ],
            },
            {
                "title": "Milestone 2",
                "description": "Second milestone",
                "order": 1,
                "knodes": [
                    {
                        "title": "Node C",
                        "summary": "Third node",
                        "difficulty_level": 3,
                        "content_type": "interactive",
                        "acceptance_type": "demo",
                        "estimated_minutes": 45,
                        "xp_reward": 40,
                        "order": 0,
                        "prerequisite_indices": [1],
                    },
                ],
            },
        ]
    }
    (project_dir / "knowledge_tree.json").write_text(
        json.dumps(tree_data, ensure_ascii=False)
    )

    return project_dir


@pytest.fixture
def db_env(tmp_path, monkeypatch):
    """Point DB to tmp_path for isolation."""
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("systemedu.core.storage.db.DB_FILE", db_file)
    reset_db()
    return db_file


class TestFindProjectDir:
    def test_find_project_dir(self, sample_project_dir, monkeypatch):
        monkeypatch.chdir(sample_project_dir.parent.parent)
        result = find_project_dir("test-project")
        assert result == sample_project_dir

    def test_find_nonexistent_raises(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        with pytest.raises(FileNotFoundError, match="not found"):
            find_project_dir("nonexistent-project")


class TestLoadProjectContext:
    def test_load_project_context(self, sample_project_dir, db_env):
        ctx = load_project_context(
            "test-project", project_dir=sample_project_dir
        )
        assert ctx.project.title == "Test Project"
        assert len(ctx.tree.milestones) == 2
        assert len(ctx.progress) == 3

    def test_current_node_returns_first_available(self, sample_project_dir, db_env):
        ctx = load_project_context(
            "test-project", project_dir=sample_project_dir
        )
        result = ctx.current_node()
        assert result is not None
        idx, node = result
        assert idx == 0
        assert node.title == "Node A"

    def test_available_nodes(self, sample_project_dir, db_env):
        ctx = load_project_context(
            "test-project", project_dir=sample_project_dir
        )
        available = ctx.available_nodes()
        assert len(available) == 1
        assert available[0][1].title == "Node A"

    def test_all_nodes_flat(self, sample_project_dir, db_env):
        ctx = load_project_context(
            "test-project", project_dir=sample_project_dir
        )
        nodes = ctx.all_nodes_flat()
        assert len(nodes) == 3
        assert nodes[0].title == "Node A"
        assert nodes[2].title == "Node C"

    def test_get_node_by_id(self, sample_project_dir, db_env):
        ctx = load_project_context(
            "test-project", project_dir=sample_project_dir
        )
        node = ctx.get_node_by_id(1)
        assert node is not None
        assert node.title == "Node B"
        assert ctx.get_node_by_id(99) is None

    def test_get_node_progress(self, sample_project_dir, db_env):
        ctx = load_project_context(
            "test-project", project_dir=sample_project_dir
        )
        p = ctx.get_node_progress(0)
        assert p is not None
        assert p.status == NodeStatus.AVAILABLE

    def test_project_agents_and_mcp_parsed(self, sample_project_dir, db_env):
        ctx = load_project_context(
            "test-project", project_dir=sample_project_dir
        )
        assert "tutor" in ctx.project.agents
        assert ctx.project.agents["tutor"].llm == "qwen"
        assert "code-runner" in ctx.project.mcp
        assert ctx.project.mcp["code-runner"].command == "python"


class TestProgressPersistence:
    def test_save_and_load_progress(self, db_env):
        from systemedu.core.education.models import UserNodeProgress

        progresses = [
            UserNodeProgress(knode_id=0, status=NodeStatus.PASSED, attempts=1),
            UserNodeProgress(knode_id=1, status=NodeStatus.AVAILABLE, attempts=0),
        ]
        save_progress("user1", "proj1", progresses)

        loaded = load_progress("user1", "proj1", 2)
        assert loaded is not None
        assert len(loaded) == 2
        assert loaded[0].status == NodeStatus.PASSED
        assert loaded[0].attempts == 1
        assert loaded[1].status == NodeStatus.AVAILABLE

    def test_load_nonexistent_returns_none(self, db_env):
        result = load_progress("nobody", "nothing", 3)
        assert result is None

    def test_progress_persist_roundtrip(self, sample_project_dir, db_env):
        """Load project, modify progress, save, reload — should persist."""
        ctx = load_project_context(
            "test-project", user_id="roundtrip_user", project_dir=sample_project_dir
        )
        # Mark first node as passed
        ctx.progress[0].status = NodeStatus.PASSED
        save_progress("roundtrip_user", "test-project", ctx.progress)

        # Reload
        ctx2 = load_project_context(
            "test-project", user_id="roundtrip_user", project_dir=sample_project_dir
        )
        assert ctx2.progress[0].status == NodeStatus.PASSED
