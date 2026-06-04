"""/api/my/* — "我的项目" + 学习进度。

GET    /api/my/projects                     — 已 Pull 列表 (并发拉 library 元数据)
POST   /api/my/projects/{slug}               — Pull
DELETE /api/my/projects/{slug}               — 软移除
GET    /api/my/progress/{slug}               — 该 slug 的最后访问 module
PUT    /api/my/progress/{slug}/{module_id}   — 标记最后访问
"""

from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import shutil
from datetime import datetime
from pathlib import Path

from starlette.responses import FileResponse

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from systemedu.core.library_client import (
    LibraryError,
    LibraryNotFound,
    LibraryUnauthorized,
    ProjectMeta,
)

from ..auth.deps import require_login
from ..db import (
    UserProject,
    delete_last_visited,
    get_last_visited,
    get_user_project,
    list_user_projects,
    soft_remove_user_project,
    upsert_last_visited,
    upsert_user_project,
)
from ..library_proxy.client import get_library_client
from .storage import (
    cleanup_local_project,
    extract_tarball_safely,
    project_local_dir,
)


logger = logging.getLogger(__name__)


def _lib_error_response(e: Exception) -> JSONResponse:
    if isinstance(e, LibraryNotFound):
        return JSONResponse({"error": "not_found"}, status_code=404)
    if isinstance(e, LibraryUnauthorized):
        return JSONResponse({"error": "library_unauthorized"}, status_code=502)
    if isinstance(e, LibraryError):
        return JSONResponse(
            {"error": "library_error", "detail": str(e)}, status_code=502
        )
    logger.exception("unexpected library error")
    return JSONResponse({"error": "internal"}, status_code=500)


async def _fetch_meta(slug: str) -> ProjectMeta | None:
    """拉 library 元数据; 项目下架/出错时返回 None。"""
    try:
        return await get_library_client().get_project(slug)
    except LibraryNotFound:
        return None
    except Exception:
        logger.exception("fetch library meta failed slug=%s", slug)
        return None


def _project_to_dict(p: UserProject, meta: ProjectMeta | None, last_module: str | None) -> dict:
    if meta is not None:
        base = {
            "slug": p.library_slug,
            "title": meta.title,
            "title_zh": meta.title_zh,
            "description": meta.description,
            "cover_image_path": meta.cover_image_path,
            "knode_count": meta.knode_count,
            "stage_count": meta.stage_count,
            "domain": meta.domain,
            "age_band": meta.age_band,
            "difficulty": meta.difficulty,
            "tags": meta.tags,
            "library_version": meta.version,
        }
        # 检测 library 升版
        if p.library_version and meta.version and p.library_version != meta.version:
            base["upgrade_available"] = True
        unavailable = False
    else:
        base = {
            "slug": p.library_slug,
            "title": p.library_slug,
            "title_zh": None,
            "description": "",
            "cover_image_path": None,
            "knode_count": 0,
            "stage_count": 0,
            "domain": None,
            "age_band": None,
            "difficulty": None,
            "tags": [],
            "library_version": p.library_version or "",
        }
        unavailable = True
    base.update({
        "pulled_at": p.pulled_at.isoformat() if p.pulled_at else None,
        "removed_at": p.removed_at.isoformat() if p.removed_at else None,
        "last_module_id": last_module,
        "unavailable": unavailable,
    })
    return base


