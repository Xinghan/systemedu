"""blueprint frontmatter 解析 + sync 单测."""

from __future__ import annotations

from pathlib import Path

import pytest

from content_pipeline import blueprint, workspace


SAMPLE_README = """---
title: 测试项目
slug: test-proj
age_band: 10-12
domain: Robotics
duration_weeks: 8
weekly_hours: 5
budget_usd: 100
difficulty: 3
---

# 测试项目

## Hook
有意思的开场.

## Syllabus

**Phase 1 — Setup(搭建,第 1-2 周)**
- W1:成果 — 准备工具.产出物:工具清单.
- W2:成果 — 跑通 hello world.产出物:可运行脚本.

**Phase 2 — Build(实现,第 3-4 周)**
- W3:成果 — 完成 v1.产出物:demo 视频.
- W4:成果 — bug 修复.产出物:测试报告.
"""


def test_parse_frontmatter_basic():
    fm, body = blueprint.parse_frontmatter(SAMPLE_README)
    assert fm.title == "测试项目"
    assert fm.slug == "test-proj"
    assert fm.age_band == "10-12"
    assert fm.duration_weeks == 8
    assert fm.difficulty == 3
    assert "Syllabus" in body


def test_parse_frontmatter_no_frontmatter():
    fm, body = blueprint.parse_frontmatter("# pure markdown\n\nno yaml.")
    assert fm.slug == ""
    assert body.startswith("# pure markdown")


def test_load_blueprint(tmp_path: Path):
    bp_dir = tmp_path / "test-proj"
    bp_dir.mkdir()
    (bp_dir / "README.zh.md").write_text(SAMPLE_README, encoding="utf-8")
    (bp_dir / "README.md").write_text(SAMPLE_README.replace("测试项目", "Test Project"), encoding="utf-8")

    bp = blueprint.load_blueprint(bp_dir)
    assert bp.frontmatter.slug == "test-proj"
    assert bp.title_zh == "测试项目"
    assert bp.title_en == "Test Project"
    assert "Syllabus" in bp.body_markdown


def test_sync_blueprints(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    # 构造一个 fake systemeduidea
    src = tmp_path / "ideas"
    proj = src / "projects" / "test-proj"
    proj.mkdir(parents=True)
    (proj / "README.md").write_text(SAMPLE_README, encoding="utf-8")
    (proj / "README.zh.md").write_text(SAMPLE_README, encoding="utf-8")

    monkeypatch.setenv("SYSTEMEDU_CONTENT_WORKSPACE", str(tmp_path / "workspace"))
    workspace.ensure_workspace()

    results = blueprint.sync_blueprints(src)
    assert len(results) == 1
    assert results[0].slug == "test-proj"
    assert results[0].status == "new"

    # 二次 sync: unchanged
    results2 = blueprint.sync_blueprints(src)
    assert results2[0].status == "unchanged"

    # 改动后: updated
    (proj / "README.md").write_text(SAMPLE_README + "\nmore.\n", encoding="utf-8")
    results3 = blueprint.sync_blueprints(src)
    assert results3[0].status == "updated"
