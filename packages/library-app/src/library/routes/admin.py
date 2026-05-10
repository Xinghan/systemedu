"""Admin API routes.

P1 占位 + auth 路由实质实现; P2 实质实现 list/import/publish 等.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import (
    create_access_token,
    require_admin,
    verify_password,
)
from ..models import AdminUser, get_session

# ---------------------------------------------------------------------------
# Auth router (/admin/auth/*)
# ---------------------------------------------------------------------------

auth_router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    role: str
    expires_at_unix: int


@auth_router.post("/login", response_model=LoginResponse)
def admin_login(req: LoginRequest) -> LoginResponse:
    db = get_session()
    try:
        user = db.query(AdminUser).filter_by(username=req.username).first()
        if user is None or user.status.value != "active":
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # commit 前把要返回的字段拷出来 (commit 后 instance detached)
        user_id = user.id
        username = user.username
        role = user.role.value

        token = create_access_token(user_id, username, role)
        user.last_login_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()

    from ..settings import JWT_EXPIRE_HOURS

    expires_at = int(datetime.now(timezone.utc).timestamp()) + JWT_EXPIRE_HOURS * 3600
    return LoginResponse(
        token=token,
        username=username,
        role=role,
        expires_at_unix=expires_at,
    )


@auth_router.get("/me")
def admin_me(admin: AdminUser = Depends(require_admin)) -> dict:
    return {
        "id": admin.id,
        "username": admin.username,
        "role": admin.role.value,
        "status": admin.status.value,
    }


@auth_router.post("/logout")
def admin_logout(admin: AdminUser = Depends(require_admin)) -> dict:
    """JWT 是无状态的, 这里只是接口存根 (前端清掉本地 token 即可); 后期可加 blocklist."""
    return {"status": "logged out"}


# ---------------------------------------------------------------------------
# Admin business router (/admin/*)
# ---------------------------------------------------------------------------

router = APIRouter()


@router.get("/projects")
def admin_list_projects(_admin: AdminUser = Depends(require_admin)) -> list[dict]:
    """列出所有项目 (含 draft) — P2 实现."""
    return []
