"""spec 042: 徽章晋级合成规则测试 (10 换 1)."""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _setup_db(tmp_path, monkeypatch):
    db_file = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_URL", f"sqlite:///{db_file}")
    from systemedu.student import db as student_db
    student_db.reset_engine_for_tests()
    student_db.init_db()
    with student_db.get_session() as s:
        u = student_db.User(id="user-test", username="tester", password_hash="x")
        s.add(u)
        s.commit()
    yield
    student_db.reset_engine_for_tests()


def _add_badges(db, user_id, chapter, tier, count, source="drop"):
    from systemedu.student.db import UserBadge
    for _ in range(count):
        db.add(UserBadge(user_id=user_id, chapter=chapter, tier=tier, source=source))
    db.commit()


def test_no_synthesis_below_threshold():
    from systemedu.student.db import UserBadge, get_session
    from systemedu.student.badges.synthesis import maybe_synthesize

    with get_session() as db:
        _add_badges(db, "user-test", "bio-forge", "bronze", 9)
        events = maybe_synthesize(db, "user-test", "bio-forge", "bronze")
        assert events == []
        held = db.query(UserBadge).filter_by(
            user_id="user-test", chapter="bio-forge", tier="bronze", consumed=False,
        ).count()
        assert held == 9


def test_synthesis_at_threshold_produces_one_silver():
    from systemedu.student.db import UserBadge, get_session
    from systemedu.student.badges.synthesis import maybe_synthesize

    with get_session() as db:
        _add_badges(db, "user-test", "bio-forge", "bronze", 10)
        events = maybe_synthesize(db, "user-test", "bio-forge", "bronze")
        assert events == [{"chapter": "bio-forge", "from_tier": "bronze", "to_tier": "silver"}]

        remaining_bronze = db.query(UserBadge).filter_by(
            user_id="user-test", chapter="bio-forge", tier="bronze", consumed=False,
        ).count()
        assert remaining_bronze == 0

        silver = db.query(UserBadge).filter_by(
            user_id="user-test", chapter="bio-forge", tier="silver", consumed=False,
            source="synthesis",
        ).count()
        assert silver == 1


def test_consecutive_synthesis_across_two_tiers():
    """20 枚铜: 10 换 1 银, 若之前已有 9 枚银则再触发银换金."""
    from systemedu.student.db import UserBadge, get_session
    from systemedu.student.badges.synthesis import maybe_synthesize

    with get_session() as db:
        _add_badges(db, "user-test", "bio-forge", "silver", 9)
        _add_badges(db, "user-test", "bio-forge", "bronze", 10)
        events = maybe_synthesize(db, "user-test", "bio-forge", "bronze")

        assert events == [
            {"chapter": "bio-forge", "from_tier": "bronze", "to_tier": "silver"},
            {"chapter": "bio-forge", "from_tier": "silver", "to_tier": "gold"},
        ]
        gold = db.query(UserBadge).filter_by(
            user_id="user-test", chapter="bio-forge", tier="gold", consumed=False,
        ).count()
        assert gold == 1


def test_master_tier_cannot_synthesize_further():
    from systemedu.student.db import get_session
    from systemedu.student.badges.synthesis import maybe_synthesize

    with get_session() as db:
        _add_badges(db, "user-test", "bio-forge", "master", 50)
        events = maybe_synthesize(db, "user-test", "bio-forge", "master")
        assert events == []


def test_synthesis_does_not_cross_chapters():
    """不同分会的同色徽章不能合并计数."""
    from systemedu.student.db import UserBadge, get_session
    from systemedu.student.badges.synthesis import maybe_synthesize

    with get_session() as db:
        _add_badges(db, "user-test", "bio-forge", "bronze", 5)
        _add_badges(db, "user-test", "skyward", "bronze", 5)
        events = maybe_synthesize(db, "user-test", "bio-forge", "bronze")
        assert events == []
        bio_bronze = db.query(UserBadge).filter_by(
            user_id="user-test", chapter="bio-forge", tier="bronze", consumed=False,
        ).count()
        sky_bronze = db.query(UserBadge).filter_by(
            user_id="user-test", chapter="skyward", tier="bronze", consumed=False,
        ).count()
        assert bio_bronze == 5
        assert sky_bronze == 5
