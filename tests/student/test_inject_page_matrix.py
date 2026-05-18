"""spec 031 P6.A: 4 page_kind × 5 层完整 dispatch matrix.

补齐 P3.4 (3 个) 留下的 page_kind × layer 矩阵 — 共 16 个 (4 page × 4 答案: L1/L2/L3/L4/L5 是否激活).

激活矩阵 (spec 031 §3):
            L1   L2   L3   L4   L5
global       Y    -    -    Y    -
home         Y    Y    -    Y    -
library_det  Y    Y    -    Y    -
learn        Y    Y    Y    Y    Y
"""

from __future__ import annotations

import uuid
import pytest


@pytest.fixture
def env(tmp_path, monkeypatch):
    db_path = tmp_path / "s.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    from systemedu.student import db as _db
    from systemedu.student import cache as cache_mod
    _db.reset_engine_for_tests()
    _db.init_db()
    u = _db.create_user(f"u_{uuid.uuid4().hex[:6]}", "h")
    # 准备数据让每一层都有非空可注入内容
    _db.upsert_fact(u.id, "global", "interest", "outdoor", "true")
    _db.upsert_user_project(u.id, "s", "v1")
    _db.upsert_last_visited(u.id, "s", "M01")
    import fakeredis.aioredis
    fake = fakeredis.aioredis.FakeRedis(decode_responses=False)
    cache_mod.reset_client_for_tests()
    cache_mod.replace_client_for_tests(fake)
    yield u.id
    cache_mod.reset_client_for_tests()
    _db.reset_engine_for_tests()


class FakeMem0:
    async def search(self, *_, **__):
        return [{"memory": "m"}]


class FakeKnode:
    def __init__(self):
        self.title = "M01"
        self.plan_markdown = "..."
        self.theories = []
        self.rendered_sections = {}


class FakeLib:
    async def get_knode(self, *_):
        return FakeKnode()


MATRIX = [
    # (page_kind, expect_L1, expect_L2, expect_L3, expect_L4, expect_L5)
    ("global", True, False, False, True, False),
    ("home", True, True, False, True, False),
    ("library_detail", True, True, False, True, False),
    ("learn", True, True, True, True, True),
]


@pytest.mark.parametrize("page_kind,e1,e2,e3,e4,e5", MATRIX)
async def test_page_kind_matrix(env, page_kind, e1, e2, e3, e4, e5):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    inj = StudentMemoryInjector(mem0_client=FakeMem0(), library_client=FakeLib())
    kwargs = {
        "user_id": env, "page_kind": page_kind,
        "last_user_msg": "q",
        "active_skill_state": {"skill": "x", "turn": 1},
    }
    if page_kind in ("library_detail", "learn"):
        kwargs["library_slug"] = "s"
    if page_kind == "learn":
        kwargs["module_id"] = "M01"
    snap = await inj.inject(**kwargs)
    assert bool(snap["l1_profile"]) is e1, f"{page_kind} L1"
    assert bool(snap["l2_project_ctx"]) is e2, f"{page_kind} L2"
    assert bool(snap["l3_knode_content"]) is e3, f"{page_kind} L3"
    assert bool(snap["l4_semantic_recall"]) is e4, f"{page_kind} L4"
    assert bool(snap["l5_skill_ctx"]) is e5, f"{page_kind} L5"
