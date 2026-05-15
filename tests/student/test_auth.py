"""auth 测试 — /api/auth/{register,login,me,logout}."""

from __future__ import annotations


def test_register_success(client):
    r = client.post("/api/auth/register", json={"username": "alice", "password": "passw0rd"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["username"] == "alice"
    assert d["user_id"]
    assert isinstance(d["token"], str) and len(d["token"]) > 30


def test_register_duplicate(client):
    client.post("/api/auth/register", json={"username": "dup_user", "password": "passw0rd"})
    r2 = client.post("/api/auth/register", json={"username": "dup_user", "password": "passw0rd"})
    assert r2.status_code == 409


def test_register_short_password(client):
    r = client.post("/api/auth/register", json={"username": "shortpw", "password": "12"})
    assert r.status_code == 400


def test_register_bad_username(client):
    r = client.post("/api/auth/register", json={"username": "x y", "password": "passw0rd"})
    assert r.status_code == 400


def test_login_success(client):
    client.post("/api/auth/register", json={"username": "login_user", "password": "loginpw1"})
    r = client.post("/api/auth/login", json={"username": "login_user", "password": "loginpw1"})
    assert r.status_code == 200
    assert "token" in r.json()


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={"username": "wrongpw", "password": "rightpw"})
    r = client.post("/api/auth/login", json={"username": "wrongpw", "password": "WRONG"})
    assert r.status_code == 401


def test_me_with_token(client):
    client.post("/api/auth/register", json={"username": "me_user", "password": "mepw1234"})
    r = client.post("/api/auth/login", json={"username": "me_user", "password": "mepw1234"})
    token = r.json()["token"]
    r2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["username"] == "me_user"


def test_me_no_token(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_garbage_token(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


def test_logout(client):
    r = client.post("/api/auth/logout")
    assert r.status_code == 200
    assert r.json()["ok"] is True
