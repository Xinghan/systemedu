"""Tests for MemoryInjector (spec 014 T2.2).

Covers the 2-context × Mem0-on/off matrix plus layer-isolation on
exceptions and concurrent execution.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.storage.db import (
    Base,
    Enrollment,
    ProgressRecord,
    StudentFact,
)
from systemedu.tutor.memory import MemoryInjector, render_memory


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def engine(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 'layers.db'}")
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def session_factory(engine):
    return sessionmaker(bind=engine)


@pytest.fixture
def seeded(session_factory):
    """Seed a user with facts / enrollment / progress in project P1."""
    db = session_factory()
    try:
        db.add_all([
            StudentFact(
                user_id="u1", category="interest",
                content="喜欢做机械玩具", confidence=0.9,
            ),
            StudentFact(
                user_id="u1", category="goal",
                content="想参加机器人比赛", confidence=0.8,
            ),
            StudentFact(
                user_id="u1", project_name="P1", knode_id="k10",
                category="knowledge",
                content="理解坡度与下滑速度的关系",
                confidence=0.8,
                fact_metadata={"mastery_level": "understand"},
            ),
            StudentFact(
                user_id="u1", project_name="P1", knode_id="k11",
                category="struggle", content="卡在坐标转换",
                confidence=0.7,
                fact_metadata={"struggle_type": "concept"},
            ),
            StudentFact(
                user_id="u1", project_name="P1", knode_id="k9",
                category="knowledge",
                content="低置信度事实",
                confidence=0.3,  # below threshold
            ),
            StudentFact(
                user_id="u1", project_name="P2", knode_id="k20",
                category="knowledge",
                content="P2 的事实不应进入 P1 的 L3",
                confidence=0.9,
            ),
            Enrollment(
                user_id="u1", project_name="P1", status="active",
                nodes_passed=3, total_nodes=8,
                last_activity_at=datetime(2026, 4, 10, 12, 0),
            ),
            ProgressRecord(
                user_id="u1", project_name="P1", knode_id=10,
                status="passed",
            ),
        ])
        db.commit()
    finally:
        db.close()


class FakeMem0:
    def __init__(self, results=None):
        self.calls: list[dict] = []
        self.results = results or []

    async def search(self, query, *, user_id, filters=None, limit=3):
        self.calls.append({"query": query, "user_id": user_id,
                           "filters": filters, "limit": limit})
        return self.results[:limit]


# ---------------------------------------------------------------------------
# 2 × 2 activation matrix
# ---------------------------------------------------------------------------
class TestProjectScope:
    @pytest.mark.asyncio
    async def test_all_layers_populated(self, session_factory, seeded):
        mem0 = FakeMem0([{"memory": "两周前也聊过坡度问题"}])
        inj = MemoryInjector(session_factory, mem0)

        snap = await inj.inject(
            user_id="u1",
            project_name="P1",
            knode_id="k10",
            last_user_msg="我还是搞不懂坡度为啥影响下滑",
            active_skill_state={"skill_name": "socratic", "turn_count": 2},
            context_scope="project",
        )
        assert snap["l1_profile"]
        assert "机械玩具" in snap["l1_profile"]
        assert snap["l2_project_ctx"]
        assert "3/8" in snap["l2_project_ctx"]
        assert snap["l3_knode_state"]
        # L3 should include multiple knodes within P1 but not P2
        assert "k10" in snap["l3_knode_state"]
        assert "k11" in snap["l3_knode_state"]
        assert "P2" not in snap["l3_knode_state"]
        assert snap["l4_semantic_recall"] == ["两周前也聊过坡度问题"]
        assert snap["l5_skill_ctx"]
        assert "socratic" in snap["l5_skill_ctx"]

    @pytest.mark.asyncio
    async def test_l3_filters_low_confidence(self, session_factory, seeded):
        inj = MemoryInjector(session_factory, mem0_client=None)
        snap = await inj.inject(
            user_id="u1", project_name="P1", knode_id="k10",
            last_user_msg="q", context_scope="project",
        )
        # confidence 0.3 fact should NOT appear
        assert "低置信度事实" not in snap["l3_knode_state"]

    @pytest.mark.asyncio
    async def test_l4_adds_project_filter(self, session_factory, seeded):
        mem0 = FakeMem0()
        inj = MemoryInjector(session_factory, mem0)
        await inj.inject(
            user_id="u1", project_name="P1", knode_id="k10",
            last_user_msg="问题", context_scope="project",
        )
        assert mem0.calls[0]["filters"] == {"project_name": "P1"}


class TestGlobalScope:
    @pytest.mark.asyncio
    async def test_only_l1_and_l4(self, session_factory, seeded):
        mem0 = FakeMem0([{"memory": "跨项目的记忆"}])
        inj = MemoryInjector(session_factory, mem0)
        snap = await inj.inject(
            user_id="u1", project_name=None, knode_id=None,
            last_user_msg="我之前学过什么",
            active_skill_state={"skill_name": "direct"},
            context_scope="global",
        )
        assert snap["l1_profile"]
        assert snap["l4_semantic_recall"] == ["跨项目的记忆"]
        assert snap["l2_project_ctx"] == ""
        assert snap["l3_knode_state"] == ""
        assert snap["l5_skill_ctx"] == ""

    @pytest.mark.asyncio
    async def test_l4_no_project_filter(self, session_factory, seeded):
        mem0 = FakeMem0()
        inj = MemoryInjector(session_factory, mem0)
        await inj.inject(
            user_id="u1", project_name=None, knode_id=None,
            last_user_msg="q", context_scope="global",
        )
        assert mem0.calls[0]["filters"] is None

    @pytest.mark.asyncio
    async def test_project_without_name_downgrades_to_global(
        self, session_factory, seeded,
    ):
        """Project scope with missing project_name must degrade safely."""
        mem0 = FakeMem0()
        inj = MemoryInjector(session_factory, mem0)
        snap = await inj.inject(
            user_id="u1", project_name=None, knode_id="k10",
            last_user_msg="q", context_scope="project",
        )
        assert snap["l2_project_ctx"] == ""
        assert snap["l3_knode_state"] == ""
        # L4 should NOT carry a project_name filter
        assert mem0.calls[0]["filters"] is None


class TestMem0Disabled:
    @pytest.mark.asyncio
    async def test_l4_empty_when_client_none(self, session_factory, seeded):
        inj = MemoryInjector(session_factory, mem0_client=None)
        snap = await inj.inject(
            user_id="u1", project_name="P1", knode_id="k10",
            last_user_msg="q", context_scope="project",
        )
        assert snap["l4_semantic_recall"] == []
        assert snap["l1_profile"]  # others still work

    @pytest.mark.asyncio
    async def test_global_without_mem0_only_l1(self, session_factory, seeded):
        inj = MemoryInjector(session_factory, mem0_client=None)
        snap = await inj.inject(
            user_id="u1", project_name=None, knode_id=None,
            last_user_msg="q", context_scope="global",
        )
        assert snap["l1_profile"]
        assert snap["l2_project_ctx"] == ""
        assert snap["l3_knode_state"] == ""
        assert snap["l4_semantic_recall"] == []
        assert snap["l5_skill_ctx"] == ""


# ---------------------------------------------------------------------------
# Isolation / fault tolerance
# ---------------------------------------------------------------------------
class TestIsolation:
    @pytest.mark.asyncio
    async def test_l4_exception_does_not_break_others(
        self, session_factory, seeded,
    ):
        class BrokenMem0:
            async def search(self, *a, **kw):
                raise RuntimeError("mem0 down")

        inj = MemoryInjector(session_factory, BrokenMem0())
        snap = await inj.inject(
            user_id="u1", project_name="P1", knode_id="k10",
            last_user_msg="q", context_scope="project",
        )
        assert snap["l4_semantic_recall"] == []
        assert snap["l1_profile"]
        assert snap["l3_knode_state"]


# ---------------------------------------------------------------------------
# Concurrency
# ---------------------------------------------------------------------------
class TestConcurrency:
    @pytest.mark.asyncio
    async def test_layers_run_concurrently(self, session_factory, seeded):
        """5 layers each take 100ms — total should be ~100ms, not 500ms."""

        class SlowMem0:
            async def search(self, *a, **kw):
                await asyncio.sleep(0.1)
                return [{"memory": "slow result"}]

        class SlowInjector(MemoryInjector):
            async def _l1_profile(self, user_id):
                await asyncio.sleep(0.1)
                return await super()._l1_profile(user_id)

            async def _l2_project_ctx(self, *a, **kw):
                await asyncio.sleep(0.1)
                return await super()._l2_project_ctx(*a, **kw)

            async def _l3_knode_state(self, *a, **kw):
                await asyncio.sleep(0.1)
                return await super()._l3_knode_state(*a, **kw)

            async def _l5_skill_ctx(self, *a, **kw):
                await asyncio.sleep(0.1)
                return await super()._l5_skill_ctx(*a, **kw)

        inj = SlowInjector(session_factory, SlowMem0())
        start = time.monotonic()
        await inj.inject(
            user_id="u1", project_name="P1", knode_id="k10",
            last_user_msg="q",
            active_skill_state={"skill_name": "x"},
            context_scope="project",
        )
        elapsed = time.monotonic() - start
        # generous: 5× serial = 0.5s; gather should finish in ~0.15s
        assert elapsed < 0.3, f"expected concurrent gather, got {elapsed:.3f}s"


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
class TestRendering:
    def test_render_full_snapshot(self):
        snap = {
            "l1_profile": "- [interest] 机械",
            "l2_project_ctx": "- 项目: P1",
            "l3_knode_state": "- [knowledge@k10] 懂了",
            "l4_semantic_recall": ["上次我们聊过这个"],
            "l5_skill_ctx": "- socratic",
        }
        out = render_memory(snap, l4_top_k=3)
        assert "## L1 学生画像" in out
        assert "机械" in out
        assert "- 上次我们聊过这个" in out

    def test_render_empty_layers(self):
        snap = {}
        out = render_memory(snap)
        assert "(空)" in out
