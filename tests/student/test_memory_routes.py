"""spec 032 P2: /api/memory/facts GET/DELETE."""

from __future__ import annotations

import uuid

import pytest
from starlette.applications import Starlette
from starlette.testclient import TestClient


@pytest.fixture
def env(tmp_path, monkeypatch):
    db_path = tmp_path / "s.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    monkeypatch.setenv("STUDENT_JWT_SECRET", "test-secret-032")
    from systemedu.student import db as _db
    from systemedu.student.auth.jwt import create_access_token
    _db.reset_engine_for_tests()
    _db.init_db()
    ua = _db.create_user(f"a_{uuid.uuid4().hex[:6]}", "h")
    ub = _db.create_user(f"b_{uuid.uuid4().hex[:6]}", "h")
    tok_a = create_access_token(ua.id, ua.username)
    tok_b = create_access_token(ub.id, ub.username)

    from systemedu.student.chat.memory_routes import ROUTES
    app = Starlette(routes=ROUTES)
    client = TestClient(app)
    yield client, ua, ub, tok_a, tok_b
    _db.reset_engine_for_tests()


def test_list_empty(env):
    client, ua, _, tok_a, _ = env
    r = client.get("/api/memory/facts", headers={"Authorization": f"Bearer {tok_a}"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["by_category"] == {}


def test_list_grouped(env):
    from systemedu.student.db import upsert_fact
    client, ua, _, tok_a, _ = env
    upsert_fact(ua.id, "global", "interest", "outdoor", "true")
    upsert_fact(ua.id, "global", "skill_level", "python", "intermediate")
    upsert_fact(ua.id, "global", "interest", "music", "true")
    r = client.get("/api/memory/facts", headers={"Authorization": f"Bearer {tok_a}"})
    body = r.json()
    assert body["total"] == 3
    assert "interest" in body["by_category"]
    assert "skill_level" in body["by_category"]
    assert len(body["by_category"]["interest"]) == 2


def test_list_user_isolated(env):
    from systemedu.student.db import upsert_fact
    client, ua, ub, tok_a, tok_b = env
    upsert_fact(ua.id, "global", "interest", "x", "true")
    r_a = client.get("/api/memory/facts", headers={"Authorization": f"Bearer {tok_a}"})
    r_b = client.get("/api/memory/facts", headers={"Authorization": f"Bearer {tok_b}"})
    assert r_a.json()["total"] == 1
    assert r_b.json()["total"] == 0


def test_retire_own_fact(env):
    from systemedu.student.db import upsert_fact, list_current_facts
    client, ua, _, tok_a, _ = env
    f = upsert_fact(ua.id, "global", "interest", "x", "true")
    r = client.delete(
        f"/api/memory/facts/{f['id']}",
        headers={"Authorization": f"Bearer {tok_a}"},
    )
    assert r.status_code == 200
    assert r.json()["retired"] is True
    assert len(list_current_facts(ua.id)) == 0  # 没了


def test_retire_other_user_403(env):
    from systemedu.student.db import upsert_fact
    client, ua, _, _, tok_b = env
    f = upsert_fact(ua.id, "global", "interest", "x", "true")
    r = client.delete(
        f"/api/memory/facts/{f['id']}",
        headers={"Authorization": f"Bearer {tok_b}"},
    )
    assert r.status_code == 403


def test_retire_not_found(env):
    client, _, _, tok_a, _ = env
    r = client.delete(
        "/api/memory/facts/nonexistent-id",
        headers={"Authorization": f"Bearer {tok_a}"},
    )
    assert r.status_code == 404


def test_unauth_401(env):
    client, *_ = env
    r1 = client.get("/api/memory/facts")
    r2 = client.delete("/api/memory/facts/x")
    assert r1.status_code == 401
    assert r2.status_code == 401
