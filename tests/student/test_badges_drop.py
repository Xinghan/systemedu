"""spec 042: 徽章掉落规则测试.

不起真服务, mock library client (get_project/get_tree), 直接测 maybe_drop_badges。
"""
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


class _ProjectMeta:
    def __init__(self, domain):
        self.domain = domain


def _tree_5_stages():
    """5 个 stage, 每 stage 2 个 module. S1-S3 前半段(铜), S4-S5 后半段(银)。"""
    stages = [{"stage_id": f"S{i}"} for i in range(1, 6)]
    modules = []
    for i in range(1, 6):
        modules.append({"module_id": f"S{i}M1", "stage_id": f"S{i}", "sequence_order": 1})
        modules.append({"module_id": f"S{i}M2", "stage_id": f"S{i}", "sequence_order": 2})
    return {"stages": stages, "modules": modules}


def _mock_library(monkeypatch, domain="Biotech", tree=None):
    import systemedu.student.badges.drop as drop_mod

    class _Client:
        async def get_project(self, slug):
            return _ProjectMeta(domain)

        async def get_tree(self, slug):
            return tree if tree is not None else _tree_5_stages()

    monkeypatch.setattr(drop_mod, "get_library_client", lambda: _Client())


async def test_front_half_stage_drops_bronze(monkeypatch):
    from systemedu.student.badges.drop import maybe_drop_badges
    _mock_library(monkeypatch)

    # S1 的非收尾节点 (S1M1), 前半段 (ceil(5/2)=3, S1 index=0 < 3) -> 铜, 非收尾不额外掉落
    result = await maybe_drop_badges("user-test", "some-proj", "S1M1")
    assert result == [{"chapter": "bio-forge", "tier": "bronze", "count": 1}]


async def test_back_half_stage_drops_silver(monkeypatch):
    from systemedu.student.badges.drop import maybe_drop_badges
    _mock_library(monkeypatch)

    # S4 index=3 >= 3 -> 后半段 -> 银
    result = await maybe_drop_badges("user-test", "some-proj", "S4M1")
    assert result == [{"chapter": "bio-forge", "tier": "silver", "count": 1}]


async def test_milestone_end_drops_extra(monkeypatch):
    from systemedu.student.badges.drop import maybe_drop_badges
    _mock_library(monkeypatch)

    # S1M2 是 S1 内 sequence_order 最大 -> 收尾, 铜 x2
    result = await maybe_drop_badges("user-test", "some-proj", "S1M2")
    assert result == [{"chapter": "bio-forge", "tier": "bronze", "count": 2}]


async def test_duplicate_completion_does_not_double_drop(monkeypatch):
    from systemedu.student.badges.drop import maybe_drop_badges
    _mock_library(monkeypatch)

    first = await maybe_drop_badges("user-test", "some-proj", "S1M1")
    second = await maybe_drop_badges("user-test", "some-proj", "S1M1")
    assert first == [{"chapter": "bio-forge", "tier": "bronze", "count": 1}]
    assert second == []


async def test_unmapped_domain_does_not_drop(monkeypatch):
    from systemedu.student.badges.drop import maybe_drop_badges
    _mock_library(monkeypatch, domain="Unknown-Domain")

    result = await maybe_drop_badges("user-test", "some-proj", "S1M1")
    assert result == []


async def test_unknown_knode_does_not_drop(monkeypatch):
    from systemedu.student.badges.drop import maybe_drop_badges
    _mock_library(monkeypatch)

    result = await maybe_drop_badges("user-test", "some-proj", "NOT-A-REAL-KNODE")
    assert result == []


async def test_dropped_badges_persist_in_db(monkeypatch):
    from systemedu.student import db as student_db
    from systemedu.student.badges.drop import maybe_drop_badges
    _mock_library(monkeypatch)

    await maybe_drop_badges("user-test", "some-proj", "S1M2")  # 收尾, 铜 x2

    with student_db.get_session() as s:
        rows = s.query(student_db.UserBadge).filter_by(
            user_id="user-test", chapter="bio-forge", tier="bronze", consumed=False,
        ).all()
        assert len(rows) == 2
        assert all(r.source == "drop" for r in rows)
        assert all(r.project_slug == "some-proj" and r.knode_id == "S1M2" for r in rows)
