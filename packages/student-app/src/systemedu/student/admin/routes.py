"""/api/admin/* — 管理端只读视图 (spec 047)。

鉴权复用 library-app 的 admin JWT: 请求带 Bearer token, 本服务反向调
library-app GET /admin/auth/me 验证 (student-app 与 library-app 走 HTTP,
不共享 JWT secret)。验证函数模块级, 测试可 monkeypatch。
"""

from __future__ import annotations

import logging
import os

import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..db import list_invite_codes_with_users

logger = logging.getLogger(__name__)


async def verify_library_admin_token(token: str) -> bool:
    """反查 library-app /admin/auth/me 验证 admin JWT。失败/超时一律 False。"""
    base = os.environ.get("LIBRARY_BASE_URL") or "http://127.0.0.1:18821"
    try:
        async with httpx.AsyncClient(timeout=5.0, trust_env=False) as client:
            r = await client.get(
                f"{base}/admin/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            return r.status_code == 200
    except Exception as e:
        logger.warning("library admin token verify failed: %s", e)
        return False


async def _require_admin(request: Request) -> JSONResponse | None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse({"error": "需要管理员登录"}, status_code=401)
    token = auth[7:].strip()
    if not token or not await verify_library_admin_token(token):
        return JSONResponse({"error": "管理员凭证无效"}, status_code=401)
    return None


async def api_admin_invite_codes(request: Request) -> JSONResponse:
    err = await _require_admin(request)
    if err:
        return err
    codes = list_invite_codes_with_users()
    used = sum(1 for c in codes if c["user"])
    return JSONResponse({
        "stats": {"total": len(codes), "used": used, "unused": len(codes) - used},
        "codes": codes,
    })


ROUTES = [
    Route("/api/admin/invite-codes", api_admin_invite_codes, methods=["GET"]),
]
