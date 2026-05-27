"""spec 036: user_knode_complete DB + toggle 测试.

不起真服务, 直接 test toggle_complete / get_completed_knode_ids.
"""

from __future__ import annotations

import pytest

# 关键: 在 import student 模块前设 sqlite db
@pytest.fixture(autouse=True)
def _setup_db(tmp_path, monkeypatch):
    db_file = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_URL", f"sqlite:///{db_file}")
    # reset 全局 engine
    from systemedu.student import db as student_db
    student_db.reset_engine_for_tests()
    student_db.init_db()
    # 插一个 user
    with student_db.get_session() as s:
        u = student_db.User(
            id="user-test",
            username="tester",
            password_hash="x",
        )
        s.add(u)
        s.commit()
    yield
    student_db.reset_engine_for_tests()


def test_toggle_complete_creates_row():
    from systemedu.student.catalog.user_lit import (
        get_completed_knode_ids,
        toggle_complete,
    )

    assert get_completed_knode_ids("user-test", "p1") == []

    completed = toggle_complete("user-test", "p1", "M01")
    assert completed is True
    assert get_completed_knode_ids("user-test", "p1") == ["M01"]


def test_toggle_complete_can_undo():
    from systemedu.student.catalog.user_lit import (
        get_completed_knode_ids,
        toggle_complete,
    )

    toggle_complete("user-test", "p1", "M01")
    assert "M01" in get_completed_knode_ids("user-test", "p1")
    # 再 toggle = 撤销
    completed = toggle_complete("user-test", "p1", "M01")
    assert completed is False
    assert get_completed_knode_ids("user-test", "p1") == []


def test_action_complete_idempotent():
    from systemedu.student.catalog.user_lit import (
        get_completed_knode_ids,
        toggle_complete,
    )

    toggle_complete("user-test", "p1", "M01", action="complete")
    toggle_complete("user-test", "p1", "M01", action="complete")
    # 仍只有 1 行 (UniqueConstraint)
    assert get_completed_knode_ids("user-test", "p1") == ["M01"]


def test_action_incomplete_idempotent():
    from systemedu.student.catalog.user_lit import (
        get_completed_knode_ids,
        toggle_complete,
    )

    # 已经没有就再删, 不该抛
    completed = toggle_complete("user-test", "p1", "M01", action="incomplete")
    assert completed is False
    assert get_completed_knode_ids("user-test", "p1") == []


def test_multiple_knodes_per_project():
    from systemedu.student.catalog.user_lit import (
        get_completed_knode_ids,
        toggle_complete,
    )

    for mid in ["M01", "M02", "M05"]:
        toggle_complete("user-test", "p1", mid, action="complete")
    ids = sorted(get_completed_knode_ids("user-test", "p1"))
    assert ids == ["M01", "M02", "M05"]


def test_user_isolation():
    """不同 user 不互相影响."""
    from systemedu.student.catalog.user_lit import (
        get_completed_knode_ids,
        toggle_complete,
    )
    from systemedu.student import db as student_db

    with student_db.get_session() as s:
        s.add(student_db.User(id="user-other", username="other", password_hash="x"))
        s.commit()

    toggle_complete("user-test", "p1", "M01", action="complete")
    assert get_completed_knode_ids("user-test", "p1") == ["M01"]
    assert get_completed_knode_ids("user-other", "p1") == []


def test_get_user_completed_groups_by_slug():
    from systemedu.student.catalog.user_lit import (
        get_user_completed,
        toggle_complete,
    )

    toggle_complete("user-test", "p1", "M01", action="complete")
    toggle_complete("user-test", "p1", "M02", action="complete")
    toggle_complete("user-test", "p2", "M01", action="complete")

    res = get_user_completed("user-test")
    assert sorted(res["p1"]) == ["M01", "M02"]
    assert sorted(res["p2"]) == ["M01"]
