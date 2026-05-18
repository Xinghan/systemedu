"""spec 031 P5: /api/exercise/attempt route tests."""

from __future__ import annotations

import uuid

import pytest
from starlette.applications import Starlette
from starlette.testclient import TestClient


@pytest.fixture
def app_with_user(tmp_path, monkeypatch):
    """构建一个 mini app 仅注册 exercise route + 鉴权 stub."""
    db_path = tmp_path / "s.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    monkeypatch.setenv("STUDENT_JWT_SECRET", "test-secret-031")
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    u = _db.create_user(f"u_{uuid.uuid4().hex[:6]}", "h")

    # 真 JWT (走 require_login)
    from systemedu.student.auth.jwt import create_access_token
    token = create_access_token(u.id, u.username)

    from systemedu.student.chat.exercise_routes import ROUTES
    app = Starlette(routes=ROUTES)
    yield app, u.id, token
    _db.reset_engine_for_tests()


def test_post_attempt_201(app_with_user):
    app, uid, token = app_with_user
    client = TestClient(app)
    resp = client.post(
        "/api/exercise/attempt",
        json={
            "library_slug": "purpleair", "module_id": "M03",
            "idea_id": "ex_1", "exercise_index": 0,
            "question": "Q1?", "student_answer": "A", "correct": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["id"]

    # 验证落库
    from systemedu.student.db import list_exercise_attempts
    rows = list_exercise_attempts(uid, "purpleair", "M03")
    assert len(rows) == 1
    assert rows[0]["correct"] is True


def test_post_attempt_missing_fields_400(app_with_user):
    app, _, token = app_with_user
    client = TestClient(app)
    resp = client.post(
        "/api/exercise/attempt",
        json={"library_slug": "x"},  # 缺 module_id + correct
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


def test_post_attempt_unauth_401(app_with_user):
    app, _, _ = app_with_user
    client = TestClient(app)
    resp = client.post(
        "/api/exercise/attempt",
        json={"library_slug": "x", "module_id": "M01", "correct": True},
    )
    assert resp.status_code == 401


def test_post_attempt_wrong_records_wrong(app_with_user):
    app, uid, token = app_with_user
    client = TestClient(app)
    resp = client.post(
        "/api/exercise/attempt",
        json={
            "library_slug": "p", "module_id": "M01",
            "question": "Wrong Q", "student_answer": "X",
            "correct": False,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    from systemedu.student.db import list_exercise_attempts
    rows = list_exercise_attempts(uid, only_wrong=True)
    assert len(rows) == 1
    assert "Wrong Q" in rows[0]["question"]


def test_post_attempt_user_isolated(tmp_path, monkeypatch):
    """两个用户分别 post 不能看到对方的 attempt."""
    db_path = tmp_path / "s.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    monkeypatch.setenv("STUDENT_JWT_SECRET", "iso-secret")
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    ua = _db.create_user(f"a_{uuid.uuid4().hex[:6]}", "h")
    ub = _db.create_user(f"b_{uuid.uuid4().hex[:6]}", "h")
    from systemedu.student.auth.jwt import create_access_token
    from systemedu.student.chat.exercise_routes import ROUTES
    app = Starlette(routes=ROUTES)
    client = TestClient(app)

    for u_obj, label in [(ua, "A"), (ub, "B")]:
        tok = create_access_token(u_obj.id, u_obj.username)
        client.post(
            "/api/exercise/attempt",
            json={"library_slug": "p", "module_id": "M01",
                  "question": label, "correct": True},
            headers={"Authorization": f"Bearer {tok}"},
        )

    from systemedu.student.db import list_exercise_attempts
    assert len(list_exercise_attempts(ua.id)) == 1
    assert list_exercise_attempts(ua.id)[0]["question"] == "A"
    assert len(list_exercise_attempts(ub.id)) == 1
    assert list_exercise_attempts(ub.id)[0]["question"] == "B"
    _db.reset_engine_for_tests()


# ============================== ChatPayload page_kind 校验 ==============================

def test_chat_payload_learn_requires_module_id():
    from systemedu.student.chat.payload import ChatPayload
    with pytest.raises(Exception):
        ChatPayload(message="x", page_kind="learn", library_slug="s")


def test_chat_payload_library_detail_requires_slug():
    from systemedu.student.chat.payload import ChatPayload
    with pytest.raises(Exception):
        ChatPayload(message="x", page_kind="library_detail")


def test_chat_payload_global_ok_without_extras():
    from systemedu.student.chat.payload import ChatPayload
    p = ChatPayload(message="x", page_kind="global")
    assert p.page_kind == "global"
    assert p.library_slug is None


def test_chat_payload_learn_ok_with_full():
    from systemedu.student.chat.payload import ChatPayload
    p = ChatPayload(message="x", page_kind="learn", library_slug="s", module_id="M01")
    assert p.thread_id("uid1") == "uid1:s:M01"
