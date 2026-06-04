"""/api/library/* — 代理 library-app:18821。

公开 (无需登录): list / get / tree / blueprint
需登录 + 已 Pull: knodes / files
"""

from __future__ import annotations

import logging

import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from systemedu.core.library_client import (
    LibraryError,
    LibraryNotFound,
    LibraryUnauthorized,
)

from ..auth.deps import require_login
from ..db import user_has_pulled
from .client import get_library_client, library_request_env
from .stream import stream_library_file


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


async def api_library_list(request: Request) -> JSONResponse:
    try:
        projects = await get_library_client().list_projects()
        return JSONResponse([p.__dict__ for p in projects])
    except Exception as e:
        return _lib_error_response(e)


async def api_library_get(request: Request) -> JSONResponse:
    slug = request.path_params["slug"]
    try:
        p = await get_library_client().get_project(slug)
        return JSONResponse(p.__dict__)
    except Exception as e:
        return _lib_error_response(e)


async def api_library_tree(request: Request) -> JSONResponse:
    slug = request.path_params["slug"]
    try:
        tree = await get_library_client().get_tree(slug)
        return JSONResponse(tree)
    except Exception as e:
        return _lib_error_response(e)


async def api_library_project_knowledge_tree(request: Request) -> JSONResponse:
    """spec 035: 本项目知识点亮 (lit_nodes + subjects_used + missing_concepts)."""
    slug = request.path_params["slug"]
    try:
        data = await get_library_client().get_project_knowledge_tree(slug)
        return JSONResponse(data)
    except Exception as e:
        return _lib_error_response(e)


_PLATFORM_TREE_CACHE: dict | None = None


async def api_library_platform_knowledge_tree(request: Request) -> JSONResponse:
    """spec 035: 全平台学科理论知识树 (缓存模块级单例, 内容静态)."""
    global _PLATFORM_TREE_CACHE
    if _PLATFORM_TREE_CACHE is None:
        try:
            _PLATFORM_TREE_CACHE = await get_library_client().get_platform_knowledge_tree()
        except Exception as e:
            return _lib_error_response(e)
    return JSONResponse(_PLATFORM_TREE_CACHE)


async def api_library_blueprint(request: Request) -> JSONResponse:
    slug = request.path_params["slug"]
    lang = request.query_params.get("lang", "zh-CN")
    try:
        bp = await get_library_client().get_blueprint(slug, lang=lang)
        return JSONResponse(bp)
    except Exception as e:
        return _lib_error_response(e)


async def api_library_knode(request: Request) -> JSONResponse:
    """需登录 + 已 Pull。"""
    slug = request.path_params["slug"]
    knode_id = request.path_params["knode_id"]
    user_id, err = await require_login(request)
    if err:
        return err
    if not user_has_pulled(user_id, slug):
        return JSONResponse(
            {"error": "pull_required", "slug": slug}, status_code=403
        )
    try:
        k = await get_library_client().get_knode(slug, knode_id)
        return JSONResponse(k.__dict__)
    except Exception as e:
        return _lib_error_response(e)


async def api_library_cover(request: Request):
    """公开 (无需登录/Pull). 流式透传项目封面图.

    封面图是项目橱窗资源, 列表页/详情页未登录也要能看, 所以不走 file 端点的
    登录+Pull 鉴权。直连 library 的 /cover 端点 — 该端点对 draft 也放行, 所以
    草稿项目 (status=draft) 的封面在 library 也能正常展示 (前端只加「草稿」徽章)。
    """
    slug = request.path_params["slug"]

    url = get_library_client().get_cover_url(slug)
    _, license_token, trust_env = library_request_env()

    # 先发一个 HEAD-like 请求拿到 content-type + 确认 200 (draft 也放行)。
    # library /cover 端点用 FileResponse, content-type 已按文件后缀正确设置。
    content_type = "image/png"
    try:
        async with httpx.AsyncClient(timeout=60.0, trust_env=trust_env) as client:
            probe = await client.get(
                url, headers={"Authorization": f"Bearer {license_token}"}
            )
            if probe.status_code != 200:
                return JSONResponse(
                    {"error": "no_cover", "slug": slug}, status_code=404
                )
            content_type = probe.headers.get("content-type") or "image/png"
            body = probe.content
    except Exception as e:
        return _lib_error_response(e)

    async def _stream():
        yield body

    return StreamingResponse(
        _stream(),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


async def api_library_file(request: Request):
    """需登录 + 已 Pull. 流式透传媒体文件 (anim html / 图片 / 音频)."""
    slug = request.path_params["slug"]
    file_path = request.path_params["path"]
    user_id, err = await require_login(request)
    if err:
        return err
    if not user_has_pulled(user_id, slug):
        return JSONResponse(
            {"error": "pull_required", "slug": slug}, status_code=403
        )

    url = get_library_client().get_file_url(slug, file_path)
    return await stream_library_file(url, file_path)


ROUTES = [
    Route("/api/library/projects", api_library_list, methods=["GET"]),
    Route("/api/library/projects/{slug}", api_library_get, methods=["GET"]),
    Route("/api/library/projects/{slug}/tree", api_library_tree, methods=["GET"]),
    Route(
        "/api/library/projects/{slug}/knowledge-tree",
        api_library_project_knowledge_tree,
        methods=["GET"],
    ),
    Route(
        "/api/library/platform/knowledge-tree",
        api_library_platform_knowledge_tree,
        methods=["GET"],
    ),
    Route(
        "/api/library/projects/{slug}/blueprint", api_library_blueprint, methods=["GET"]
    ),
    Route(
        "/api/library/projects/{slug}/knodes/{knode_id}",
        api_library_knode,
        methods=["GET"],
    ),
    Route(
        "/api/library/projects/{slug}/cover",
        api_library_cover,
        methods=["GET"],
    ),
    Route(
        "/api/library/projects/{slug}/files/{path:path}",
        api_library_file,
        methods=["GET"],
    ),
]
