"""Workspace 模式桥接 (spec 023 P6).

旧模式 (本地单用户):
    ctx = load_context("project-name", idx=0)
    save_knode(ctx, course_content)
    # → 写到 SQLite + ~/.systemedu/media/

新模式 (workspace, spec 023 后默认):
    bp = load_blueprint_for_workspace("ai-ant-ethologist")
    tree = generate_knowledge_tree_from_blueprint("ai-ant-ethologist")
    # (你 review 整棵树后再继续)
    ctx = load_knode_context_from_workspace("ai-ant-ethologist", "M01")
    # ... Claude 跑 SKILL.md 流程, 拿到 course_content ...
    save_knode_to_workspace(
        slug="ai-ant-ethologist",
        module_id="M01",
        course_content=course_content,
        assignment=assignment_md,
        audio_scripts=audio_scripts,
    )
    # → 写到 content-workspace/generated/<slug>/knodes/<dir>/{lesson.md,
    #   sections.json, audio_scripts.json, assignment.md, theories.json}
    #   + 自动更新 manifest 的 files + sha256

后续用 CLI publish 入库:
    $ systemedu-content publish ai-ant-ethologist --target=local
"""

from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# 依赖 content-pipeline (蓝图解析 + V5 骨架编译 + manifest 生成)
from content_pipeline import blueprint as _bp_mod
from content_pipeline import compile as _compile_mod
from content_pipeline import manifest as _manifest_mod
from content_pipeline import workspace as _ws_mod


# ---------------------------------------------------------------------------
# Dataclass (workspace 版本的 KnodeContext, 跟 factory.KnodeContext 字段对齐)
# ---------------------------------------------------------------------------

@dataclass
class WorkspaceKnodeContext:
    """workspace 模式下 Claude 拿到的 knode 上下文.

    跟 factory.KnodeContext 字段对齐但不同源: 这个版本从 manifest +
    tree/knowledge_tree.json 读, 不需要 SQLite。
    """
    slug: str                     # "ai-ant-ethologist"
    module_id: str                # "M01"
    knode_dir: str                # "knodes/M01-w1-..."
    knode: dict                   # 该 module 的 V5 数据
    stage: dict | None = None     # 所属 stage 字典
    project_meta: dict = field(default_factory=dict)  # tree.project_identity + frontmatter
    workspace_root: Path | None = None
    knode_path: Path | None = None   # generated/<slug>/knodes/<dir>/


# ---------------------------------------------------------------------------
# 1. 蓝图读取
# ---------------------------------------------------------------------------

def load_blueprint_for_workspace(slug: str) -> _bp_mod.ParsedBlueprint:
    """从 content-workspace/blueprints/<slug>/ 读蓝图 (frontmatter + body)."""
    bp_dir = _ws_mod.project_blueprint_dir(slug)
    if not bp_dir.is_dir():
        raise FileNotFoundError(
            f"blueprint not synced: {bp_dir}. "
            f"Run: systemedu-content blueprint sync ~/Dev/systemeduidea"
        )
    return _bp_mod.load_blueprint(bp_dir)


# ---------------------------------------------------------------------------
# 2. 蓝图 → V5 知识树 (本期: 复用 P3 compile 的骨架编译, 不调 LLM)
#
# 未来可以替换成调 thinking LLM (像 packages/core/education/tree_generator.py)
# 拿真依赖 / acceptance_artifacts / hands_on_components 等完整字段。
# 本期作为 SKILL.md Step 0.5 入口, 让 Claude 拿到骨架后再写每个 module 时
# 顺手补完 V5 字段 (并通过 save_knode_to_workspace 写回 tree)。
# ---------------------------------------------------------------------------

def generate_knowledge_tree_from_blueprint(slug: str) -> dict:
    """蓝图 → V5 KnowledgeTree (骨架). 写到 generated/<slug>/tree/knowledge_tree.json.

    返回完整的 tree dict; 调用方 (Claude) 应该 review, 必要时补字段后再继续
    Step 1+ 逐 knode 生成内容。

    幂等: 已存在的 tree.json 会被覆盖, 但 knode 目录里的内容文件不动。
    """
    result = _compile_mod.compile_project(slug)
    tree = json.loads(result.tree_path.read_text(encoding="utf-8"))
    return tree


