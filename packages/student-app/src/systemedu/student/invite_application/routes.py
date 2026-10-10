"""公开邀请码申请接口。

POST /api/invite-applications  body {phone}

不需要登录：该接口仅幂等保存手机号，既不创建账号也不发短信。管理后台才能读取
申请列表；公开响应不会透露号码是否已经申请。
"""
from __future__ import annotations

import re
import time
from collections import defaultdict, deque

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..db import submit_invite_application


_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")
_MAX_BODY_BYTES = 4096
_RATE_WINDOW_SECONDS = 15 * 60
_RATE_MAX_REQUESTS = 5
_rate_windows: dict[str, deque[float]] = defaultdict(deque)


def _client_key(request: Request) -> str:
    # nginx 追加真实来源 IP；取最后一个避免直接信任客户端伪造的最左侧值。
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.rsplit(",", 1)[-1].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]


def _rate_limited(request: Request) -> bool:
    now = time.monotonic()
    bucket = _rate_windows[_client_key(request)]
    while bucket and now - bucket[0] >= _RATE_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= _RATE_MAX_REQUESTS:
        return True
    bucket.append(now)
    return False


async def api_submit_invite_application(request: Request) -> JSONResponse:
    raw_length = request.headers.get("content-length")
    if raw_length and raw_length.isdigit() and int(raw_length) > _MAX_BODY_BYTES:
        return JSONResponse({"error": "请求内容过大"}, status_code=413)
    if _rate_limited(request):
        return JSONResponse({"error": "提交过于频繁，请稍后再试"}, status_code=429)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "请求格式不正确"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "请求格式不正确"}, status_code=400)
    phone = (body.get("phone") or "").strip()
    if not _PHONE_RE.fullmatch(phone):
        return JSONResponse({"error": "请输入正确的 11 位手机号"}, status_code=400)

    submit_invite_application(phone)
    # 同一个手机号的新旧提交返回同一成功结果，避免公开枚举申请状态。
    return JSONResponse({"ok": True}, status_code=202)


ROUTES = [
    Route("/api/invite-applications", api_submit_invite_application, methods=["POST"]),
]
