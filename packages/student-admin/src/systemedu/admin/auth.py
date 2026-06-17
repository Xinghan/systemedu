"""管理员鉴权: env 固定账号 + JWT cookie。

配置 env (生产 secrets, 不进 git):
  ADMIN_USER / ADMIN_PASSWORD  — 管理员账号
  ADMIN_JWT_SECRET             — 签 cookie token
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

JWT_ALGORITHM = "HS256"
TOKEN_TTL_HOURS = 12

ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
JWT_SECRET = os.environ.get("ADMIN_JWT_SECRET", "dev-only-admin-secret-change-in-prod")

COOKIE_NAME = "admin_session"


def verify_admin(user: str, password: str) -> bool:
    """校验管理员账号密码 (明文比对, 单账号)。ADMIN_PASSWORD 空时一律拒绝。"""
    if not ADMIN_PASSWORD:
        return False
    return user == ADMIN_USER and password == ADMIN_PASSWORD


def issue_token(user: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    return jwt.encode({"sub": user, "exp": int(exp.timestamp())}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> str | None:
    """验签返回 user (sub); 失败返 None。"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
