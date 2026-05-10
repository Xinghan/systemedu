"""Auth: JWT + bcrypt (spec 023 MVP).

- AdminUser 登录: POST /admin/auth/login → 返回 JWT
- 所有 /admin/* API 需要 JWT (从 Authorization: Bearer 头解析)
- 所有 /v1/* API 需要 license token (shared secret)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from .models import AdminUser, get_session
from .settings import JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET, LICENSE_TOKEN

# bcrypt password hashing
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(admin_id: str, username: str, role: str) -> str:
    """颁发 admin JWT."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": admin_id,
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

_admin_bearer = HTTPBearer(auto_error=False)


def require_admin(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_admin_bearer)],
) -> AdminUser:
    """Dependency: 解析 Authorization 头, 返回当前 AdminUser."""
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    payload = decode_access_token(creds.credentials)
    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    db = get_session()
    try:
        user = db.query(AdminUser).filter_by(id=admin_id).first()
    finally:
        db.close()
    if user is None or user.status.value != "active":
        raise HTTPException(status_code=401, detail="Admin user not found or disabled")
    return user


_license_bearer = HTTPBearer(auto_error=False)


def require_license(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_license_bearer)],
) -> str:
    """Dependency: 验证 license token (cloud-app service-to-service)."""
    if creds is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    if creds.credentials != LICENSE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid license token")
    return creds.credentials


# ---------------------------------------------------------------------------
# Bootstrap super_admin (启动时如果没 admin, 用 env var LIBRARY_BOOTSTRAP_ADMIN 创建)
# ---------------------------------------------------------------------------

def maybe_bootstrap_admin() -> str | None:
    """如果库里没 admin 且 env 里设了 LIBRARY_BOOTSTRAP_ADMIN=user:pass, 创建.

    Returns:
        创建的用户名 (如果创建了), 否则 None
    """
    from .models import AdminRole, AdminUser, get_session
    from .settings import BOOTSTRAP_ADMIN

    if not BOOTSTRAP_ADMIN:
        return None

    if ":" not in BOOTSTRAP_ADMIN:
        raise ValueError("LIBRARY_BOOTSTRAP_ADMIN must be 'username:password'")

    username, password = BOOTSTRAP_ADMIN.split(":", 1)

    db = get_session()
    try:
        existing = db.query(AdminUser).filter_by(username=username).first()
        if existing:
            return None  # 已存在, 不重复创建
        # 检查库里是否完全为空
        any_admin = db.query(AdminUser).first()
        if any_admin:
            # 已有其他 admin, 不再用 bootstrap (避免误覆盖)
            return None

        user = AdminUser(
            username=username,
            password_hash=hash_password(password),
            role=AdminRole.super_admin,
        )
        db.add(user)
        db.commit()
        return username
    finally:
        db.close()
