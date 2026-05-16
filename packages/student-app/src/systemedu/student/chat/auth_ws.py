"""spec 028 P1.7: WebSocket 鉴权.

浏览器不能给 WS 加自定义 header, 走 ?token=xxx query string.
"""

from __future__ import annotations

from starlette.websockets import WebSocket

from ..auth.jwt import decode_token
from ..db import get_user_by_id


async def authenticate_ws(websocket: WebSocket) -> str | None:
    """Returns user_id on success, None on failure."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = get_user_by_id(user_id)
    if user is None:
        return None
    return user_id
