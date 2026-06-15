"""Tests for systemedu.core.storage.files."""

from __future__ import annotations

import json

import pytest
import yaml

from systemedu.core.storage import files as storage_files


class TestProjectYaml:
    def test_load_missing_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            storage_files.load_project_yaml(tmp_path / "no-such-dir")

    def test_save_then_load_round_trip(self, tmp_path):
        data = {"name": "demo", "tags": ["a", "b"], "title_zh": "演示"}
        storage_files.save_project_yaml(tmp_path / "p", data)

        loaded = storage_files.load_project_yaml(tmp_path / "p")
        assert loaded == data

    def test_save_unicode_no_ascii_escape(self, tmp_path):
        storage_files.save_project_yaml(tmp_path / "p", {"title": "中文项目"})
        raw = (tmp_path / "p" / "project.yaml").read_text(encoding="utf-8")
        assert "中文项目" in raw  # allow_unicode=True

    def test_save_creates_parent_dir(self, tmp_path):
        # 父目录还不存在
        target = tmp_path / "nested" / "deep" / "p"
        storage_files.save_project_yaml(target, {"name": "x"})
        assert (target / "project.yaml").exists()


class TestCacheDir:
    def test_creates_hub_cache_inside_systemedu_home(self, tmp_path, monkeypatch):
        monkeypatch.setattr(storage_files, "SYSTEMEDU_HOME", tmp_path)
        cache = storage_files.get_cache_dir()
        assert cache == tmp_path / "hub_cache"
        assert cache.exists() and cache.is_dir()


class TestProjectsDir:
    def test_returns_path_under_home(self, monkeypatch, tmp_path):
        monkeypatch.setattr(storage_files.Path, "home", lambda: tmp_path)
        out = storage_files.get_projects_dir()
        assert out == tmp_path / "projects"


class TestInitProjectSkeleton:
    def test_creates_full_skeleton(self, tmp_path):
        project = tmp_path / "demo"
        storage_files.init_project_skeleton(project, "demo")

        # project.yaml
        meta = yaml.safe_load((project / "project.yaml").read_text(encoding="utf-8"))
        assert meta["name"] == "demo"
        assert meta["title"] == "demo"
        assert meta["version"] == "0.1.0"
        assert meta["age_range"] == [6, 18]
        assert meta["agents"]["tutor"]["type"] == "builtin:tutor"
        assert meta["knowledge_tree"] == "./knowledge_tree.json"

        # empty knowledge_tree.json
        tree = json.loads((project / "knowledge_tree.json").read_text(encoding="utf-8"))
        assert tree == {"milestones": []}

        # subdirs
        for sub in ("skills", "agents", "mcp", "artifacts"):
            assert (project / sub).is_dir(), f"missing subdir: {sub}"

    def test_idempotent(self, tmp_path):
        project = tmp_path / "demo"
        storage_files.init_project_skeleton(project, "demo")
        # 再 init 一次不应该崩 (mkdir exist_ok)
        storage_files.init_project_skeleton(project, "demo")
        assert (project / "project.yaml").exists()

    def test_yaml_is_human_readable(self, tmp_path):
        """save_project_yaml 用 default_flow_style=False, 不应该写成 inline 风格."""
        storage_files.init_project_skeleton(tmp_path / "demo", "demo")
        raw = (tmp_path / "demo" / "project.yaml").read_text(encoding="utf-8")
        # default_flow_style=False -> block 模式, key 应该一行一个
        assert "\nname: demo" in raw or raw.startswith("name: demo")
        # 不应该是 inline {...}
        assert not raw.lstrip().startswith("{")
