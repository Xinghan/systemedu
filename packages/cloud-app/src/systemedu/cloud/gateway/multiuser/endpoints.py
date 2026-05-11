"""spec 024-A HTTP endpoints (auth + library proxy + purchases).

注册 + 登录 + me + logout    /api/auth/*
library 内容代理              /api/library/*    (knode 详情需登录+购买)
购买                         /api/purchases/*

调用方在 server.py 里:
    from systemedu.cloud.gateway.multiuser.endpoints import register_routes
    routes += register_routes()
"""

from __future__ import annotations

import logging
import os
from datetime import datetime

import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from systemedu.core.library_client import (
    AsyncLibraryClient,
    LibraryError,
    LibraryNotFound,
    LibraryUnauthorized,
)

from .db import (
    create_purchase,
    create_user,
    get_user_by_id,
    get_user_by_username,
    list_purchases,
    update_last_login,
    user_has_purchased,
)
from .jwt import create_access_token, decode_token
from .passwords import hash_password, verify_password


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# library client (singleton)
# ---------------------------------------------------------------------------

_library_client: AsyncLibraryClient | None = None


def get_library_client() -> AsyncLibraryClient:
    global _library_client
    if _library_client is None:
        base_url = os.environ.get("LIBRARY_URL", "http://127.0.0.1:18821")
        token = os.environ.get(
            "LIBRARY_LICENSE_TOKEN", "dev-only-license-token-change-me"
        )
        _library_client = AsyncLibraryClient(base_url, token)
    return _library_client


# ---------------------------------------------------------------------------
# 鉴权辅助
# ---------------------------------------------------------------------------

