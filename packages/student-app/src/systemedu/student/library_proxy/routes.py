"""/api/library/* — 代理 library-app:18821。

公开 (无需登录): list / get / tree / blueprint
需登录 + 已 Pull: knodes / files
"""

from __future__ import annotations

import logging
import mimetypes
import os

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
from .client import get_library_client


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
    license_token = os.environ.get(
        "LIBRARY_LICENSE_TOKEN", "dev-only-license-token-change-me"
    )
    base_url = os.environ.get("LIBRARY_BASE_URL") or os.environ.get(
        "LIBRARY_URL", "http://127.0.0.1:18821"
    )
    trust_env = "127.0.0.1" not in base_url and "localhost" not in base_url

    async def _stream():
        async with httpx.AsyncClient(timeout=60.0, trust_env=trust_env) as client:
            async with client.stream(
                "GET", url, headers={"Authorization": f"Bearer {license_token}"}
            ) as r:
                if r.status_code != 200:
                    return
                async for chunk in r.aiter_bytes():
                    yield chunk

    ct, _ = mimetypes.guess_type(file_path)
    if not ct:
        ct = "application/octet-stream"
    return StreamingResponse(_stream(), media_type=ct)


ROUTES = [
    Route("/api/library/projects", api_library_list, methods=["GET"]),
    Route("/api/library/projects/{slug}", api_library_get, methods=["GET"]),
    Route("/api/library/projects/{slug}/tree", api_library_tree, methods=["GET"]),
    Route(
        "/api/library/projects/{slug}/blueprint", api_library_blueprint, methods=["GET"]
    ),
    Route(
        "/api/library/projects/{slug}/knodes/{knode_id}",
        api_library_knode,
        methods=["GET"],
    ),
    Route(
        "/api/library/projects/{slug}/files/{path:path}",
        api_library_file,
        methods=["GET"],
    ),
]
