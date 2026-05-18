"""spec 031 P3.4: StudentMemoryInjector 5 层 + page_kind matrix tests."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    u = _db.create_user(f"u_{uuid.uuid4().hex[:6]}", "h")
    yield u.id
    _db.reset_engine_for_tests()


@pytest.fixture
def fake_cache():
    import fakeredis.aioredis
    from systemedu.student import cache as cache_mod
    fake = fakeredis.aioredis.FakeRedis(decode_responses=False)
    cache_mod.reset_client_for_tests()
    cache_mod.replace_client_for_tests(fake)
    yield fake
    cache_mod.reset_client_for_tests()


class FakeMem0:
    """简单 mock — search 返预设结果."""

    def __init__(self, results=None):
        self.results = results or []
        self.last_call = None

    async def search(self, query, *, user_id, filters=None, limit=3):
        self.last_call = {"query": query, "user_id": user_id, "filters": filters, "limit": limit}
        return self.results


class FakeKnode:
    def __init__(self, title="M01 测试", plan_md="这一节学..."):
        self.title = title
        self.plan_markdown = plan_md
        self.theories = [{"theory_id": "t1"}, {"theory_id": "t2"}]
        self.rendered_sections = {
            "ideas": [{"idea_id": "ex1", "mode": "exercise"}],
            "rendered_sections": {
                "ex1": {"mode": "exercise", "exercises": [{"q": "Q1"}, {"q": "Q2"}]},
                "anim1": {"mode": "animation"},
            },
        }


class FakeLibrary:
    def __init__(self, knode=None, fail=False):
        self.knode = knode or FakeKnode()
        self.fail = fail
        self.calls = 0

    async def get_knode(self, slug, knode_id):
        self.calls += 1
        if self.fail:
            raise RuntimeError("library down")
        return self.knode


# ============================== L1 ==============================

async def test_l1_empty(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    assert snap["l1_profile"] == ""


async def test_l1_grouped_by_category(tmp_db, fake_cache):
    from systemedu.student.db import upsert_fact
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    upsert_fact(tmp_db, "global", "interest", "outdoor", "true")
    upsert_fact(tmp_db, "global", "skill_level", "python", "intermediate")
    upsert_fact(tmp_db, "global", "family", "brother_asthma", "true")
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    out = snap["l1_profile"]
    assert "interest:" in out
    assert "skill_level:" in out
    assert "family:" in out
    assert "outdoor" in out


# ============================== L2 ==============================

async def test_l2_home_top3(tmp_db, fake_cache):
    from systemedu.student.db import upsert_user_project
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    # 4 projects pulled (top 3 应取最近)
    for i in range(4):
        upsert_user_project(tmp_db, f"slug-{i}", f"v0.{i}")
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    out = snap["l2_project_ctx"]
    # 至少包含 3 个 slug
    assert sum(1 for i in range(4) if f"slug-{i}" in out) >= 3


async def test_l2_library_detail_single(tmp_db, fake_cache):
    from systemedu.student.db import upsert_user_project, upsert_last_visited
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    upsert_user_project(tmp_db, "slug-x", "v1.0")
    upsert_last_visited(tmp_db, "slug-x", "M05")
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="library_detail", library_slug="slug-x")
    out = snap["l2_project_ctx"]
    assert "slug-x" in out
    assert "M05" in out


async def test_l2_learn_with_module(tmp_db, fake_cache):
    from systemedu.student.db import upsert_user_project, upsert_last_visited
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    upsert_user_project(tmp_db, "slug-y", "v2.0")
    upsert_last_visited(tmp_db, "slug-y", "M02")
    inj = StudentMemoryInjector(library_client=FakeLibrary())
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn", library_slug="slug-y", module_id="M03",
    )
    assert "slug-y" in snap["l2_project_ctx"]


# ============================== L3 knode 内容 ==============================

async def test_l3_knode_cache_miss_fetches(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    lib = FakeLibrary()
    inj = StudentMemoryInjector(library_client=lib)
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug="s", module_id="M01",
    )
    assert lib.calls == 1
    assert "M01 测试" in snap["l3_knode_content"]


async def test_l3_knode_cache_hit_no_fetch(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    # 先 set cache
    await fake_cache.setex("knode:s:M01:summary", 60, b"cached summary X")
    lib = FakeLibrary()
    inj = StudentMemoryInjector(library_client=lib)
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug="s", module_id="M01",
    )
    assert lib.calls == 0
    assert "cached summary X" in snap["l3_knode_content"]


async def test_l3_knode_library_fail_safe(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    lib = FakeLibrary(fail=True)
    inj = StudentMemoryInjector(library_client=lib)
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug="s", module_id="M01",
    )
    # library 挂 → L3 empty 但其他层不挂
    assert snap["l3_knode_content"] == ""


# ============================== L3 history ==============================

async def test_l3_history_current_and_recent_wrong(tmp_db, fake_cache):
    from systemedu.student.db import record_exercise_attempt
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    # 当前 module 4 题 (2 对 2 错)
    for c in (True, False, True, False):
        record_exercise_attempt(
            tmp_db, "s", "M03", question="Q ?", student_answer="A", correct=c,
        )
    # 项目其他 module 错 1
    record_exercise_attempt(
        tmp_db, "s", "M02", question="混淆 PM2.5/PM10", student_answer="X", correct=False,
    )
    inj = StudentMemoryInjector(library_client=FakeLibrary())
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug="s", module_id="M03",
    )
    out = snap["l3_knode_content"]
    assert "4 题" in out and "错 2" in out
    assert "M02" in out and "PM2.5/PM10" in out


# ============================== L4 ==============================

async def test_l4_filter_global(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    mem0 = FakeMem0(results=[{"memory": "m1"}, {"memory": "m2"}])
    inj = StudentMemoryInjector(mem0_client=mem0)
    snap = await inj.inject(
        user_id=tmp_db, page_kind="global", last_user_msg="hello",
    )
    assert mem0.last_call["filters"] == {"user_id": tmp_db}
    assert snap["l4_semantic_recall"] == ["m1", "m2"]


async def test_l4_filter_learn(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    mem0 = FakeMem0(results=[{"memory": "m"}])
    inj = StudentMemoryInjector(mem0_client=mem0, library_client=FakeLibrary())
    await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug="s", module_id="M01", last_user_msg="q",
    )
    assert mem0.last_call["filters"] == {
        "user_id": tmp_db, "library_slug": "s", "module_id": "M01",
    }


async def test_l4_no_mem0_returns_empty(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    inj = StudentMemoryInjector(mem0_client=None)
    snap = await inj.inject(user_id=tmp_db, page_kind="global", last_user_msg="x")
    assert snap["l4_semantic_recall"] == []


# ============================== L5 ==============================

async def test_l5_skill_state(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    inj = StudentMemoryInjector(library_client=FakeLibrary())
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug="s", module_id="M01",
        active_skill_state={"skill": "scaffolding", "turn": 3, "stuck_signal": "lost"},
    )
    assert "scaffolding" in snap["l5_skill_ctx"]
    assert "turn 3" in snap["l5_skill_ctx"]


# ============================== Page-kind matrix ==============================

async def test_page_kind_global_only_l1_l4(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    inj = StudentMemoryInjector(mem0_client=FakeMem0(), library_client=FakeLibrary())
    snap = await inj.inject(user_id=tmp_db, page_kind="global", last_user_msg="x")
    assert snap["l2_project_ctx"] == ""
    assert snap["l3_knode_content"] == ""
    assert snap["l5_skill_ctx"] == ""


async def test_page_kind_home_l1_l2_l4(tmp_db, fake_cache):
    from systemedu.student.db import upsert_user_project
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    upsert_user_project(tmp_db, "p1", "v1")
    inj = StudentMemoryInjector(mem0_client=FakeMem0())
    snap = await inj.inject(user_id=tmp_db, page_kind="home", last_user_msg="x")
    assert "p1" in snap["l2_project_ctx"]
    assert snap["l3_knode_content"] == ""
    assert snap["l5_skill_ctx"] == ""


async def test_page_kind_learn_all_layers(tmp_db, fake_cache):
    from systemedu.student.db import upsert_user_project
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    upsert_user_project(tmp_db, "s", "v1")
    inj = StudentMemoryInjector(
        mem0_client=FakeMem0(results=[{"memory": "m1"}]),
        library_client=FakeLibrary(),
    )
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug="s", module_id="M01",
        last_user_msg="q",
        active_skill_state={"skill": "direct-instruction", "turn": 1},
    )
    assert snap["l2_project_ctx"]
    assert snap["l3_knode_content"]
    assert snap["l4_semantic_recall"]
    assert snap["l5_skill_ctx"]


# ============================== Gather fail ==============================

async def test_gather_one_layer_fails_others_ok(tmp_db, fake_cache):
    """L3 抛 (library 挂), L1/L2/L4 仍正常."""
    from systemedu.student.db import upsert_fact, upsert_user_project
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    upsert_fact(tmp_db, "global", "interest", "x", "y")
    upsert_user_project(tmp_db, "s", "v1")
    inj = StudentMemoryInjector(
        mem0_client=FakeMem0(results=[{"memory": "ok"}]),
        library_client=FakeLibrary(fail=True),  # L3 knode 拿不到
    )
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug="s", module_id="M01",
        last_user_msg="q",
    )
    assert snap["l1_profile"]
    assert snap["l2_project_ctx"]
    assert snap["l3_knode_content"] == ""  # 挂掉
    assert snap["l4_semantic_recall"] == ["ok"]


# ============================== Render template ==============================

def test_render_with_empty_layers():
    from systemedu.student.chat.memory_layers import render_memory
    out = render_memory({})
    assert "(空)" in out
    assert "## L1" in out


def test_render_with_content():
    from systemedu.student.chat.memory_layers import render_memory
    snap = {
        "l1_profile": "学生喜欢 X",
        "l2_project_ctx": "在 P1 学到 M03",
        "l3_knode_content": "M03 讲 AQI",
        "l4_semantic_recall": ["a", "b"],
        "l5_skill_ctx": "direct",
    }
    out = render_memory(snap)
    assert "学生喜欢 X" in out
    assert "M03 讲 AQI" in out
    assert "- a" in out and "- b" in out
