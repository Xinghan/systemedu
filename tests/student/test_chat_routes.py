"""spec 028 P1.10: chat HTTP routes tests.

POST /api/chat: 走 mock LLM (避免每次跑 26s)
sessions CRUD: 不需要 LLM
"""

from __future__ import annotations

import os
import uuid

import httpx
import pytest

# 这些测试沿用 conftest 里的 `services` fixture (起真 library + student-app 子进程)
# 但 POST /api/chat 需要 LLM, 子进程跑真 LLM 会很慢.
# 这里只测 sessions CRUD + auth 鉴权; 真 LLM 调用留给 P3 e2e.


def _register(client, username):
    r = client.post("/api/auth/register", json={"username": username, "password": "passw0rd"})
    return r.json()["token"]


def test_sessions_unauthed_401(client):
    r = client.get("/api/chat/sessions")
    assert r.status_code == 401


def test_create_list_get_delete(client):
    token = _register(client, "chat_user_a")
    H = {"Authorization": f"Bearer {token}"}

    # 空列表
    r = client.get("/api/chat/sessions", headers=H)
    assert r.status_code == 200
    assert r.json() == []

    # 创建
    r = client.post(
        "/api/chat/sessions",
        headers=H,
        json={"library_slug": "slug-a", "module_id": "M01", "title": "test"},
    )
    assert r.status_code == 201
    sid = r.json()["id"]

    # 列出
    r = client.get("/api/chat/sessions", headers=H)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1 and items[0]["id"] == sid

    # 取详情 (空 messages)
    r = client.get(f"/api/chat/sessions/{sid}", headers=H)
    assert r.status_code == 200
    body = r.json()
    assert body["session"]["title"] == "test"
    assert body["messages"] == []

    # 删除
    r = client.delete(f"/api/chat/sessions/{sid}", headers=H)
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    # 再列表 → 空
    assert client.get("/api/chat/sessions", headers=H).json() == []


def test_sessions_isolated_per_user(client):
    ta = _register(client, "chat_user_b")
    tb = _register(client, "chat_user_c")
    HA = {"Authorization": f"Bearer {ta}"}
    HB = {"Authorization": f"Bearer {tb}"}

    r = client.post("/api/chat/sessions", headers=HA, json={"library_slug": "slug-a"})
    sid = r.json()["id"]

    # B 看不到 A 的 session
    assert client.get("/api/chat/sessions", headers=HB).json() == []
    # B 不能取 A 的 session detail
    assert client.get(f"/api/chat/sessions/{sid}", headers=HB).status_code == 404
    # B 不能删 A 的 session
    assert client.delete(f"/api/chat/sessions/{sid}", headers=HB).status_code == 404


def test_sessions_filter_by_slug_module(client):
    token = _register(client, "chat_filter_user")
    H = {"Authorization": f"Bearer {token}"}
    client.post("/api/chat/sessions", headers=H, json={"library_slug": "slug-a", "module_id": "M01"})
    client.post("/api/chat/sessions", headers=H, json={"library_slug": "slug-a", "module_id": "M02"})
    client.post("/api/chat/sessions", headers=H, json={"library_slug": "slug-b", "module_id": "M01"})

    assert len(client.get("/api/chat/sessions?library_slug=slug-a", headers=H).json()) == 2
    assert len(client.get("/api/chat/sessions?library_slug=slug-a&module_id=M01", headers=H).json()) == 1
    assert len(client.get("/api/chat/sessions?library_slug=slug-b", headers=H).json()) == 1


def test_post_chat_unauthed_401(client):
    r = client.post("/api/chat", json={"message": "hi"})
    assert r.status_code == 401


def test_post_chat_bad_payload_400(client):
    token = _register(client, "chat_bad_user")
    H = {"Authorization": f"Bearer {token}"}
    # module_id 没 slug
    r = client.post("/api/chat", headers=H, json={"message": "hi", "module_id": "M01"})
    assert r.status_code == 400
    # 空 message
    r = client.post("/api/chat", headers=H, json={"message": ""})
    assert r.status_code == 400
