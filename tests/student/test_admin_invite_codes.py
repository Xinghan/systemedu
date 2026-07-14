"""spec 047 — 管理端邀请码视图 GET /api/admin/invite-codes。

鉴权反查 library /admin/auth/me 经 monkeypatch mock (asgi 测试不起 library)。
"""
from __future__ import annotations

import importlib

import fakeredis.aioredis
import pytest

from systemedu.student import cache
from systemedu.student.admin import routes as admin_routes
from systemedu.student.db import create_invite_codes, create_user_by_phone_with_invite
from systemedu.student.sms import aliyun


@pytest.fixture(autouse=True)
def _redis():
    cache.replace_client_for_tests(fakeredis.aioredis.FakeRedis())
    yield


@pytest.fixture(autouse=True)
def _sms_debug(monkeypatch):
    monkeypatch.setenv("ALIYUN_SMS_DEBUG", "true")
    importlib.reload(aliyun)
    yield


@pytest.fixture
def admin_ok(monkeypatch):
    async def _yes(token: str) -> bool:
        return token == "good-admin-token"
    monkeypatch.setattr(admin_routes, "verify_library_admin_token", _yes)
    yield


async def test_no_token_401(asgi_client):
    r = await asgi_client.get("/api/admin/invite-codes")
    assert r.status_code == 401


async def test_bad_token_401(asgi_client, admin_ok):
    r = await asgi_client.get(
        "/api/admin/invite-codes", headers={"Authorization": "Bearer wrong"}
    )
    assert r.status_code == 401


async def test_list_with_user_join(asgi_client, admin_ok):
    create_invite_codes(["ADMVIEW1", "ADMVIEW2"], batch="ut-047")
    user = create_user_by_phone_with_invite("13900020001", "ADMVIEW1")
    assert user is not None

    r = await asgi_client.get(
        "/api/admin/invite-codes", headers={"Authorization": "Bearer good-admin-token"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["stats"]["total"] >= 2
    by_code = {c["code"]: c for c in body["codes"]}
    used = by_code["ADMVIEW1"]
    assert used["user"]["phone"] == "13900020001"
    assert used["used_at"] is not None
    assert used["batch"] == "ut-047"
    assert by_code["ADMVIEW2"]["user"] is None
