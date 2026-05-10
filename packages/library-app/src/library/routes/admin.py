"""Admin API routes (JWT required, except /admin/auth/login)."""

from __future__ import annotations

import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..auth import (
    create_access_token,
    require_admin,
    verify_password,
)
from ..importer import ImportError_, import_tarball
from ..models import AdminUser, Lesson, Project, ProjectStatus, get_session
from ..settings import PROJECTS_MEDIA_DIR

# ---------------------------------------------------------------------------
# Auth router (/admin/auth/*) - 不需要 JWT (除了 /me /logout)
# ---------------------------------------------------------------------------

auth_router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    role: str
    expires_at_unix: int


@auth_router.post("/login", response_model=LoginResponse)
def admin_login(req: LoginRequest) -> LoginResponse:
    db = get_session()
    try:
        user = db.query(AdminUser).filter_by(username=req.username).first()
        if user is None or user.status.value != "active":
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        user_id = user.id
        username = user.username
        role = user.role.value

        token = create_access_token(user_id, username, role)
        user.last_login_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()

    from ..settings import JWT_EXPIRE_HOURS

    expires_at = int(datetime.now(timezone.utc).timestamp()) + JWT_EXPIRE_HOURS * 3600
    return LoginResponse(
        token=token,
        username=username,
        role=role,
        expires_at_unix=expires_at,
    )


@auth_router.get("/me")
def admin_me(admin: AdminUser = Depends(require_admin)) -> dict:
    return {
        "id": admin.id,
        "username": admin.username,
        "role": admin.role.value,
        "status": admin.status.value,
    }


@auth_router.post("/logout")
def admin_logout(admin: AdminUser = Depends(require_admin)) -> dict:
    return {"status": "logged out"}


# ---------------------------------------------------------------------------
# Admin business router (/admin/*)
# ---------------------------------------------------------------------------

router = APIRouter(dependencies=[Depends(require_admin)])


def _project_summary(p: Project) -> dict:
    return {
        "slug": p.slug,
        "title": p.title,
        "title_zh": p.title_zh,
        "description": p.description,
        "version": p.version,
        "status": p.status.value if hasattr(p.status, "value") else str(p.status),
        "knode_count": p.knode_count,
        "stage_count": p.stage_count,
        "duration_weeks": p.duration_weeks,
        "domain": p.domain,
        "age_band": p.age_band,
        "difficulty": p.difficulty,
        "tags": p.tags or [],
        "languages": p.languages or [],
        "total_size_bytes": p.total_size_bytes,
        "cover_image_path": p.cover_image_path,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/projects")
def admin_list_projects(
    status: str | None = None,
    search: str | None = None,
) -> list[dict]:
    """列出所有项目 (含 draft / published)."""
    db = get_session()
    try:
        q = db.query(Project)
        if status:
            try:
                q = q.filter_by(status=ProjectStatus(status))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"unknown status: {status}")
        if search:
            q = q.filter(Project.title.contains(search) | Project.slug.contains(search))
        projects = q.order_by(Project.updated_at.desc()).all()
        return [_project_summary(p) for p in projects]
    finally:
        db.close()


@router.get("/projects/{slug}")
def admin_project_detail(slug: str) -> dict:
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found")
        return {
            **_project_summary(p),
            "manifest": p.manifest_json,
            "knowledge_tree": p.knowledge_tree_json,
        }
    finally:
        db.close()


@router.get("/projects/{slug}/files/{file_path:path}")
def admin_get_file(slug: str, file_path: str):
    """获取项目下任意文件 (用于 admin UI 预览 anim html / lesson.md / 等)."""
    from fastapi.responses import FileResponse

    target = PROJECTS_MEDIA_DIR / slug / file_path
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    # 安全: 确保 target 在 PROJECTS_MEDIA_DIR/<slug> 下
    try:
        target.resolve().relative_to((PROJECTS_MEDIA_DIR / slug).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="path traversal blocked")
    return FileResponse(target)


@router.post("/projects/import")
async def admin_import_project(
    file: UploadFile = File(...),
    overwrite: bool = True,
) -> dict:
    """上传 tarball, 服务器解压 + 验证 + 写 DB."""
    if not file.filename or not file.filename.endswith(".tar.gz"):
        raise HTTPException(status_code=400, detail="expected .tar.gz file")

    # 落到临时位置
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)

    try:
        manifest = import_tarball(tmp_path, allow_overwrite=overwrite)
    except ImportError_ as e:
        raise HTTPException(status_code=400, detail=f"import failed: {e}")
    finally:
        tmp_path.unlink(missing_ok=True)

    return {
        "imported": True,
        "slug": manifest.slug,
        "title": manifest.title,
        "version": manifest.version,
        "knode_count": manifest.knode_count,
    }


class ProjectPatch(BaseModel):
    title: str | None = None
    title_zh: str | None = None
    description: str | None = None
    tags: list[str] | None = None


@router.patch("/projects/{slug}")
def admin_patch_project(slug: str, patch: ProjectPatch) -> dict:
    """更新 metadata (title / description / tags)."""
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found")
        if patch.title is not None:
            p.title = patch.title
        if patch.title_zh is not None:
            p.title_zh = patch.title_zh
        if patch.description is not None:
            p.description = patch.description
        if patch.tags is not None:
            p.tags = patch.tags
        p.updated_at = datetime.utcnow()
        db.commit()
        return _project_summary(p)
    finally:
        db.close()


@router.post("/projects/{slug}/publish")
def admin_publish_project(slug: str) -> dict:
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found")
        p.status = ProjectStatus.published
        p.published_at = datetime.utcnow()
        db.commit()
        return _project_summary(p)
    finally:
        db.close()


@router.post("/projects/{slug}/unpublish")
def admin_unpublish_project(slug: str) -> dict:
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found")
        p.status = ProjectStatus.draft
        p.published_at = None
        db.commit()
        return _project_summary(p)
    finally:
        db.close()


@router.delete("/projects/{slug}")
def admin_delete_project(slug: str) -> dict:
    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=slug).first()
        if not p:
            raise HTTPException(status_code=404, detail="project not found")
        # 删 lessons + media files + project
        db.query(Lesson).filter_by(project_slug=slug).delete()
        db.delete(p)
        db.commit()
        # 删媒体
        target_dir = PROJECTS_MEDIA_DIR / slug
        if target_dir.exists():
            shutil.rmtree(target_dir)
    finally:
        db.close()
    return {"deleted": True, "slug": slug}


@router.get("/stats")
def admin_stats() -> dict:
    """简单统计."""
    db = get_session()
    try:
        total = db.query(Project).count()
        published = db.query(Project).filter_by(status=ProjectStatus.published).count()
        draft = total - published
        lessons = db.query(Lesson).count()
        return {
            "total_projects": total,
            "published_projects": published,
            "draft_projects": draft,
            "total_lessons": lessons,
        }
    finally:
        db.close()
