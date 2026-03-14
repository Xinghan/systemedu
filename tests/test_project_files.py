"""Tests for project file operations."""

import json
from pathlib import Path

import pytest

from systemedu.storage.files import (
    init_project_skeleton,
    load_project_yaml,
    save_project_yaml,
)


class TestProjectFiles:
    def test_init_project_skeleton(self, tmp_path):
        project_dir = tmp_path / "my-project"
        init_project_skeleton(project_dir, "my-project")

        assert project_dir.exists()
        assert (project_dir / "project.yaml").exists()
        assert (project_dir / "knowledge_tree.json").exists()
        assert (project_dir / "skills").is_dir()
        assert (project_dir / "agents").is_dir()
        assert (project_dir / "mcp").is_dir()
        assert (project_dir / "artifacts").is_dir()

        # Verify project.yaml content
        data = load_project_yaml(project_dir)
        assert data["name"] == "my-project"
        assert data["version"] == "0.1.0"

        # Verify knowledge_tree.json
        kt = json.loads((project_dir / "knowledge_tree.json").read_text())
        assert kt == {"milestones": []}

    def test_load_project_yaml(self, tmp_path):
        project_dir = tmp_path / "test"
        init_project_skeleton(project_dir, "test")

        data = load_project_yaml(project_dir)
        assert data["name"] == "test"

    def test_load_nonexistent_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_project_yaml(tmp_path / "nonexistent")

    def test_save_and_load(self, tmp_path):
        project_dir = tmp_path / "save-test"
        save_project_yaml(project_dir, {"name": "saved", "title": "Saved Project"})

        data = load_project_yaml(project_dir)
        assert data["name"] == "saved"
        assert data["title"] == "Saved Project"
