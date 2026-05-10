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
    return {
        "slug": p.slug,
        "title": p.title,
        "title_zh": p.title_zh,
        "description": p.description,
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
    }


@router.get("/projects")
def list_projects() -> list[dict]:
    """列出 published 项目."""
    db = get_session()
    try:
        ps = (
            db.query(Project)
            .filter_by(status=ProjectStatus.published)
            .order_by(Project.published_at.desc())
            .all()
        )
        return [_public_project_view(p) for p in ps]
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
