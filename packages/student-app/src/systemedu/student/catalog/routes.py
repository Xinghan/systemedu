"""/api/my/* — "我的项目" + 学习进度。

GET    /api/my/projects                     — 已 Pull 列表 (并发拉 library 元数据)
POST   /api/my/projects/{slug}               — Pull
DELETE /api/my/projects/{slug}               — 软移除
GET    /api/my/progress/{slug}               — 该 slug 的最后访问 module
PUT    /api/my/progress/{slug}/{module_id}   — 标记最后访问
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import mimetypes
from pathlib import Path

from typing import Any

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
    """cloud 版本 (spec 037): Pull = 只在 DB 记一行关联, 不下载/解压任何文件."""
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
    project, created = upsert_user_project(user_id, slug, library_version=target_version)
    lv = get_last_visited(user_id, slug)
    body = _project_to_dict(project, meta, lv.last_module_id if lv else None)
    body["created"] = created
    return JSONResponse(body, status_code=201 if created else 200)


async def api_my_projects_remove(request: Request) -> JSONResponse:
    """cloud 版本 (spec 037): 软删关联 + 清进度, 不触碰本地文件。"""
    slug = request.path_params["slug"]
    user_id, err = await require_login(request)
    if err:
        return err
    existed = soft_remove_user_project(user_id, slug)
    # cloud 版本: 无本地文件可清; 仅同步清学习进度, 避免"卸载->重新 pull"后
    # 旧 last_module_id 复活。
    delete_last_visited(user_id, slug)
    return JSONResponse({"removed": existed}, status_code=200)


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


def _backfill_section_html_paths(rendered_sections: Any) -> None:
    """spec 033 起的兼容: 把 idea.{mode}_path 回填到 rendered_sections[id].html_path,
    让前端 inlineHtmlPaths() 能找到 HTML 文件。原地修改 dict。

    library /v1 返回 sections.json 原样, 不含 html_path, 所以代理后在这里补。
    """
    if not isinstance(rendered_sections, dict):
        return
    rendered = rendered_sections.get("rendered_sections") or {}
    if not isinstance(rendered, dict):
        return
    for idea in rendered_sections.get("ideas", []) or []:
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


async def api_my_project_knode(request: Request) -> JSONResponse:
    """cloud 版本 (spec 037): 学习时实时代理 library /v1 knode, 不再读本地."""
    slug = request.path_params["slug"]
    knode_id = request.path_params["knode_id"]
    user_id, err = await require_login(request)
    if err:
        return err

    up = get_user_project(user_id, slug)
    if up is None or up.removed_at is not None:
        return JSONResponse({"error": "not_pulled", "slug": slug}, status_code=403)

    try:
        k = await get_library_client().get_knode(slug, knode_id)
    except LibraryNotFound:
        return JSONResponse(
            {"error": "knode_not_found", "knode_id": knode_id}, status_code=404
        )
    except Exception as e:
        return _lib_error_response(e)

    data = copy.deepcopy(k.__dict__)
    _backfill_section_html_paths(data.get("rendered_sections"))
    return JSONResponse(data)


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
