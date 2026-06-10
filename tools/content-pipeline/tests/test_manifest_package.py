"""manifest regenerate + package tarball 单测."""

from __future__ import annotations

import json
import tarfile
from pathlib import Path

import pytest

from content_pipeline import compile as compile_mod
from content_pipeline import manifest as manifest_mod
from content_pipeline import package as package_mod
from content_pipeline import workspace


SAMPLE = """---
title: 简易测试
slug: t-proj
duration_weeks: 2
---

## Syllabus

**Phase 1 — A**
- W1:成果 — 干活.
- W2:成果 — 验收.
"""


def _setup_compiled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """compile 一个最小项目并塞进 1 个 lesson.md."""
    monkeypatch.setenv("SYSTEMEDU_CONTENT_WORKSPACE", str(tmp_path / "ws"))
    workspace.ensure_workspace()
    bp = workspace.project_blueprint_dir("t-proj")
    bp.mkdir(parents=True)
    (bp / "README.zh.md").write_text(SAMPLE, encoding="utf-8")
    compile_mod.compile_project("t-proj")

    gen = workspace.project_generated_dir("t-proj")
    # 给 M01 塞个 lesson.md, 让 files 不为空
    m01 = next(p for p in (gen / "knodes").iterdir() if p.name.startswith("M01"))
    (m01 / "lesson.md").write_text("# M01\n\nhello.\n", encoding="utf-8")
    return gen


def test_regenerate_manifest_populates_files_and_size(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    gen = _setup_compiled(tmp_path, monkeypatch)

    manifest = manifest_mod.regenerate_manifest(gen, version="1.0.0")
    assert manifest["version"] == "1.0.0"
    assert manifest["version_tag"] == "release"
    assert manifest["total_size_bytes"] > 0
    paths = {f["path"] for f in manifest["files"]}
    assert "tree/knowledge_tree.json" in paths
    assert any(p.startswith("knodes/M01-") and p.endswith("/lesson.md") for p in paths)
    assert "blueprint/README.zh.md" in paths
    # manifest.json 自己不应该出现在 files (避免循环 hash)
    assert "manifest.json" not in paths
    # 每个 file 有 sha256 + size
    for f in manifest["files"]:
        assert len(f["sha256"]) == 64
        assert f["size"] >= 0


def test_regenerate_manifest_detects_cover(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """项目根有 cover.png 时, manifest 自动设 cover_image_path."""
    gen = _setup_compiled(tmp_path, monkeypatch)
    (gen / "cover.png").write_bytes(b"\x89PNG\r\n\x1a\n fake png")
    manifest = manifest_mod.regenerate_manifest(gen, version="1.0.0")
    assert manifest.get("cover_image_path") == "cover.png"


def test_regenerate_manifest_no_cover(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """无封面文件时, 不设 cover_image_path (保持 None/缺失)."""
    gen = _setup_compiled(tmp_path, monkeypatch)
    manifest = manifest_mod.regenerate_manifest(gen, version="1.0.0")
    assert not manifest.get("cover_image_path")


def test_package_creates_tarball(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    _setup_compiled(tmp_path, monkeypatch)

    pkg = package_mod.package_project("t-proj", version="0.9.0")
    assert pkg.tarball_path.is_file()
    assert pkg.tarball_path.name == "t-proj-0.9.0.tar.gz"
    assert pkg.size_bytes > 0
    assert len(pkg.sha256) == 64

    # 顶层必须只有 1 个目录 t-proj/
    with tarfile.open(pkg.tarball_path, "r:gz") as tar:
        names = tar.getnames()
        tops = {n.split("/")[0] for n in names if n}
        assert tops == {"t-proj"}
        # manifest + tree 都在
        assert "t-proj/manifest.json" in names
        assert "t-proj/tree/knowledge_tree.json" in names

    # 解出来的 manifest 跟原 manifest 一致
    workspace_root = workspace.workspace_root()
    extracted_manifest = workspace_root.parent / "ext-manifest.json"
    with tarfile.open(pkg.tarball_path, "r:gz") as tar:
        m = tar.extractfile("t-proj/manifest.json")
        assert m is not None
        extracted = json.loads(m.read().decode("utf-8"))
    assert extracted["slug"] == "t-proj"
    assert extracted["version"] == "0.9.0"
