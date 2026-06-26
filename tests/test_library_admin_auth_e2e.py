"""library admin 认证与全 /admin/* 端点鉴权强制 (工单 T1, category D-auth-boundary).

范式照搬 tests/test_library_knowledge_tree_api.py:
- in-process FastAPI TestClient + monkeypatch DB_PATH/LICENSE_TOKEN/PROJECTS_MEDIA_DIR
- reset library.models._engine 全局单例

覆盖:
- admin_login: 正确凭据 / 密码错 / 用户不存在 / status!=active 四路
- GET /admin/auth/me: 无 token 401, 有效 token 返回 id/username/role/status
- 业务 router (require_admin): import / publish / projects / stats 无 token 一律 401
- Bearer 非法 token → 401

真实行为依据 (packages/library-app/src/library):
- routes/admin.py admin_login: 用户不存在 / status!=active / 密码错 都 → 401 "Invalid credentials"
- auth.py require_admin: creds is None → 401 "Missing Bearer token";
  非法 token (bearer scheme) → decode_access_token 抛 401 "Invalid token: ..."
- main.py: auth_router 挂 /admin/auth, 业务 router 挂 /admin (整 router Depends(require_admin))
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


# 测试用固定凭据
_ADMIN_USER = "t1admin"
_ADMIN_PW = "t1-secret-pw"
_DISABLED_USER = "t1disabled"
_DISABLED_PW = "disabled-pw"


@pytest.fixture
def client(monkeypatch, tmp_path):
    """library FastAPI app + 独立 sqlite file 每个测试.

    library.models 的 _engine 是全局单例 — 必须 patch + reset.
    """
    db_file = tmp_path / "test_library.db"
    media_dir = tmp_path / "media"
    media_dir.mkdir()

    import library.settings as s
    monkeypatch.setattr(s, "DB_PATH", db_file, raising=False)
    monkeypatch.setattr(s, "LIBRARY_HOME", tmp_path, raising=False)
    monkeypatch.setattr(s, "LICENSE_TOKEN", "test-license", raising=False)
    monkeypatch.setattr(s, "PROJECTS_MEDIA_DIR", media_dir, raising=False)

    import library.models as m
    # reset 全局 engine 让新 DB_PATH 生效
    monkeypatch.setattr(m, "_engine", None, raising=False)
    monkeypatch.setattr(m, "_SessionLocal", None, raising=False)

    # auth.py 模块缓存了 LICENSE_TOKEN; reset 它 (本工单不测 license, 仍对齐范式)
    import library.auth as auth_mod
    monkeypatch.setattr(auth_mod, "LICENSE_TOKEN", "test-license", raising=False)

    m.init_db()

    # 直接建 AdminUser (一个 active + 一个 disabled), 不依赖 bootstrap env
    from library.auth import hash_password
    from library.models import AdminRole, AdminStatus, AdminUser, get_session

    db = get_session()
    try:
        db.add(
            AdminUser(
                username=_ADMIN_USER,
                password_hash=hash_password(_ADMIN_PW),
                role=AdminRole.super_admin,
                status=AdminStatus.active,
            )
        )
        db.add(
            AdminUser(
                username=_DISABLED_USER,
                password_hash=hash_password(_DISABLED_PW),
                role=AdminRole.editor,
                status=AdminStatus.disabled,
            )
        )
        db.commit()
    finally:
        db.close()

    import library.main as main
    return TestClient(main.app)


def _login(client: TestClient, username: str, password: str):
    return client.post(
        "/admin/auth/login",
        json={"username": username, "password": password},
    )


def _valid_token(client: TestClient) -> str:
    r = _login(client, _ADMIN_USER, _ADMIN_PW)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------------------------------------------------------------------------
# admin_login
# ---------------------------------------------------------------------------

def test_admin_login_success(client):
    """正确凭据 → 200 + token + role + username + expires_at_unix."""
    r = _login(client, _ADMIN_USER, _ADMIN_PW)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data["token"], str) and data["token"]
    assert data["username"] == _ADMIN_USER
    assert data["role"] == "super_admin"
    assert isinstance(data["expires_at_unix"], int)
    # expires 必须在未来 (JWT_EXPIRE_HOURS 默认 24h)
    import time
    assert data["expires_at_unix"] > int(time.time())


def test_admin_login_wrong_password(client):
    """密码错 → 401 Invalid credentials."""
    r = _login(client, _ADMIN_USER, "totally-wrong-pw")
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"


def test_admin_login_user_not_found(client):
    """用户不存在 → 401 Invalid credentials."""
    r = _login(client, "no-such-admin", "whatever")
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"


def test_admin_login_disabled_user(client):
    """status!=active 的用户 (即使密码对) → 401 Invalid credentials."""
    r = _login(client, _DISABLED_USER, _DISABLED_PW)
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"


# ---------------------------------------------------------------------------
# GET /admin/auth/me
# ---------------------------------------------------------------------------

def test_admin_me_no_token(client):
    """无 token → 401."""
    r = client.get("/admin/auth/me")
    assert r.status_code == 401
    assert r.json()["detail"] == "Missing Bearer token"


def test_admin_me_valid_token(client):
    """有效 token → 返回 id/username/role/status."""
    token = _valid_token(client)
    r = client.get("/admin/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert set(data.keys()) >= {"id", "username", "role", "status"}
    assert data["username"] == _ADMIN_USER
    assert data["role"] == "super_admin"
    assert data["status"] == "active"
    assert isinstance(data["id"], str) and data["id"]


# ---------------------------------------------------------------------------
# 业务 router (/admin/*, 整 router Depends(require_admin))
# ---------------------------------------------------------------------------

def test_admin_import_no_auth(client):
    """POST /admin/projects/import 无 Authorization → 401 (在 body 校验之前就拦)."""
    r = client.post("/admin/projects/import")
    assert r.status_code == 401
    assert r.json()["detail"] == "Missing Bearer token"


def test_admin_publish_no_token(client):
    """POST /admin/projects/{slug}/publish 无 token → 401."""
    r = client.post("/admin/projects/some-slug/publish")
    assert r.status_code == 401
    assert r.json()["detail"] == "Missing Bearer token"


def test_admin_list_projects_no_token(client):
    """GET /admin/projects 无 token → 401."""
    r = client.get("/admin/projects")
    assert r.status_code == 401
    assert r.json()["detail"] == "Missing Bearer token"


def test_admin_stats_no_token(client):
    """GET /admin/stats 无 token → 401."""
    r = client.get("/admin/stats")
    assert r.status_code == 401
    assert r.json()["detail"] == "Missing Bearer token"


# ---------------------------------------------------------------------------
# 非法 token
# ---------------------------------------------------------------------------

def test_admin_me_invalid_bearer_token(client):
    """Bearer 非法 token → 401 (decode 失败)."""
    r = client.get(
        "/admin/auth/me",
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert r.status_code == 401
    assert "Invalid token" in r.json()["detail"]


def test_admin_business_invalid_bearer_token(client):
    """业务端点 Bearer 非法 token → 401 (decode 失败)."""
    r = client.get(
        "/admin/projects",
        headers={"Authorization": "Bearer garbage.token.value"},
    )
    assert r.status_code == 401
    assert "Invalid token" in r.json()["detail"]