def get_knowledge_tree(slug: str) -> dict:
    """读已生成的 tree.json (不重新编译)."""
    gen = _ws_mod.project_generated_dir(slug)
    tree_path = gen / "tree" / "knowledge_tree.json"
    if not tree_path.is_file():
        raise FileNotFoundError(
            f"knowledge tree not yet generated for {slug}. "
            f"Call generate_knowledge_tree_from_blueprint('{slug}') first."
        )
    return json.loads(tree_path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# 3. 单个 knode 上下文加载 (替代 factory.load_context)
# ---------------------------------------------------------------------------

def load_knode_context_from_workspace(
    slug: str, module_id: str
) -> WorkspaceKnodeContext:
    """加载某个 module 的上下文供 SKILL.md 流程使用.

    Args:
        slug: 项目 slug, 如 "ai-ant-ethologist"
        module_id: V5 module 编号, 如 "M01"

    Returns:
        WorkspaceKnodeContext, 含 knode/stage/project_meta + 文件路径
    """
    tree = get_knowledge_tree(slug)
    module = next(
        (m for m in tree.get("modules", []) if m.get("module_id") == module_id),
        None,
    )
    if module is None:
        raise ValueError(
            f"module {module_id!r} not found in {slug} tree "
            f"(available: {[m['module_id'] for m in tree.get('modules', [])]})"
        )

    stage_id = module.get("stage_id", "")
    stage = next(
        (s for s in tree.get("stages", []) if s.get("stage_id") == stage_id),
        None,
    )

    # 找到 manifest 里对应的 knode_dir
    gen = _ws_mod.project_generated_dir(slug)
    manifest_path = gen / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(
            f"manifest not found: {manifest_path}. "
            f"Call generate_knowledge_tree_from_blueprint('{slug}') first."
        )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entry = next(
        (k for k in manifest.get("knodes", []) if k.get("module_id") == module_id),
        None,
    )
    if entry is None:
        raise ValueError(
            f"module {module_id!r} present in tree but missing from manifest"
        )

    knode_path = gen / entry["knode_dir"]
    knode_path.mkdir(parents=True, exist_ok=True)

    project_meta = dict(tree.get("project_identity", {}))
    project_meta["title"] = tree.get("title", "")
    project_meta["description"] = tree.get("description", "")

    return WorkspaceKnodeContext(
        slug=slug,
        module_id=module_id,
        knode_dir=entry["knode_dir"],
        knode=module,
        stage=stage,
        project_meta=project_meta,
        workspace_root=_ws_mod.workspace_root(),
        knode_path=knode_path,
    )


# ---------------------------------------------------------------------------
# 4. 单个 knode 写入 (替代 factory.save_knode)
# ---------------------------------------------------------------------------

# course_content 里挂的 HTML 字符串 (animation / game / story) 在写盘时需要
# 拆成单独文件, 这里定义模式:
_SECTION_KIND_TO_EXT = {
    "animation": "html",
    "game": "html",
    "diagram": "html",
}


def _slugify(text: str, maxlen: int = 30) -> str:
    """简单 slug: 仅保留 ascii 字母数字 + 连字符."""
    s = text.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if not s:
        s = "section"
    return s[:maxlen].rstrip("-") or "section"


def _split_html_assets(
    course_content: dict, knode_path: Path, *, slug: str, module_id: str
) -> tuple[dict, list[Path]]:
    """从 course_content 里抽出 HTML 大字段 (animation_html / game_html / 等),
    写到 knode_path/media/ 子目录, course_content 里改记文件路径引用。

    返回 (精简后的 course_content, 写出的文件列表)。
    """
    course_content = dict(course_content)
    media_dir = knode_path / "media"
    written: list[Path] = []

    ideas = list(course_content.get("ideas", []) or [])
    for idx, idea in enumerate(ideas):
        mode = idea.get("mode")
        html_key = f"{mode}_html"  # animation_html / game_html
        # 检查 idea 自己挂的 html 字段
        for key in (html_key, "html", "html_content"):
            html = idea.get(key)
            if not isinstance(html, str) or not html.strip():
                continue
            topic = idea.get("topic") or idea.get("title") or f"{mode}-{idx}"
            fname = f"{mode}-{_slugify(str(topic))}.html"
            media_dir.mkdir(parents=True, exist_ok=True)
            target = media_dir / fname
            target.write_text(html, encoding="utf-8")
            idea = dict(idea)
            idea[f"{mode}_path"] = f"media/{fname}"
            idea.pop(key, None)
            ideas[idx] = idea
            written.append(target)
            break  # 一个 idea 一份 HTML
    course_content["ideas"] = ideas

    # 顶层 animation_html (旧式调用)
    top_anim = course_content.get("animation_html")
    if isinstance(top_anim, str) and top_anim.strip():
        media_dir.mkdir(parents=True, exist_ok=True)
        target = media_dir / "animation.html"
        target.write_text(top_anim, encoding="utf-8")
        course_content.pop("animation_html", None)
        course_content["animation_path"] = "media/animation.html"
        written.append(target)
    top_game = course_content.get("game_html")
    if isinstance(top_game, str) and top_game.strip():
        media_dir.mkdir(parents=True, exist_ok=True)
        target = media_dir / "game.html"
        target.write_text(top_game, encoding="utf-8")
        course_content.pop("game_html", None)
        course_content["game_path"] = "media/game.html"
        written.append(target)

    return course_content, written


def save_knode_to_workspace(
    slug: str,
    module_id: str,
    course_content: dict,
    *,
    assignment: str = "",
    audio_scripts: dict | list | None = None,
    update_manifest: bool = True,
) -> dict:
    """把 SKILL.md 跑完得到的 course_content 写到 workspace.

    输出目录结构 (跟 library importer / manifest schema 对齐):

        content-workspace/generated/<slug>/knodes/<knode_dir>/
            ├── lesson.md            ← plan_markdown
            ├── sections.json        ← {"ideas": [...], "story_paragraphs":..., 等}
            ├── theories.json        ← course_content.theories
            ├── audio_scripts.json   ← audio_scripts (传入 OR course_content.audio_scripts)
            ├── assignment.md        ← assignment (可空)
            └── media/<*.html>       ← animation/game HTML 拆出来的独立文件

    Args:
        slug: 项目 slug
        module_id: V5 module id ("M01")
        course_content: make_course_content() 返回的 dict
        assignment: assignment markdown (可空)
        audio_scripts: 该 knode 的 audio_scripts (可在 course_content 里也可单独传)
        update_manifest: 写完后是否调 regenerate_manifest 重算 files+sha256

    Returns:
        {"knode_dir": str, "files_written": list[str]} dict 供 SKILL 输出
    """
    ctx = load_knode_context_from_workspace(slug, module_id)
    knode_path = ctx.knode_path
    assert knode_path is not None

    course_content, _media_files = _split_html_assets(
        course_content, knode_path, slug=slug, module_id=module_id
    )

    written: list[str] = []

    # lesson.md = plan_markdown
    plan = course_content.get("plan_markdown", "") or ""
    (knode_path / "lesson.md").write_text(plan, encoding="utf-8")
    written.append("lesson.md")

    # sections.json: ideas + story_paragraphs + external_resources +
    # rendered_sections (如果 course_content 里有)
    sections_payload = {
        "ideas": course_content.get("ideas", []) or [],
        "story_paragraphs": course_content.get("story_paragraphs", []) or [],
        "external_resources": course_content.get("external_resources", {}) or {},
        "rendered_sections": course_content.get("rendered_sections", []) or [],
        # 可选: 把不属于上面但属于 course_content 的字段也带上 (除大 HTML)
        "animation_topic": course_content.get("animation_topic", ""),
        "exercise_topic": course_content.get("exercise_topic", ""),
        "game_topic": course_content.get("game_topic", ""),
    }
    (knode_path / "sections.json").write_text(
        json.dumps(sections_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    written.append("sections.json")

    # theories.json
    theories = course_content.get("theories") or []
    (knode_path / "theories.json").write_text(
        json.dumps(theories, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    written.append("theories.json")

    # audio_scripts.json
    audio = audio_scripts
    if audio is None:
        audio = course_content.get("audio_scripts")
    if audio is None:
        audio = {"scripts": []}
    (knode_path / "audio_scripts.json").write_text(
        json.dumps(audio, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    written.append("audio_scripts.json")

    # assignment.md
    if assignment:
        (knode_path / "assignment.md").write_text(assignment, encoding="utf-8")
        written.append("assignment.md")

    # 重算 manifest 的 files + sha256
    if update_manifest:
        gen = _ws_mod.project_generated_dir(slug)
        _manifest_mod.regenerate_manifest(gen)

    return {
        "slug": slug,
        "module_id": module_id,
        "knode_dir": ctx.knode_dir,
        "files_written": written,
    }


# ---------------------------------------------------------------------------
# 5. 删除 knode (重新生成时清旧)
# ---------------------------------------------------------------------------

def clear_knode_workspace(slug: str, module_id: str) -> None:
    """清空某个 knode 目录的内容 (保留目录本身)."""
    ctx = load_knode_context_from_workspace(slug, module_id)
    if ctx.knode_path and ctx.knode_path.is_dir():
        for item in ctx.knode_path.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
