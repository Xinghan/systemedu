"""/api/auth/* — 手机号 + 短信验证码 注册/登录 (无密码) + profile 补全。

旧的 username/password register/login 已删除 (spec sms-auth)。流程:
  1. POST /api/auth/send-code  发码 (60s 冷却)
  2. POST /api/auth/verify     校验码登录; 新手机号自动建号
  3. PATCH /api/auth/profile   补全 display_name / student_age / gender
  4. GET  /api/auth/me         返回 phone + profile
  5. POST /api/auth/logout     无状态, 前端清 token 即可
"""

from __future__ import annotations

import re

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..db import (
    create_user_by_phone,
    get_user_by_id,
    get_user_by_phone,
    update_last_login,
    update_profile,
)
from ..sms import codes, send_sms_code
from .deps import require_login
from .jwt import create_access_token

_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")


async def api_send_code(request: Request) -> JSONResponse:
    body = await request.json()
    phone = (body.get("phone") or "").strip()
    if not _PHONE_RE.match(phone):
        return JSONResponse({"error": "手机号格式不正确"}, status_code=400)
    if await codes.in_cooldown(phone):
        return JSONResponse({"error": "发送过于频繁, 请稍后再试"}, status_code=429)
    code = await codes.issue_code(phone)
    if not send_sms_code(phone, code):
        return JSONResponse({"error": "短信发送失败, 请重试"}, status_code=502)
    return JSONResponse({"ok": True, "cooldown_sec": codes.COOLDOWN})


async def api_verify(request: Request) -> JSONResponse:
    body = await request.json()
    phone = (body.get("phone") or "").strip()
    code = (body.get("code") or "").strip()
    if not _PHONE_RE.match(phone) or not code:
        return JSONResponse({"error": "参数错误"}, status_code=400)
    if not await codes.verify_code(phone, code):
        return JSONResponse({"error": "验证码错误或已过期"}, status_code=401)

    user = get_user_by_phone(phone)
    if user is None:
        user = create_user_by_phone(phone)
    else:
        update_last_login(user.id)
    token = create_access_token(user.id, user.display_name or phone)
    return JSONResponse({
        "token": token,
        "user_id": user.id,
        "profile_completed": bool(user.profile_completed),
    })


async def api_profile(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    body = await request.json()
    display_name = (body.get("display_name") or "").strip()
    gender = (body.get("gender") or "").strip()
    try:
        student_age = int(body.get("student_age"))
    except (TypeError, ValueError):
        return JSONResponse({"error": "学生年龄必须是数字"}, status_code=400)
    if not (1 <= len(display_name) <= 32):
        return JSONResponse({"error": "用户名长度 1-32"}, status_code=400)
    if not (3 <= student_age <= 25):
        return JSONResponse({"error": "学生年龄不合理"}, status_code=400)
    if gender not in ("male", "female", "other"):
        return JSONResponse({"error": "性别取值错误"}, status_code=400)
    update_profile(
        user_id, display_name=display_name, student_age=student_age, gender=gender
    )
    return JSONResponse({"ok": True, "profile_completed": True})


async def api_me(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    user = get_user_by_id(user_id)
    assert user is not None
    return JSONResponse({
        "user_id": user.id,
        "phone": user.phone,
        "display_name": user.display_name,
        "student_age": user.student_age,
        "gender": user.gender,
        "profile_completed": bool(user.profile_completed),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    })


async def api_logout(request: Request) -> JSONResponse:
    return JSONResponse({"ok": True})


ROUTES = [
    Route("/api/auth/send-code", api_send_code, methods=["POST"]),
    Route("/api/auth/verify", api_verify, methods=["POST"]),
    Route("/api/auth/profile", api_profile, methods=["PATCH"]),
    Route("/api/auth/me", api_me, methods=["GET"]),
    Route("/api/auth/logout", api_logout, methods=["POST"]),
]
