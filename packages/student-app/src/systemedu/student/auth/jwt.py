"""JWT 创建/校验 (复制自 cloud-app/multiuser/jwt.py, 改 env 命名空间)."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt


JWT_SECRET = os.environ.get(
    "STUDENT_JWT_SECRET",
    # 兜底: 兼容老 cloud-app 同环境
    os.environ.get(
        "CLOUD_JWT_SECRET",
        "dev-only-student-jwt-secret-change-in-production",
    ),
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.environ.get("STUDENT_JWT_EXPIRE_DAYS", "30"))


def create_access_token(user_id: str, username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "username": username,
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None
