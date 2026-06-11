"""Public API routes (license token required) — cloud-app 通过 LibraryClient 调."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse

from ..auth import require_license
from ..models import Lesson, Project, ProjectStatus, get_session
from ..settings import PROJECTS_MEDIA_DIR

router = APIRouter(dependencies=[Depends(require_license)])


def _public_project_view(p: Project) -> dict:
    # spec 030: 把 tree 顶层 final_outcomes 提到项目元数据
    tree = p.knowledge_tree_json or {}
    final_outcomes = tree.get("final_outcomes") or []
    return {
        "slug": p.slug,
        "title": p.title,
        "title_zh": p.title_zh,
        "description": p.description,
        "status": p.status.value if p.status else "draft",
        "version": p.version,
        "knode_count": p.knode_count,
        "stage_count": p.stage_count,
        "duration_weeks": p.duration_weeks,
        "domain": p.domain,
        "age_band": p.age_band,
        "difficulty": p.difficulty,
        "tags": p.tags or [],
        "languages": p.languages or [],
        "cover_image_path": p.cover_image_path,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "final_outcomes": final_outcomes,
        # spec 040: 项目开篇连环画 (列表 + 详情都带, 前端按是否非空决定显示 icon/按钮)
        "story": p.story or [],
    }


@router.get("/projects")
def list_projects(include_draft: bool = Query(True)) -> list[dict]:
    """列出项目.

    spec 036: 默认同时返回 published + draft 项目, 让 library 能展示
    "草稿/重新生成中" 项目 (前端按 status 字段加徽章并禁止拉取/进入).
    draft 项目排在 published 之后. include_draft=false 可只返回 published.
    """
    db = get_session()
    try:
        q = db.query(Project)
        if not include_draft:
            q = q.filter_by(status=ProjectStatus.published)
        ps = q.all()
        # published 在前 (按 published_at 倒序, 无日期的排末尾), draft 在后 (按 slug)
        from datetime import datetime

        published = sorted(
            (p for p in ps if p.status == ProjectStatus.published),
            key=lambda p: p.published_at or datetime.min,
            reverse=True,
        )
        drafts = sorted(
            (p for p in ps if p.status != ProjectStatus.published),
            key=lambda p: p.slug,
        )
        return [_public_project_view(p) for p in (published + drafts)]
    finally:
        db.close()


@router.get("/projects/{slug}")
def get_project(slug: str) -> dict:
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug, status=ProjectStatus.published).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found or not published")
        return {
            **_public_project_view(p),
            "knowledge_tree": p.knowledge_tree_json,
        }
    finally:
        db.close()


@router.get("/projects/{slug}/manifest")
def get_manifest(slug: str) -> dict:
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug, status=ProjectStatus.published).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found or not published")
        return p.manifest_json
    finally:
        db.close()


@router.get("/projects/{slug}/tree")
def get_tree(slug: str) -> dict:
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug, status=ProjectStatus.published).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found")
        return p.knowledge_tree_json
    finally:
        db.close()


@router.get("/projects/{slug}/knowledge-tree")
def get_project_knowledge_tree(slug: str) -> dict:
    """spec 035: 本项目的平台知识树点亮 (lit_nodes + subjects_used + missing_concepts).

    返回:
      - lit_nodes: 本项目教过的平台节点 [{node_id, lit_by, reason}, ...]
      - subjects_used: 本项目涉及的学科 ID 列表 (有 lit_node 的)
      - missing_concepts: 本项目涉及但平台树没有的概念
    """
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug, status=ProjectStatus.published).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found")
        m = p.manifest_json or {}
        lit_nodes = m.get("lit_nodes", [])
        missing = m.get("missing_concepts", [])
        # subjects_used = lit_nodes 的 node_id 前缀 (subject.<...>) 去重
        subjects_used = sorted({nid.split(".", 1)[0]
                                for n in lit_nodes
                                if (nid := n.get("node_id"))})
        return {
            "slug": slug,
            "lit_nodes": lit_nodes,
            "subjects_used": subjects_used,
            "missing_concepts": missing,
        }
    finally:
        db.close()


# spec 035: 全平台树缓存 (模块级单例, 不依赖 admin/upload)
_PLATFORM_TREE_CACHE: dict | None = None


def _platform_tree_path() -> Path:
    """找 platform_tree.json — 优先 course_factory 源 (开发模式), 退回 PROJECTS_MEDIA_DIR/_platform/ (生产)."""
    # 开发模式: 直接从仓库读
    repo_path = Path(__file__).resolve().parents[5] / "course_factory" / "knowledge_tree" / "platform_tree.json"
    if repo_path.exists():
        return repo_path
    # 生产模式: 把 platform_tree.json 拷到 PROJECTS_MEDIA_DIR/_platform/
    fallback = PROJECTS_MEDIA_DIR / "_platform" / "platform_tree.json"
    return fallback


@router.get("/platform/knowledge-tree")
def get_platform_knowledge_tree() -> dict:
    """spec 035: 全平台学科理论知识树 (11 学科 ~425 节点 baseline)."""
    global _PLATFORM_TREE_CACHE
    if _PLATFORM_TREE_CACHE is None:
        path = _platform_tree_path()
        if not path.exists():
            raise HTTPException(status_code=503, detail=f"platform_tree.json not found at {path}")
        _PLATFORM_TREE_CACHE = json.loads(path.read_text(encoding="utf-8"))
    return _PLATFORM_TREE_CACHE


@router.get("/projects/{slug}/blueprint")
def get_blueprint(slug: str, lang: str = Query("zh-CN")):
    """读 blueprint/README.md or README.zh.md."""
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug, status=ProjectStatus.published).first()
    finally:
        db.close()
    if not p:
        raise HTTPException(status_code=404, detail="project not found")

    fname = "README.zh.md" if lang.lower().startswith("zh") else "README.md"
    target = PROJECTS_MEDIA_DIR / slug / "blueprint" / fname
    if not target.exists():
        # 退回另一个语言
        alt_target = PROJECTS_MEDIA_DIR / slug / "blueprint" / ("README.md" if fname == "README.zh.md" else "README.zh.md")
        if alt_target.exists():
            target = alt_target
        else:
            raise HTTPException(status_code=404, detail="blueprint not found")
    return JSONResponse({
        "lang_requested": lang,
        "lang_returned": "zh-CN" if target.name == "README.zh.md" else "en",
        "content": target.read_text(encoding="utf-8"),
    })


@router.get("/projects/{slug}/knodes/{knode_id}")
def get_knode(slug: str, knode_id: str) -> dict:
    """完整 knode (lesson_md + sections + audio_scripts + assignment + 文件清单)."""
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug, status=ProjectStatus.published).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found")
        lesson = db.query(Lesson).filter_by(project_slug=slug, knode_id=knode_id).first()
        if not lesson:
            raise HTTPException(status_code=404, detail="knode not found")
        return {
            "project_slug": slug,
            "knode_id": knode_id,
            "title": lesson.title,
            "summary": lesson.summary,
            "week": lesson.week,
            "stage": lesson.stage,
            "duration_minutes": lesson.duration_minutes,
            "knode_dir": lesson.knode_dir,
            "plan_markdown": lesson.plan_markdown,
            "rendered_sections": lesson.rendered_sections,
            "audio_scripts": lesson.audio_scripts,
            "assignment_md": lesson.assignment_md,
            "theories": lesson.theories,
            "slides": lesson.slides,
            "files": lesson.files,
            "version": lesson.version,
        }
    finally:
        db.close()


@router.get("/projects/{slug}/files/{file_path:path}")
def get_file(slug: str, file_path: str):
    """单个媒体文件 (anim html / audio mp3 / 图片 / 等)."""
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug, status=ProjectStatus.published).first()
    finally:
        db.close()
    if not p:
        raise HTTPException(status_code=404, detail="project not found or not published")

    target = PROJECTS_MEDIA_DIR / slug / file_path
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    try:
        target.resolve().relative_to((PROJECTS_MEDIA_DIR / slug).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="path traversal blocked")
    return FileResponse(target)


@router.get("/projects/{slug}/cover")
def get_cover(slug: str):
    """项目封面图.

    spec 036: 封面是橱窗资源, **不过滤 status** — draft 项目在 library 也要
    显示封面 (前端按 status 加「草稿」徽章但仍展示封面图)。这是唯一对 draft
    放行的资源; 详情/树/knodes/download/其它媒体仍硬过滤 published。
    """
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug).first()
    finally:
        db.close()
    if not p:
        raise HTTPException(status_code=404, detail="project not found")
    if not p.cover_image_path:
        raise HTTPException(status_code=404, detail="no cover")

    target = PROJECTS_MEDIA_DIR / slug / p.cover_image_path
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="cover file not found")
    try:
        target.resolve().relative_to((PROJECTS_MEDIA_DIR / slug).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="path traversal blocked")
    return FileResponse(target)


@router.get("/projects/{slug}/download")
def download_project(slug: str):
    """spec 033: 下载完整项目 tarball.

    用于 student-app pull 时把项目 clone 到本地。返回 import 时存档的原始 tarball
    (PROJECTS_MEDIA_DIR/<slug>/_archive/<slug>-<version>.tar.gz)。
    """
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug, status=ProjectStatus.published).first()
    finally:
        db.close()
    if not p:
        raise HTTPException(status_code=404, detail="project not found or not published")

    archive_dir = PROJECTS_MEDIA_DIR / slug / "_archive"
    expected = archive_dir / f"{slug}-{p.version}.tar.gz"
    if expected.exists() and expected.is_file():
        return FileResponse(
            expected,
            media_type="application/gzip",
            filename=f"{slug}-{p.version}.tar.gz",
        )
    # Fallback: 如果 import 时 (在 spec 033 之前) 没存 archive, 找目录里任一 tarball
    if archive_dir.exists():
        candidates = sorted(archive_dir.glob(f"{slug}-*.tar.gz"))
        if candidates:
            chosen = candidates[-1]
            return FileResponse(
                chosen,
                media_type="application/gzip",
                filename=chosen.name,
            )
    raise HTTPException(
        status_code=503,
        detail=f"archive not available for {slug}-{p.version}; admin must re-import",
    )
