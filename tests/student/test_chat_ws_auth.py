"""spec 028 P1.10: WS authentication tests.

直接调 authenticate_ws() 测; WS 集成测留给 P3 e2e。
"""

from __future__ import annotations

import os
import uuid

import pytest


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDENT_DB_PATH", str(tmp_path / "student.db"))
    monkeypatch.setenv("STUDENT_JWT_SECRET", "test-secret-028")
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    user = _db.create_user(f"u_{uuid.uuid4().hex[:8]}", "hash")
    yield user
    _db.reset_engine_for_tests()


class _FakeWS:
    """模拟 starlette WebSocket 的 query_params 接口."""
    def __init__(self, token: str | None):
        self.query_params = {"token": token} if token else {}


@pytest.mark.asyncio
async def test_no_token_rejected(tmp_db):
    from systemedu.student.chat.auth_ws import authenticate_ws
    ws = _FakeWS(None)
    assert await authenticate_ws(ws) is None


@pytest.mark.asyncio
async def test_garbage_token_rejected(tmp_db):
    from systemedu.student.chat.auth_ws import authenticate_ws
    ws = _FakeWS("garbage")
    assert await authenticate_ws(ws) is None


@pytest.mark.asyncio
async def test_valid_token_accepted(tmp_db):
    from systemedu.student.chat.auth_ws import authenticate_ws
    from systemedu.student.auth.jwt import create_access_token
    token = create_access_token(tmp_db.id, tmp_db.username)
    ws = _FakeWS(token)
    user_id = await authenticate_ws(ws)
    assert user_id == tmp_db.id


@pytest.mark.asyncio
async def test_valid_token_unknown_user(tmp_db):
    from systemedu.student.chat.auth_ws import authenticate_ws
    from systemedu.student.auth.jwt import create_access_token
    # 创建 token 但用一个不存在的 user_id
    token = create_access_token("nonexistent-uuid", "ghost")
    ws = _FakeWS(token)
    assert await authenticate_ws(ws) is None
