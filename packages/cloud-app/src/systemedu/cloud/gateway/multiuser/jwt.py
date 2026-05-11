"""JWT 创建/校验 (spec 024-A)."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt


JWT_SECRET = os.environ.get(
    "CLOUD_JWT_SECRET",
    "dev-only-cloud-jwt-secret-change-in-production",
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.environ.get("CLOUD_JWT_EXPIRE_DAYS", "30"))


def create_access_token(user_id: str, username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "username": username,
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """返回 payload dict, 失败返回 None."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None
