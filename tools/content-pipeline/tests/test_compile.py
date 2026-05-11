"""compile: README → V5 skeleton 单测."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from content_pipeline import compile as compile_mod
from content_pipeline import workspace
from content_pipeline.blueprint import load_blueprint


SAMPLE = """---
title: 蚁群行为学家
slug: ai-ant-ethologist
age_band: 10-12
domain: Robotics
duration_weeks: 24
weekly_hours: 5
budget_usd: 250
difficulty: 4
---

# 蚁群行为学家

## Syllabus

**Phase 1 — Background & Colony(背景 + 蚁群,第 1-5 周)**
- W1:成果 — 读论文.产出物:笔记.
- W2:成果 — 找蚁群.产出物:照片.
- W3:成果 — 搭巢.产出物:formicarium.
- W4:成果 — 测 RFID.产出物:读距曲线.
- W5:成果 — 装门.产出物:门阵列.

**Phase 2 — Tag the Colony(贴标签,第 6-9 周)**
- W6:成果 — 麻醉练习.产出物:技术过关.
- W7:成果 — 贴 10 只.产出物:10 贴标蚁.
- W8:成果 — 扩到 50.产出物:贴标蚁群.
- W9:成果 — 采基线.产出物:baseline.parquet.
"""


def test_parse_syllabus_phase_week():
    bp = load_blueprint_inline()
    phases = compile_mod.parse_syllabus(bp.body_markdown)
    assert len(phases) == 2
    assert phases[0].phase_num == 1
    assert phases[0].title_short == "Background & Colony"
    assert len(phases[0].weeks) == 5
    assert phases[0].weeks[0].week == 1
    assert phases[1].phase_num == 2
    assert len(phases[1].weeks) == 4


def test_compile_project_writes_tree_manifest_and_knode_dirs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("SYSTEMEDU_CONTENT_WORKSPACE", str(tmp_path / "ws"))
    workspace.ensure_workspace()

    bp_dir = workspace.project_blueprint_dir("ai-ant-ethologist")
    bp_dir.mkdir(parents=True)
    (bp_dir / "README.zh.md").write_text(SAMPLE, encoding="utf-8")

    result = compile_mod.compile_project("ai-ant-ethologist")
    assert result.stage_count == 2
    assert result.module_count == 9
    assert result.tree_path.is_file()
    assert result.manifest_path.is_file()
    assert len(result.knode_dirs_created) == 9

    # tree 字段
    tree = json.loads(result.tree_path.read_text(encoding="utf-8"))
    assert tree["schema_version"] == "5.0"
    assert len(tree["stages"]) == 2
    assert len(tree["modules"]) == 9
    assert tree["modules"][0]["module_id"] == "M01"
    assert tree["modules"][0]["stage_id"] == "S1"
    assert tree["modules"][5]["stage_id"] == "S2"  # phase 2 第 1 个
    # 依赖链
    assert tree["modules"][0]["depends_on"] == []
    assert tree["modules"][1]["depends_on"] == ["M01"]
    # project_identity 从 frontmatter
    assert tree["project_identity"]["slug"] == "ai-ant-ethologist"
    assert tree["project_identity"]["duration_weeks"] == 24

    # manifest 字段
    manifest = json.loads(result.manifest_path.read_text(encoding="utf-8"))
    assert manifest["slug"] == "ai-ant-ethologist"
    assert manifest["knode_count"] == 9
    assert manifest["stage_count"] == 2
    assert manifest["version_tag"] == "skeleton"
    # 所有 knode 目录都存在
    gen = workspace.project_generated_dir("ai-ant-ethologist")
    for entry in manifest["knodes"]:
        assert (gen / entry["knode_dir"]).is_dir()


def test_compile_missing_blueprint_raises(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("SYSTEMEDU_CONTENT_WORKSPACE", str(tmp_path / "ws"))
    workspace.ensure_workspace()
    with pytest.raises(FileNotFoundError, match="not synced"):
        compile_mod.compile_project("nonexistent")


def load_blueprint_inline():
    """构造一个 ParsedBlueprint 不落盘."""
    from content_pipeline.blueprint import ParsedBlueprint, parse_frontmatter
    fm, body = parse_frontmatter(SAMPLE)
    return ParsedBlueprint(frontmatter=fm, body_markdown=body, title_en="", title_zh="蚁群行为学家")
