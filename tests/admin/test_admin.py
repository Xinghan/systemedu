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


@pytest.fixture
def admin_db(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDENT_DB_URL", f"sqlite:///{tmp_path}/admin_test.db")
    from systemedu.student import db
    db.reset_engine_for_tests()
    db.init_db()
    yield db
    db.reset_engine_for_tests()


def test_list_users_with_stats(admin_db):
    db = admin_db
    from systemedu.admin import queries
    u = db.create_user_by_phone("13800138000")
    with db.get_session() as s:
        from systemedu.student.db import UserProject, UserKnodeComplete, ChatSession, ChatMessage
        s.add(UserProject(user_id=u.id, library_slug="mars-analog-rover"))
        s.add(UserKnodeComplete(user_id=u.id, project_slug="mars-analog-rover", knode_id="M01"))
        sess = ChatSession(user_id=u.id, library_slug="mars-analog-rover", module_id="M01", title="t")
        s.add(sess); s.flush()
        s.add(ChatMessage(user_id=u.id, session_id=sess.id, role="user", content="为什么是这样?",
                          library_slug="mars-analog-rover", module_id="M01"))
        s.commit()
    rows = queries.list_users()
    assert len(rows) == 1
    r = rows[0]
    assert r["phone"] == "13800138000"
    assert r["project_count"] == 1
    assert r["knode_count"] == 1
    assert r["question_count"] == 1


def test_user_detail(admin_db):
    db = admin_db
    from systemedu.admin import queries
    u = db.create_user_by_phone("13900139000")
    with db.get_session() as s:
        from systemedu.student.db import UserProject, UserKnodeComplete, ChatSession, ChatMessage
        s.add(UserProject(user_id=u.id, library_slug="eeg-minecraft-bci"))
        s.add(UserKnodeComplete(user_id=u.id, project_slug="eeg-minecraft-bci", knode_id="M05"))
        sess = ChatSession(user_id=u.id, library_slug="eeg-minecraft-bci", module_id="M05", title="t")
        s.add(sess); s.flush()
        s.add(ChatMessage(user_id=u.id, session_id=sess.id, role="user", content="EEG 是什么",
                          library_slug="eeg-minecraft-bci", module_id="M05"))
        s.commit()
    d = queries.user_detail(u.id)
    assert d["user"]["phone"] == "13900139000"
    assert len(d["projects"]) == 1 and d["projects"][0]["library_slug"] == "eeg-minecraft-bci"
    assert len(d["knodes"]) == 1 and d["knodes"][0]["knode_id"] == "M05"
    assert len(d["questions"]) == 1 and d["questions"][0]["content"] == "EEG 是什么"
    empty = queries.user_detail("no-such-id")
    assert empty is None
