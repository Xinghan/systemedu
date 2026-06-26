"""项目申请测试 (spec 038) — POST /api/project-requests.

子进程 client + make_token (免 SMS/Redis 直建号签 token, 绝不真发短信)。
验收: 未登录 401 / 登录提交存库 201 / 空 idea 400。
"""

from __future__ import annotations

import hashlib

import httpx


def _phone_for(name: str) -> str:
    digits = int(hashlib.sha1(name.encode()).hexdigest(), 16) % 10**8
    return f"138{digits:08d}"


def test_submit_requires_login(client):
    r = client.post("/api/project-requests", json={"idea_text": "我想做一个机器人"})
    assert r.status_code == 401


def test_submit_empty_idea_400(client, make_token):
    token = make_token(_phone_for("pr_empty"))
    H = {"Authorization": f"Bearer {token}"}
    # 空字符串
    r = client.post("/api/project-requests", json={"idea_text": ""}, headers=H)
    assert r.status_code == 400
    # 只有空白
    r2 = client.post("/api/project-requests", json={"idea_text": "   \n  "}, headers=H)
    assert r2.status_code == 400
    # 缺字段
    r3 = client.post("/api/project-requests", json={}, headers=H)
    assert r3.status_code == 400


def test_submit_success_persists(client, services, make_token):
    token = make_token(_phone_for("pr_ok"))
    H = {"Authorization": f"Bearer {token}"}
    idea = "我想做一个能识别鸟叫声的 AI 装置，放在小区里统计有多少种鸟。"
    r = client.post("/api/project-requests", json={"idea_text": idea}, headers=H)
    assert r.status_code == 201
    body = r.json()
    assert body["ok"] is True
    assert body["id"]

    # 直接查子进程的 SQLite, 确认落库 + user_id + idea 正确
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from systemedu.student.db import ProjectRequest, User

    engine = create_engine(f"sqlite:///{services['db_path']}")
    try:
        with Session(engine) as s:
            uid = s.execute(
                select(User.id).where(User.phone == _phone_for("pr_ok"))
            ).scalar_one()
            req = s.execute(
                select(ProjectRequest).where(ProjectRequest.id == body["id"])
            ).scalar_one()
            assert req.user_id == uid
            assert req.idea_text == idea
            assert req.status == "pending"
    finally:
        engine.dispose()


def test_submit_too_long_400(client, make_token):
    token = make_token(_phone_for("pr_long"))
    H = {"Authorization": f"Bearer {token}"}
    r = client.post(
        "/api/project-requests", json={"idea_text": "x" * 5001}, headers=H
    )
    assert r.status_code == 400
