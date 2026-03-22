"""Tests for gateway authentication."""

import pytest
from starlette.testclient import TestClient

from systemedu.gateway.server import create_app


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app, raise_server_exceptions=True)


def test_login_success(client):
    res = client.post("/api/auth/login", json={"username": "root", "password": "123systemedu"})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["username"] == "root"
    assert len(data["token"]) > 0


def test_login_wrong_password(client):
    res = client.post("/api/auth/login", json={"username": "root", "password": "wrong"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "123systemedu"})
    assert res.status_code == 401


def test_me_with_valid_token(client):
    token = client.post("/api/auth/login", json={"username": "root", "password": "123systemedu"}).json()["token"]
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["valid"] is True


def test_me_without_token(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_logout_revokes_token(client):
    token = client.post("/api/auth/login", json={"username": "root", "password": "123systemedu"}).json()["token"]
    client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_protected_route_without_token(client):
    res = client.get("/api/projects")
    assert res.status_code == 401


def test_protected_route_with_valid_token(client):
    token = client.post("/api/auth/login", json={"username": "root", "password": "123systemedu"}).json()["token"]
    res = client.get("/api/projects", headers={"Authorization": f"Bearer {token}"})
    # Should not be 401 (may be 200 or other error depending on state)
    assert res.status_code != 401


def test_status_is_public(client):
    """GET /api/status must be accessible without auth."""
    res = client.get("/api/status")
    assert res.status_code == 200


def test_invalid_token_returns_401(client):
    res = client.get("/api/projects", headers={"Authorization": "Bearer invalid_token_xyz"})
    assert res.status_code == 401
