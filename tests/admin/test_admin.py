import pytest


def test_verify_admin_password(monkeypatch):
    monkeypatch.setenv("ADMIN_USER", "boss")
    monkeypatch.setenv("ADMIN_PASSWORD", "secret123")
    from systemedu.admin import auth
    import importlib; importlib.reload(auth)
    assert auth.verify_admin("boss", "secret123") is True
    assert auth.verify_admin("boss", "wrong") is False
    assert auth.verify_admin("hacker", "secret123") is False


def test_admin_token_roundtrip(monkeypatch):
    monkeypatch.setenv("ADMIN_JWT_SECRET", "testsecret")
    from systemedu.admin import auth
    import importlib; importlib.reload(auth)
    token = auth.issue_token("boss")
    assert auth.verify_token(token) == "boss"
    assert auth.verify_token("garbage.token.here") is None