def _extract_user_id(request: Request) -> str | None:
    """从 Authorization: Bearer ... 或 ?token=... 取 token, 校验返回 user_id."""
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.query_params.get("token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    return payload.get("sub")


async def _require_login(request: Request) -> tuple[str | None, JSONResponse | None]:
    """返回 (user_id, error_response). error_response 非 None 时直接返回."""
    user_id = _extract_user_id(request)
    if not user_id:
        return None, JSONResponse({"error": "login_required"}, status_code=401)
    user = get_user_by_id(user_id)
    if not user:
        return None, JSONResponse({"error": "user_not_found"}, status_code=401)
    return user_id, None


# ---------------------------------------------------------------------------
# /api/auth/*
# ---------------------------------------------------------------------------

_MIN_USERNAME = 3
_MAX_USERNAME = 32
_MIN_PASSWORD = 6


async def api_register(request: Request) -> JSONResponse:
    body = await request.json()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not (_MIN_USERNAME <= len(username) <= _MAX_USERNAME):
        return JSONResponse(
            {"error": f"username 长度必须 {_MIN_USERNAME}-{_MAX_USERNAME}"},
            status_code=400,
        )
    if not username.replace("_", "").replace("-", "").replace(".", "").isalnum():
        return JSONResponse(
            {"error": "username 只能包含字母/数字/下划线/连字符/点"},
            status_code=400,
        )
    if len(password) < _MIN_PASSWORD:
        return JSONResponse(
            {"error": f"密码至少 {_MIN_PASSWORD} 位"}, status_code=400
        )

    if get_user_by_username(username):
        return JSONResponse({"error": "用户名已存在"}, status_code=409)

    user = create_user(username, hash_password(password))
    token = create_access_token(user.id, user.username)
    return JSONResponse({
        "token": token,
        "username": user.username,
        "user_id": user.id,
    })


async def api_login(request: Request) -> JSONResponse:
    body = await request.json()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    if not username or not password:
        return JSONResponse({"error": "缺少 username 或 password"}, status_code=400)

    user = get_user_by_username(username)
    if not user or not verify_password(password, user.password_hash):
        return JSONResponse({"error": "用户名或密码错误"}, status_code=401)

    update_last_login(user.id)
    token = create_access_token(user.id, user.username)
    return JSONResponse({
        "token": token,
        "username": user.username,
        "user_id": user.id,
    })


async def api_me(request: Request) -> JSONResponse:
    user_id, err = await _require_login(request)
    if err:
        return err
    user = get_user_by_id(user_id)
    assert user is not None
    return JSONResponse({
        "user_id": user.id,
        "username": user.username,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    })


async def api_logout(request: Request) -> JSONResponse:
    # JWT 无状态, 这里只是个 placeholder; 客户端清 token 即可.
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# /api/library/*  (proxy to library service)
# ---------------------------------------------------------------------------

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
    """需登录 + 购买."""
    slug = request.path_params["slug"]
    knode_id = request.path_params["knode_id"]
    user_id, err = await _require_login(request)
    if err:
        return err
    if not user_has_purchased(user_id, slug):
        return JSONResponse(
            {"error": "purchase_required", "slug": slug}, status_code=403
        )
    try:
        k = await get_library_client().get_knode(slug, knode_id)
        return JSONResponse(k.__dict__)
    except Exception as e:
        return _lib_error_response(e)


async def api_library_file(request: Request):
    """需登录 + 购买. 流式透传媒体文件 (anim html / 图片 / 音频)."""
    slug = request.path_params["slug"]
    file_path = request.path_params["path"]
    user_id, err = await _require_login(request)
    if err:
        return err
    if not user_has_purchased(user_id, slug):
        return JSONResponse(
            {"error": "purchase_required", "slug": slug}, status_code=403
        )
    # 从 library 拉取 (用 LibraryClient 内置 token), 流式返回
    url = get_library_client().get_file_url(slug, file_path)
    license_token = os.environ.get(
        "LIBRARY_LICENSE_TOKEN", "dev-only-license-token-change-me"
    )
    base_url = os.environ.get("LIBRARY_URL", "http://127.0.0.1:18821")
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

    # 先单独 HEAD 拿 content-type? 用 GET 流式更简单. fallback 通用类型.
    # 根据扩展名猜:
    import mimetypes
    ct, _ = mimetypes.guess_type(file_path)
    if not ct:
        ct = "application/octet-stream"
    return StreamingResponse(_stream(), media_type=ct)


# ---------------------------------------------------------------------------
# /api/purchases/*
# ---------------------------------------------------------------------------

async def api_purchases_list(request: Request) -> JSONResponse:
    user_id, err = await _require_login(request)
    if err:
        return err
    purchases = list_purchases(user_id)
    return JSONResponse([
        {
            "project_slug": p.project_slug,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in purchases
    ])


async def api_purchases_buy(request: Request) -> JSONResponse:
    """免支付解锁."""
    slug = request.path_params["slug"]
    user_id, err = await _require_login(request)
    if err:
        return err
    # 验证项目确实存在
    try:
        await get_library_client().get_project(slug)
    except LibraryNotFound:
        return JSONResponse({"error": "project_not_found"}, status_code=404)
    except Exception as e:
        return _lib_error_response(e)

    p = create_purchase(user_id, slug)
    return JSONResponse({
        "purchased": True,
        "project_slug": slug,
        "already_owned": p is None,
    })


# ---------------------------------------------------------------------------
# Routes 注册
# ---------------------------------------------------------------------------

def register_routes() -> list[Route]:
    return [
        # auth
        Route("/api/auth/register", api_register, methods=["POST"]),
        Route("/api/auth/login", api_login, methods=["POST"]),
        Route("/api/auth/logout", api_logout, methods=["POST"]),
        Route("/api/auth/me", api_me, methods=["GET"]),

        # library 公开
        Route("/api/library/projects", api_library_list, methods=["GET"]),
        Route("/api/library/projects/{slug}", api_library_get, methods=["GET"]),
        Route("/api/library/projects/{slug}/tree", api_library_tree, methods=["GET"]),
        Route("/api/library/projects/{slug}/blueprint", api_library_blueprint, methods=["GET"]),

        # library 需购买
        Route("/api/library/projects/{slug}/knodes/{knode_id}", api_library_knode, methods=["GET"]),
        Route("/api/library/projects/{slug}/files/{path:path}", api_library_file, methods=["GET"]),

        # purchases
        Route("/api/purchases", api_purchases_list, methods=["GET"]),
        Route("/api/purchases/{slug}", api_purchases_buy, methods=["POST"]),
    ]
