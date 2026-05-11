"""course_factory.workspace_bridge 单测 (spec 023 P6).

不调真 LLM, 只验:
1. load_blueprint_for_workspace 读到 frontmatter
2. generate_knowledge_tree_from_blueprint 写 tree + manifest + 空 knode 目录
3. load_knode_context_from_workspace 拿到正确 module + stage
4. save_knode_to_workspace 写出 5 个标准文件 (lesson/sections/theories/audio/assignment)
   + animation_html 拆成 media/<file>.html
   + manifest files 列表更新 + sha256 算对
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from course_factory import (
    clear_knode_workspace,
    generate_knowledge_tree_from_blueprint,
    get_knowledge_tree,
    load_blueprint_for_workspace,
    load_knode_context_from_workspace,
    save_knode_to_workspace,
)
from content_pipeline import workspace as ws_mod


SAMPLE_BLUEPRINT = """---
title: 蚁群行为学家
slug: ai-ant-ethologist
age_band: 10-12
domain: Robotics
duration_weeks: 4
weekly_hours: 5
budget_usd: 250
difficulty: 4
---

# 蚁群行为学家

## Hook
有意思的开场.

## Syllabus

**Phase 1 — Background(背景,第 1-2 周)**
- W1:成果 — 读论文.产出物:笔记.
- W2:成果 — 找蚁群.产出物:照片.