async def api_my_projects_list(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    projects = list_user_projects(user_id)
    metas = await asyncio.gather(*[_fetch_meta(p.library_slug) for p in projects])
    last_visits = [get_last_visited(user_id, p.library_slug) for p in projects]
    out = [
        _project_to_dict(p, meta, lv.last_module_id if lv else None)
        for p, meta, lv in zip(projects, metas, last_visits)
    ]
    return JSONResponse(out)


async def api_my_projects_pull(request: Request) -> JSONResponse:
    """spec 033: Pull = 真把 tarball 解压到本地, 不再只是 DB 记一行."""
    slug = request.path_params["slug"]
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        meta = await get_library_client().get_project(slug)
    except LibraryNotFound:
        return JSONResponse({"error": "project_not_found"}, status_code=404)
    except Exception as e:
        return _lib_error_response(e)

    target_version = meta.version or ""
    target_dir = project_local_dir(user_id, slug, target_version)

    # 检查是否已 clone 同版本
    existing = get_user_project(user_id, slug)
    same_version_already_cloned = (
        existing is not None
        and existing.cloned_version == target_version
        and existing.local_path
        and Path(existing.local_path).exists()
        and (Path(existing.local_path) / "manifest.json").exists()
    )

    if same_version_already_cloned:
        # 直接 resurrect (清 removed_at), 不重新下载
        project, created = upsert_user_project(
            user_id, slug, library_version=target_version
        )
        lv = get_last_visited(user_id, slug)
        body = _project_to_dict(project, meta, lv.last_module_id if lv else None)
        body["created"] = created
        body["cloned"] = False  # 没真下载, 复用本地
        return JSONResponse(body, status_code=200)

    # 真下载 + 解压
    try:
        tarball = await get_library_client().download_project(slug)
    except LibraryNotFound:
        return JSONResponse({"error": "archive_not_found"}, status_code=404)
    except Exception as e:
        return _lib_error_response(e)

    tmp_dir = target_dir.parent / f".{target_version}.tmp"
    try:
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)
        tmp_dir.mkdir(parents=True, exist_ok=True)
        extract_tarball_safely(tarball, tmp_dir)
        # atomic rename
        if target_dir.exists():
            shutil.rmtree(target_dir)
        tmp_dir.rename(target_dir)
    except Exception as e:
        # 清理半成品
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)
        if target_dir.exists() and not (target_dir / "manifest.json").exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        logger.exception("pull failed for %s", slug)
        return JSONResponse(
            {"error": "extract_failed", "detail": str(e)}, status_code=500
        )

    project, created = upsert_user_project(
        user_id,
        slug,
        library_version=target_version,
        cloned_version=target_version,
        local_path=str(target_dir),
        cloned_at=datetime.utcnow(),
    )
    lv = get_last_visited(user_id, slug)
    body = _project_to_dict(project, meta, lv.last_module_id if lv else None)
    body["created"] = created
    body["cloned"] = True
    body["cloned_version"] = target_version
    body["local_path"] = str(target_dir)
    return JSONResponse(body, status_code=201 if created else 200)


async def api_my_projects_remove(request: Request) -> JSONResponse:
    slug = request.path_params["slug"]
    user_id, err = await require_login(request)
    if err:
        return err
    existed = soft_remove_user_project(user_id, slug)
    # spec 033: 卸载时真删本地目录, 释放磁盘
    local_removed = cleanup_local_project(user_id, slug)
    # 同步清掉学习进度, 避免"卸载 -> 重新 clone"后旧 last_module_id 复活
    delete_last_visited(user_id, slug)
    if not existed and not local_removed:
        return JSONResponse({"removed": False}, status_code=200)
    return JSONResponse(
        {"removed": True, "local_cleaned": local_removed},
        status_code=200,
    )


async def api_my_progress_get(request: Request) -> JSONResponse:
    slug = request.path_params["slug"]
    user_id, err = await require_login(request)
    if err:
        return err
    lv = get_last_visited(user_id, slug)
    if lv is None:
        return JSONResponse({"last_module_id": None, "last_visited_at": None})
    return JSONResponse({
        "last_module_id": lv.last_module_id,
        "last_visited_at": lv.last_visited_at.isoformat() if lv.last_visited_at else None,
    })


async def api_my_progress_put(request: Request) -> JSONResponse:
    slug = request.path_params["slug"]
    module_id = request.path_params["module_id"]
    user_id, err = await require_login(request)
    if err:
        return err
    # 必须已 Pull 才能写进度
    up = get_user_project(user_id, slug)
    if up is None or up.removed_at is not None:
        return JSONResponse({"error": "pull_required", "slug": slug}, status_code=403)
    lv = upsert_last_visited(user_id, slug, module_id)
    return JSONResponse({
        "last_module_id": lv.last_module_id,
        "last_visited_at": lv.last_visited_at.isoformat() if lv.last_visited_at else None,
    })


