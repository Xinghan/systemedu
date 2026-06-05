"""L1 memory_layers 缺口补测 (降级 / 启发分支).

针对 packages/student-app/.../chat/memory_layers.py 未覆盖的边缘分支:
- _gather 单层异常降级 (l4 给 [] / 其他给 "")
- _l1_query 杂项 category 输出
- _l2_query 单项目无 last_visited (未开始)
- _l3_knode_content redis get/setex 异常吞掉 + library_client=None
- _build_knode_summary 动画/游戏计数
- _l4_semantic_recall Mem0 search 异常降级
- CloudInjectorAdapter page_kind 启发推断三分支

复用 test_memory_layers 的 Fake* 类; tmp_db / fake_cache fixture 在本文件重建 (独立).
"""

from __future__ import annotations

import uuid

import pytest

from tests.student.test_memory_layers import FakeMem0, FakeKnode, FakeLibrary


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


# ============================== _gather 降级 (100-101) ==============================

class _BoomLibrary:
    """get_knode 抛异常 -> _l3_knode_content 内部捕获并 return ""; 不触发 gather 降级.

    用单独的 layer 抛异常验证 gather 顶层降级需要让 coroutine 本身 raise.
    这里用一个会让 _l4 raise 的 mem0 client (search raise) -> l4 给 [].
    """


async def test_gather_l4_layer_raises_gives_empty_list(tmp_db, fake_cache, monkeypatch):
    """l4 这一层 coroutine 抛异常 -> out['l4'] = [] (100-101 的 l4 分支)."""
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    inj = StudentMemoryInjector(mem0_client=FakeMem0(results=[{"memory": "x"}]))

    # patch _l4_semantic_recall 直接抛, 触发 gather return_exceptions 路径
    async def boom(*a, **k):
        raise RuntimeError("l4 boom")

    monkeypatch.setattr(inj, "_l4_semantic_recall", boom)
    snap = await inj.inject(user_id=tmp_db, page_kind="global", last_user_msg="hi")
    # l4 失败 -> 空 list, 不崩
    assert snap["l4_semantic_recall"] == []


async def test_gather_non_l4_layer_raises_gives_empty_str(tmp_db, fake_cache, monkeypatch):
    """非 l4 层 (l1) coroutine 抛异常 -> out['l1'] = '' (100-101 的 else 分支)."""
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    inj = StudentMemoryInjector()

    async def boom(*a, **k):
        raise RuntimeError("l1 boom")

    monkeypatch.setattr(inj, "_l1_profile", boom)
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    # l1 失败 -> 空字符串, 其他层正常
    assert snap["l1_profile"] == ""


# ============================== _l1_query 杂项 category (145) ==============================

async def test_l1_misc_category_output(tmp_db, fake_cache):
    """category 不在标准组 -> 走杂项 lines.append (145)."""
    from systemedu.student.db import upsert_fact
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    # 自定义 category "habit" 不在标准 6 类里
    upsert_fact(tmp_db, "global", "habit", "study_time", "evening")
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    out = snap["l1_profile"]
    assert "habit:" in out
    assert "study_time=evening" in out


# ============================== _l2_query 无 last_visited (182 区) ==============================

async def test_l2_library_detail_no_last_visited(tmp_db, fake_cache):
    """有当前项目但无 last_visited -> last='未开始' (180 else 分支)."""
    from systemedu.student.db import upsert_user_project
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    upsert_user_project(tmp_db, "slug-nv", "v3.0")
    # 不调 upsert_last_visited
    inj = StudentMemoryInjector()
    snap = await inj.inject(
        user_id=tmp_db, page_kind="library_detail", library_slug="slug-nv",
    )
    out = snap["l2_project_ctx"]
    assert "slug-nv" in out
    assert "未开始" in out


async def test_l2_library_detail_no_slug_empty(tmp_db, fake_cache):
    """page_kind library_detail 但无 library_slug -> elif 守卫不过 -> return '' (182)."""
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    inj = StudentMemoryInjector()
    snap = await inj.inject(
        user_id=tmp_db, page_kind="library_detail", library_slug=None,
    )
    assert snap["l2_project_ctx"] == ""


async def test_l2_library_detail_not_pulled(tmp_db, fake_cache):
    """page_kind library_detail 但项目未 Pull -> '尚未 Pull' (178)."""
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    inj = StudentMemoryInjector()
    snap = await inj.inject(
        user_id=tmp_db, page_kind="library_detail", library_slug="never-pulled",
    )
    assert "never-pulled 尚未 Pull" in snap["l2_project_ctx"]


# ============================== _l3_knode_content 降级 (195-196, 199, 208-209) ==============================

class _GetBoomCache:
    """cache.get 抛异常 -> 走 warning 继续 (195-196); setex 也抛 -> 吞 (208-209)."""

    async def get(self, key):
        raise RuntimeError("redis get down")

    async def setex(self, key, ttl, val):
        raise RuntimeError("redis setex down")


async def test_l3_cache_get_and_setex_exceptions_degrade(tmp_db, fake_cache, monkeypatch):
    """cache.get 抛异常 (195-196) -> 继续 fetch; setex 抛异常 (208-209) -> 吞掉仍返回 summary."""
    from systemedu.student import cache as cache_mod
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    cache_mod.replace_client_for_tests(_GetBoomCache())
    lib = FakeLibrary()
    inj = StudentMemoryInjector(library_client=lib)
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn", library_slug="s", module_id="M01",
    )
    # cache.get 挂仍 fetch library; setex 挂仍返回 summary
    assert lib.calls == 1
    assert "M01 测试" in snap["l3_knode_content"]