**Phase 2 — Tag(贴标签,第 3-4 周)**
- W3:成果 — 麻醉练习.产出物:技术过关.
- W4:成果 — 贴 10 只.产出物:10 贴标蚁.
"""


@pytest.fixture
def ws(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """构造一个隔离 workspace, 塞 1 个项目的蓝图."""
    monkeypatch.setenv("SYSTEMEDU_CONTENT_WORKSPACE", str(tmp_path / "ws"))
    ws_mod.ensure_workspace()
    bp = ws_mod.project_blueprint_dir("ai-ant-ethologist")
    bp.mkdir(parents=True)
    (bp / "README.zh.md").write_text(SAMPLE_BLUEPRINT, encoding="utf-8")
    return tmp_path / "ws"


def test_load_blueprint(ws: Path):
    bp = load_blueprint_for_workspace("ai-ant-ethologist")
    assert bp.frontmatter.slug == "ai-ant-ethologist"
    assert bp.frontmatter.duration_weeks == 4
    assert bp.title_zh == "蚁群行为学家"


def test_load_blueprint_missing(ws: Path):
    with pytest.raises(FileNotFoundError, match="not synced"):
        load_blueprint_for_workspace("does-not-exist")


def test_generate_knowledge_tree(ws: Path):
    tree = generate_knowledge_tree_from_blueprint("ai-ant-ethologist")
    assert tree["schema_version"] == "5.0"
    assert len(tree["stages"]) == 2
    assert len(tree["modules"]) == 4
    assert tree["modules"][0]["module_id"] == "M01"
    assert tree["modules"][0]["stage_id"] == "S1"
    assert tree["modules"][2]["stage_id"] == "S2"
    # 写到磁盘
    gen = ws_mod.project_generated_dir("ai-ant-ethologist")
    assert (gen / "tree" / "knowledge_tree.json").is_file()
    assert (gen / "manifest.json").is_file()
    # 4 个 knode 目录占位
    knodes = list((gen / "knodes").iterdir())
    assert len(knodes) == 4


def test_get_knowledge_tree(ws: Path):
    generate_knowledge_tree_from_blueprint("ai-ant-ethologist")
    tree = get_knowledge_tree("ai-ant-ethologist")
    assert len(tree["modules"]) == 4


def test_get_knowledge_tree_not_generated(ws: Path):
    with pytest.raises(FileNotFoundError, match="not yet generated"):
        get_knowledge_tree("ai-ant-ethologist")


def test_load_knode_context(ws: Path):
    generate_knowledge_tree_from_blueprint("ai-ant-ethologist")
    ctx = load_knode_context_from_workspace("ai-ant-ethologist", "M01")
    assert ctx.slug == "ai-ant-ethologist"
    assert ctx.module_id == "M01"
    assert ctx.knode_dir.startswith("knodes/M01-w1-")
    assert ctx.knode["stage_id"] == "S1"
    assert ctx.stage is not None
    assert ctx.stage["stage_id"] == "S1"
    assert ctx.project_meta["slug"] == "ai-ant-ethologist"
    assert ctx.knode_path is not None and ctx.knode_path.is_dir()


def test_load_knode_context_unknown_module(ws: Path):
    generate_knowledge_tree_from_blueprint("ai-ant-ethologist")
    with pytest.raises(ValueError, match="M99"):
        load_knode_context_from_workspace("ai-ant-ethologist", "M99")


def test_save_knode_to_workspace_minimal(ws: Path):
    generate_knowledge_tree_from_blueprint("ai-ant-ethologist")

    course_content = {
        "plan_markdown": "# M01 蚁群导论\n\n本周我们读 Kronauer 的论文.\n",
        "ideas": [],
        "story_paragraphs": [],
        "external_resources": {},
        "theories": [
            {
                "id": "T1",
                "knowledge_level": "K1",
                "title": "蚁群是什么",
                "body_markdown": "蚁群是社会性昆虫的集合.",
                "tags": ["biology", "ant"],
                "quizzes": [],
            }
        ],
    }
    result = save_knode_to_workspace(
        "ai-ant-ethologist",
        "M01",
        course_content,
        assignment="# 作业\n\n找到一个蚁群并拍照.",
        audio_scripts={"scripts": [{"section_id": "intro", "text": "你好", "lang": "zh-CN"}]},
    )
    assert result["module_id"] == "M01"
    assert "lesson.md" in result["files_written"]
    assert "sections.json" in result["files_written"]
    assert "theories.json" in result["files_written"]
    assert "audio_scripts.json" in result["files_written"]
    assert "assignment.md" in result["files_written"]

    gen = ws_mod.project_generated_dir("ai-ant-ethologist")
    knode_dir = gen / result["knode_dir"]
    # 文件落盘
    assert (knode_dir / "lesson.md").read_text(encoding="utf-8").startswith("# M01 蚁群导论")
    assert (knode_dir / "assignment.md").read_text(encoding="utf-8").startswith("# 作业")
    theories = json.loads((knode_dir / "theories.json").read_text(encoding="utf-8"))
    assert len(theories) == 1
    audio = json.loads((knode_dir / "audio_scripts.json").read_text(encoding="utf-8"))
    assert audio["scripts"][0]["text"] == "你好"

    # manifest 应该自动更新了
    manifest = json.loads((gen / "manifest.json").read_text(encoding="utf-8"))
    paths = {f["path"] for f in manifest["files"]}
    assert any(p.endswith("/lesson.md") for p in paths)
    assert any(p.endswith("/theories.json") for p in paths)
    # 每个 file 有 sha256
    for f in manifest["files"]:
        assert len(f["sha256"]) == 64


def test_save_knode_splits_animation_html(ws: Path):
    generate_knowledge_tree_from_blueprint("ai-ant-ethologist")

    big_html = "<!DOCTYPE html><html><body><canvas></canvas></body></html>"
    course_content = {
        "plan_markdown": "# M02 寻找蚁群\n",
        "ideas": [
            {
                "idea_id": "anim-1",
                "mode": "animation",
                "topic": "蚂蚁觅食路径动画",
                "animation_html": big_html,
                "hands_on_ref": "find-colony",
                "acceptance_ref": "photo-evidence",
            },
            {
                "idea_id": "game-1",
                "mode": "game",
                "topic": "找出领头蚁",
                "html": "<html>game</html>",
            },
        ],
        "theories": [],
    }
    result = save_knode_to_workspace("ai-ant-ethologist", "M02", course_content)
    gen = ws_mod.project_generated_dir("ai-ant-ethologist")
    knode_dir = gen / result["knode_dir"]
    media = knode_dir / "media"
    # 两个 HTML 都被拆出来
    htmls = sorted(media.glob("*.html"))
    assert len(htmls) == 2
    assert any("animation-" in p.name for p in htmls)
    assert any("game-" in p.name for p in htmls)

    sections = json.loads((knode_dir / "sections.json").read_text(encoding="utf-8"))
    ideas = sections["ideas"]
    # idea 里不应再含大 HTML 字符串
    assert "animation_html" not in ideas[0]
    assert ideas[0]["animation_path"].startswith("media/animation-")
    assert ideas[1]["game_path"].startswith("media/game-")


def test_clear_knode_workspace(ws: Path):
    generate_knowledge_tree_from_blueprint("ai-ant-ethologist")
    save_knode_to_workspace(
        "ai-ant-ethologist", "M01", {"plan_markdown": "x", "ideas": [], "theories": []}
    )
    ctx = load_knode_context_from_workspace("ai-ant-ethologist", "M01")
    assert (ctx.knode_path / "lesson.md").exists()

    clear_knode_workspace("ai-ant-ethologist", "M01")
    assert not (ctx.knode_path / "lesson.md").exists()
    assert ctx.knode_path.is_dir()  # 目录本身保留


def test_save_knode_then_publish_compatible(ws: Path):
    """save_knode_to_workspace 写出的 manifest + 目录结构必须能被 library
    importer 接收 (跟 systemedu-content publish 链路兼容)."""
    generate_knowledge_tree_from_blueprint("ai-ant-ethologist")
    save_knode_to_workspace(
        "ai-ant-ethologist",
        "M01",
        {
            "plan_markdown": "# 课程",
            "ideas": [],
            "theories": [],
        },
        assignment="# 作业\n",
    )

    gen = ws_mod.project_generated_dir("ai-ant-ethologist")
    manifest = json.loads((gen / "manifest.json").read_text(encoding="utf-8"))

    # library Manifest schema 要求字段
    assert manifest["schema_version"] == "1.0"
    assert manifest["slug"] == "ai-ant-ethologist"
    assert isinstance(manifest["files"], list) and len(manifest["files"]) > 0
    assert isinstance(manifest["knodes"], list)
    assert all("module_id" in k and "knode_dir" in k for k in manifest["knodes"])
    # 每个文件有效
    for f in manifest["files"]:
        full = gen / f["path"]
        assert full.is_file(), f"manifest references missing file {f['path']}"
        assert full.stat().st_size == f["size"]
