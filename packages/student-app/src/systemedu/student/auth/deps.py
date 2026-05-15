"""鉴权依赖: 从 request 提 token, 验证 user, 返回 user_id 或 401。"""

from __future__ import annotations

from starlette.requests import Request
from starlette.responses import JSONResponse

from .jwt import decode_token
from ..db import get_user_by_id


def _extract_user_id(request: Request) -> str | None:
    """从 Authorization: Bearer ... 或 ?token=... 取 token, 校验返回 user_id。"""
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


async def require_login(request: Request) -> tuple[str | None, JSONResponse | None]:
    """返回 (user_id, error_response). error_response 非 None 时直接返回。"""
    user_id = _extract_user_id(request)
    if not user_id:
        return None, JSONResponse({"error": "login_required"}, status_code=401)
    user = get_user_by_id(user_id)
    if not user:
        return None, JSONResponse({"error": "user_not_found"}, status_code=401)
    return user_id, None
