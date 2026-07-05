"""WS HITL round-trip in ws_chat_stream (spec 043 T1.11/1C).

Drives the real WebSocket handler in-process (Starlette TestClient) with a
stubbed `tutor_runner.stream` so we don't need an LLM. The stub emits a
`tool_confirm`, then calls the handler-supplied `resume_provider` to get the
student's decision — proving the WS handler (a) forwards `tool_confirm` to the
client, (b) reads the client's next `tool_decision` frame, and (c) feeds the
decision back into the stream. Also covers the fail-safe: a mismatched
confirm_id becomes a reject.
"""

from __future__ import annotations

import uuid

import pytest
from starlette.testclient import TestClient

from systemedu.student.chat import routes as chat_routes


@pytest.fixture()
def _token_and_client(asgi_app):
    """A TestClient (WS-capable) + a valid JWT for a fresh user."""
    from systemedu.student.auth.jwt import create_access_token
    from systemedu.student import db as _db

    user = _db.create_user(f"u_{uuid.uuid4().hex[:8]}", "hash")
    token = create_access_token(user.id, user.username)
    with TestClient(asgi_app) as client:
        yield client, token


def _install_stub_stream(monkeypatch, captured):
    """Patch tutor_runner.stream to emit tool_confirm then echo the decision."""

    async def _fake_stream(payload, user_id, resume_provider=None):
        yield {"type": "chunk", "content": "让我确认一下…"}
        confirm = {"confirm_id": "c-abc", "tool": "complete_node",
                   "args": {"knode_id": "M01"}, "description": "标记完成?"}
        yield {"type": "tool_confirm", **confirm}
        decision = await resume_provider(confirm)
        captured["decision"] = decision
        yield {"type": "chunk", "content": f"决定={decision.get('type')}"}

    monkeypatch.setattr(chat_routes.tutor_runner, "stream", _fake_stream)


def test_ws_hitl_approve_round_trip(_token_and_client, monkeypatch):
    client, token = _token_and_client
    captured: dict = {}
    _install_stub_stream(monkeypatch, captured)

    with client.websocket_connect(f"/api/chat/stream?token={token}") as ws:
        ws.send_json({"message": "标记 M01 完成", "library_slug": "s", "module_id": "M01"})
        # session frame first
        assert ws.receive_json()["type"] == "session"
        assert ws.receive_json() == {"type": "chunk", "content": "让我确认一下…"}
        confirm = ws.receive_json()
        assert confirm["type"] == "tool_confirm"
        assert confirm["tool"] == "complete_node"
        assert confirm["confirm_id"] == "c-abc"
        # student approves
        ws.send_json({"type": "tool_decision", "confirm_id": "c-abc",
                      "decision": {"type": "approve"}})
        echoed = ws.receive_json()
        assert echoed == {"type": "chunk", "content": "决定=approve"}
        assert ws.receive_json()["type"] == "done"

    assert captured["decision"] == {"type": "approve"}


def test_ws_hitl_stale_confirm_id_becomes_reject(_token_and_client, monkeypatch):
    """A decision carrying the wrong confirm_id must fail safe as reject."""
    client, token = _token_and_client
    captured: dict = {}
    _install_stub_stream(monkeypatch, captured)

    with client.websocket_connect(f"/api/chat/stream?token={token}") as ws:
        ws.send_json({"message": "标记 M01 完成", "library_slug": "s", "module_id": "M01"})
        assert ws.receive_json()["type"] == "session"
        ws.receive_json()  # chunk
        ws.receive_json()  # tool_confirm
        # wrong confirm_id
        ws.send_json({"type": "tool_decision", "confirm_id": "STALE",
                      "decision": {"type": "approve"}})
        ws.receive_json()  # echoed chunk
        ws.receive_json()  # done

    assert captured["decision"]["type"] == "reject"


def test_ws_hitl_non_decision_frame_becomes_reject(_token_and_client, monkeypatch):
    """A non-tool_decision frame while awaiting a decision must be a reject."""
    client, token = _token_and_client
    captured: dict = {}
    _install_stub_stream(monkeypatch, captured)

    with client.websocket_connect(f"/api/chat/stream?token={token}") as ws:
        ws.send_json({"message": "标记 M01 完成", "library_slug": "s", "module_id": "M01"})
        assert ws.receive_json()["type"] == "session"
        ws.receive_json()  # chunk
        ws.receive_json()  # tool_confirm
        # client sends some unrelated frame instead of a decision
        ws.send_json({"type": "chunk", "content": "??"})
        ws.receive_json()  # echoed chunk
        ws.receive_json()  # done

    assert captured["decision"]["type"] == "reject"
