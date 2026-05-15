"""/api/my/* — "我的项目" + 学习进度。

GET    /api/my/projects                     — 已 Pull 列表 (并发拉 library 元数据)
POST   /api/my/projects/{slug}               — Pull
DELETE /api/my/projects/{slug}               — 软移除
GET    /api/my/progress/{slug}               — 该 slug 的最后访问 module
PUT    /api/my/progress/{slug}/{module_id}   — 标记最后访问
"""

from __future__ import annotations

import asyncio
import logging

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
    get_last_visited,
    get_user_project,
    list_user_projects,
    soft_remove_user_project,
    upsert_last_visited,
    upsert_user_project,
)
from ..library_proxy.client import get_library_client


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

    project, created = upsert_user_project(user_id, slug, meta.version or "")
    lv = get_last_visited(user_id, slug)
    body = _project_to_dict(project, meta, lv.last_module_id if lv else None)
    body["created"] = created
    return JSONResponse(body, status_code=201 if created else 200)


async def api_my_projects_remove(request: Request) -> JSONResponse:
    slug = request.path_params["slug"]
    user_id, err = await require_login(request)
    if err:
        return err
    existed = soft_remove_user_project(user_id, slug)
    if not existed:
        # 没在书架里, idempotent 返 200 + ok=false
        return JSONResponse({"removed": False}, status_code=200)
    return JSONResponse({"removed": True}, status_code=200)


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


ROUTES = [
    Route("/api/my/projects", api_my_projects_list, methods=["GET"]),
    Route("/api/my/projects/{slug}", api_my_projects_pull, methods=["POST"]),
    Route("/api/my/projects/{slug}", api_my_projects_remove, methods=["DELETE"]),
    Route("/api/my/progress/{slug}", api_my_progress_get, methods=["GET"]),
    Route(
        "/api/my/progress/{slug}/{module_id}",
        api_my_progress_put,
        methods=["PUT"],
    ),
]