async def test_l3_library_client_none_returns_empty(tmp_db, fake_cache):
    """cache miss + library_client is None -> return '' (199)."""
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    inj = StudentMemoryInjector(library_client=None)
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn", library_slug="s", module_id="M01",
    )
    # 没 library_client, L3 content 空
    assert snap["l3_knode_content"] == ""


# ============================== _build_knode_summary 媒体计数 (233-234, 248) ==============================

class _MediaKnode:
    """rendered_sections 含 animation + game section, 触发 n_anim / n_game 计数."""

    def __init__(self):
        self.title = "M07 富媒体"
        self.plan_markdown = "这一节有动画和游戏"
        self.theories = []
        self.rendered_sections = {
            "ideas": [],
            "rendered_sections": {
                "anim1": {"mode": "animation"},
                "anim2": {"mode": "animation"},
                "game1": {"mode": "game"},
                "ex1": {"mode": "exercise", "exercises": [{"q": "Q1"}]},
            },
        }


async def test_l3_summary_counts_animation_and_game(tmp_db, fake_cache):
    """summary 含 'N 个动画' / 'N 个游戏' (233-234 计数 + 246/248 输出)."""
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    lib = FakeLibrary(knode=_MediaKnode())
    inj = StudentMemoryInjector(library_client=lib)
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn", library_slug="s", module_id="M07",
    )
    out = snap["l3_knode_content"]
    assert "2 个动画" in out
    assert "1 个游戏" in out
    assert "1 题练习" in out


# ============================== _l4_semantic_recall 异常降级 (322-324) ==============================

class _BoomMem0:
    """search 抛异常 -> log warning -> return []."""

    async def search(self, query, *, user_id, filters=None, limit=3):
        raise RuntimeError("mem0 down")


async def test_l4_search_exception_returns_empty(tmp_db, fake_cache):
    """Mem0 search 抛异常 -> 降级 return [] (322-324)."""
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    inj = StudentMemoryInjector(mem0_client=_BoomMem0())
    snap = await inj.inject(user_id=tmp_db, page_kind="global", last_user_msg="hi")
    assert snap["l4_semantic_recall"] == []


# ============================== CloudInjectorAdapter 启发 (389, 404-415) ==============================

async def test_adapter_explicit_active_tab(tmp_db, fake_cache):
    """active_tab 是有效 page_kind -> 直接用 (405-406)."""
    from systemedu.student.chat.memory_layers import (
        StudentMemoryInjector,
        CloudInjectorAdapter,
    )

    adapter = CloudInjectorAdapter(StudentMemoryInjector())
    snap = await adapter.inject(
        user_id=tmp_db,
        project_name=None,
        knode_id=None,
        last_user_msg="hi",
        active_tab="home",
    )
    # home 激活 L2, 应有 l2 字段 (空也行, 关键是不崩 + 走显式分支)
    assert "l2_project_ctx" in snap


async def test_adapter_heuristic_learn(tmp_db, fake_cache):
    """active_tab 无效 + 有 knode + project -> learn (409-410)."""
    from systemedu.student.db import upsert_user_project, upsert_last_visited
    from systemedu.student.chat.memory_layers import (
        StudentMemoryInjector,
        CloudInjectorAdapter,
    )

    upsert_user_project(tmp_db, "slug-h", "v1.0")
    upsert_last_visited(tmp_db, "slug-h", "M02")
    adapter = CloudInjectorAdapter(
        StudentMemoryInjector(library_client=FakeLibrary())
    )
    snap = await adapter.inject(
        user_id=tmp_db,
        project_name="slug-h",
        knode_id="M01",
        last_user_msg="q",
        active_tab=None,  # 触发启发
    )
    # learn 才会拉 L3 knode content
    assert "M01 测试" in snap["l3_knode_content"]


async def test_adapter_heuristic_library_detail(tmp_db, fake_cache):
    """active_tab 无效 + 只有 project (无 knode) -> library_detail (411-412)."""
    from systemedu.student.db import upsert_user_project
    from systemedu.student.chat.memory_layers import (
        StudentMemoryInjector,
        CloudInjectorAdapter,
    )

    upsert_user_project(tmp_db, "slug-d", "v2.0")
    adapter = CloudInjectorAdapter(StudentMemoryInjector())
    snap = await adapter.inject(
        user_id=tmp_db,
        project_name="slug-d",
        knode_id=None,
        last_user_msg="q",
        active_tab="bogus",  # 无效 tab -> 启发
    )
    # library_detail: L2 单项目细节
    assert "当前项目: slug-d" in snap["l2_project_ctx"]
    # 无 knode -> L3 content 空 (不是 learn)
    assert snap["l3_knode_content"] == ""


async def test_adapter_heuristic_global(tmp_db, fake_cache):
    """active_tab 无效 + 无 project 无 knode -> global (413-414)."""
    from systemedu.student.chat.memory_layers import (
        StudentMemoryInjector,
        CloudInjectorAdapter,
    )

    adapter = CloudInjectorAdapter(StudentMemoryInjector())
    snap = await adapter.inject(
        user_id=tmp_db,
        project_name=None,
        knode_id=None,
        last_user_msg="q",
        active_tab=None,
    )
    # global: 无 L2 (PAGES_WITH_L2 不含 global)
    assert snap["l2_project_ctx"] == ""
