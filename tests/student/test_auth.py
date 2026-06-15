"""auth 测试 — 手机号 + 短信验证码 流程下的 /api/auth/{me,logout}。

旧的 username/password register/login 已删 (spec sms-auth), 这里只覆盖:
  - me 携带/缺失/非法 token
  - logout 无状态
  - 旧 register/login 端点确已移除
完整的 send-code/verify/profile 流程见 test_sms_auth.py。

asgi_client 是进程内 ASGITransport (httpx AsyncClient, async)，与测试同进程,
故路由内部 cache.get_cache() 命中下方 autouse 注入的同一 fakeredis 单例。
"""
from __future__ import annotations

import importlib

import fakeredis.aioredis
import pytest

from systemedu.student import cache
from systemedu.student.sms import aliyun


@pytest.fixture(autouse=True)
def _redis():
    cache.replace_client_for_tests(fakeredis.aioredis.FakeRedis())
    yield


@pytest.fixture(autouse=True)
def _sms_debug(monkeypatch):
    monkeypatch.setenv("ALIYUN_SMS_DEBUG", "true")  # 绝不真发短信
    importlib.reload(aliyun)
    yield


async def _login(asgi_client, phone="13800138200") -> str:
    """手机号 + 验证码登录 (新号自动建), 返回 token。"""
    await asgi_client.post("/api/auth/send-code", json={"phone": phone})
    code = (await cache.get_cache().get(f"sms:code:{phone}")).decode()
    r = await asgi_client.post("/api/auth/verify", json={"phone": phone, "code": code})
    return r.json()["token"]


async def test_me_with_token(asgi_client):
    token = await _login(asgi_client, "13800138201")
    r = await asgi_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["phone"] == "13800138201"
    assert body["profile_completed"] is False


async def test_me_no_token(asgi_client):
    r = await asgi_client.get("/api/auth/me")
    assert r.status_code == 401


async def test_me_garbage_token(asgi_client):
    r = await asgi_client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


async def test_logout(asgi_client):
    r = await asgi_client.post("/api/auth/logout")
    assert r.status_code == 200
    assert r.json()["ok"] is True


async def test_old_register_removed(asgi_client):
    r = await asgi_client.post(
        "/api/auth/register", json={"username": "alice", "password": "passw0rd"}
    )
    assert r.status_code in (404, 405)


async def test_old_login_removed(asgi_client):
    r = await asgi_client.post(
        "/api/auth/login", json={"username": "alice", "password": "passw0rd"}
    )
    assert r.status_code in (404, 405)
