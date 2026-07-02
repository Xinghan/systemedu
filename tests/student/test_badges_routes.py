"""spec 042: GET /api/my/badges 路由测试."""
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


async def _login(asgi_client, phone="13800138301") -> tuple[str, str]:
    """手机号 + 验证码登录 (新号自动建), 返回 (token, user_id)。"""
    await asgi_client.post("/api/auth/send-code", json={"phone": phone})
    code = (await cache.get_cache().get(f"sms:code:{phone}")).decode()
    r = await asgi_client.post("/api/auth/verify", json={"phone": phone, "code": code})
    body = r.json()
    return body["token"], body["user_id"]


async def test_badges_wall_empty_shows_all_chapters_zero(asgi_client):
    token, _ = await _login(asgi_client)
    r = await asgi_client.get("/api/my/badges", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["chapters"]) == 8
    for c in body["chapters"]:
        assert c["counts"] == {"bronze": 0, "silver": 0, "gold": 0, "master": 0}
        assert c["highest_tier"] is None


async def test_badges_wall_reflects_held_badges(asgi_client):
    token, user_id = await _login(asgi_client)

    from systemedu.student.db import UserBadge, get_session
    with get_session() as db:
        db.add(UserBadge(user_id=user_id, chapter="bio-forge", tier="bronze", source="drop"))
        db.add(UserBadge(user_id=user_id, chapter="bio-forge", tier="silver", source="drop"))
        db.add(UserBadge(
            user_id=user_id, chapter="skyward", tier="bronze", source="drop", consumed=True,
        ))
        db.commit()

    r = await asgi_client.get("/api/my/badges", headers={"Authorization": f"Bearer {token}"})
    body = r.json()
    by_chapter = {c["chapter"]: c for c in body["chapters"]}

    assert by_chapter["bio-forge"]["counts"] == {"bronze": 1, "silver": 1, "gold": 0, "master": 0}
    assert by_chapter["bio-forge"]["highest_tier"] == "silver"
    # consumed=True 的不计入
    assert by_chapter["skyward"]["counts"] == {"bronze": 0, "silver": 0, "gold": 0, "master": 0}
    assert by_chapter["skyward"]["highest_tier"] is None


async def test_badges_wall_requires_login(asgi_client):
    r = await asgi_client.get("/api/my/badges")
    assert r.status_code == 401