async def api_my_project_knode(request: Request) -> JSONResponse:
    """spec 033: 学习时从本地读 knode 数据 (不再实时访问 library)."""
    slug = request.path_params["slug"]
    knode_id = request.path_params["knode_id"]
    user_id, err = await require_login(request)
    if err:
        return err

    up = get_user_project(user_id, slug)
    if up is None or up.removed_at is not None:
        return JSONResponse(
            {"error": "not_pulled", "slug": slug}, status_code=403
        )
    if not up.local_path or not up.cloned_version:
        # 老式 pull (spec 033 前) 没真下载, 提示重新 Pull
        return JSONResponse(
            {
                "error": "needs_reclone",
                "slug": slug,
                "hint": "请重新 Pull 项目以更新到新版下载方式",
            },
            status_code=409,
        )
    local = Path(up.local_path)
    if not local.exists() or not (local / "manifest.json").exists():
        return JSONResponse(
            {
                "error": "local_missing",
                "slug": slug,
                "hint": "本地项目文件已丢失, 请重新 Pull",
            },
            status_code=410,
        )

    try:
        manifest = json.loads((local / "manifest.json").read_text(encoding="utf-8"))
    except Exception as e:
        logger.exception("manifest read failed for %s", slug)
        return JSONResponse(
            {"error": "manifest_corrupt", "detail": str(e)}, status_code=500
        )

    entry = next(
        (k for k in manifest.get("knodes", []) if k.get("module_id") == knode_id),
        None,
    )
    if entry is None:
        return JSONResponse(
            {"error": "knode_not_found", "knode_id": knode_id}, status_code=404
        )

    knode_dir = local / entry["knode_dir"]
    if not knode_dir.exists():
        return JSONResponse(
            {"error": "knode_dir_missing", "knode_dir": entry["knode_dir"]},
            status_code=410,
        )

    def _read_text(p: Path, default: str = "") -> str:
        return p.read_text(encoding="utf-8") if p.exists() else default

    def _read_json(p: Path, default):
        if not p.exists():
            return default
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return default

    lesson_md = _read_text(knode_dir / "lesson.md")
    assignment_md = _read_text(knode_dir / "assignment.md")
    sections = _read_json(knode_dir / "sections.json", default={})
    theories = _read_json(knode_dir / "theories.json", default=[])
    audio_scripts = _read_json(knode_dir / "audio_scripts.json", default={})

    # spec 033 关键修复: 把 idea.{mode}_path 回填到 rendered_sections[id].html_path,
    # 让前端 inlineHtmlPaths() 能找到 HTML 文件。
    rendered = sections.get("rendered_sections") or {}
    if isinstance(rendered, dict):
        for idea in sections.get("ideas", []) or []:
            if not isinstance(idea, dict):
                continue
            idea_id = idea.get("idea_id")
            mode = idea.get("mode")
            if not idea_id or not mode:
                continue
            path = idea.get(f"{mode}_path")
            section = rendered.get(idea_id)
            if (
                path
                and isinstance(section, dict)
                and not section.get("html_path")
                and not section.get("html")
            ):
                section["html_path"] = path

    # 该 knode 的文件清单 (从 manifest filter)
    knode_files = [
        f
        for f in manifest.get("files", [])
        if f.get("path", "").startswith(entry["knode_dir"] + "/")
    ]

    return JSONResponse(
        {
            "project_slug": slug,
            "knode_id": knode_id,
            "title": entry.get("title"),
            "week": entry.get("week"),
            "stage": entry.get("stage"),
            "duration_minutes": entry.get("duration_minutes"),
            "knode_dir": entry["knode_dir"],
            "plan_markdown": lesson_md,
            "rendered_sections": sections,  # 保持跟 library API 一致 (整个 sections.json)
            "audio_scripts": audio_scripts,
            "assignment_md": assignment_md,
            "theories": theories,
            "files": knode_files,
            "version": up.cloned_version,
        }
    )


async def api_my_project_file(request: Request):
    """spec 033: 流出本地媒体文件 (anim/game/diagram HTML, 图片, 音频)."""
    slug = request.path_params["slug"]
    file_path = request.path_params["path"]
    user_id, err = await require_login(request)
    if err:
        return err

    up = get_user_project(user_id, slug)
    if up is None or up.removed_at is not None:
        return JSONResponse(
            {"error": "not_pulled", "slug": slug}, status_code=403
        )
    if not up.local_path:
        return JSONResponse(
            {"error": "needs_reclone", "slug": slug}, status_code=409
        )

    local = Path(up.local_path)
    if not local.exists():
        return JSONResponse({"error": "local_missing"}, status_code=410)

    # 安全 path resolve, 防止 ../ 越界
    try:
        target = (local / file_path).resolve()
        local_resolved = local.resolve()
        target.relative_to(local_resolved)
    except (ValueError, OSError):
        return JSONResponse({"error": "forbidden"}, status_code=403)

    if not target.exists() or not target.is_file():
        return JSONResponse({"error": "file_not_found"}, status_code=404)

    ct, _ = mimetypes.guess_type(str(target))
    return FileResponse(target, media_type=ct or "application/octet-stream")


ROUTES = [
    Route("/api/my/projects", api_my_projects_list, methods=["GET"]),
    Route("/api/my/projects/{slug}", api_my_projects_pull, methods=["POST"]),
    Route("/api/my/projects/{slug}", api_my_projects_remove, methods=["DELETE"]),
    Route(
        "/api/my/projects/{slug}/knodes/{knode_id}",
        api_my_project_knode,
        methods=["GET"],
    ),
    Route(
        "/api/my/projects/{slug}/files/{path:path}",
        api_my_project_file,
        methods=["GET"],
    ),
    Route("/api/my/progress/{slug}", api_my_progress_get, methods=["GET"]),
    Route(
        "/api/my/progress/{slug}/{module_id}",
        api_my_progress_put,
        methods=["PUT"],
    ),
]
