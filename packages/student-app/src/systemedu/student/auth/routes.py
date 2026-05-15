"""/api/auth/* — 注册 / 登录 / me / logout。

复制自 cloud-app/multiuser/endpoints.py 的 auth 部分, 但走新 student.db。
"""

from __future__ import annotations

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..db import (
    create_user,
    get_user_by_id,
    get_user_by_username,
    update_last_login,
)
from .jwt import create_access_token
from .passwords import hash_password, verify_password
from .deps import require_login


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
    user_id, err = await require_login(request)
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
    return JSONResponse({"ok": True})


ROUTES = [
    Route("/api/auth/register", api_register, methods=["POST"]),
    Route("/api/auth/login", api_login, methods=["POST"]),
    Route("/api/auth/logout", api_logout, methods=["POST"]),
    Route("/api/auth/me", api_me, methods=["GET"]),
]
