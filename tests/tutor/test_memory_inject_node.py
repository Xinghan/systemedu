"""Tests for `memory_inject` node wiring (spec 014 T2.7).

Checks that the node pulls the right pieces out of TutorState,
chooses the correct scope, and writes a MemorySnapshot back. We use
a fake `MemoryInjector` that just records inputs, so these tests
don't touch the DB — that's already covered by test_layers.py.

We also run one end-to-end pass through `build_tutor_graph` to make
sure the wired node doesn't break graph compilation or execution.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.tutor.graph import build_tutor_graph
from systemedu.tutor.nodes import make_memory_inject_node, memory_inject_node
from systemedu.tutor.state import MemorySnapshot, TutorState


@dataclass
class FakeInjector:
    """Minimal stand-in for MemoryInjector — records calls, returns a fixed snapshot."""

    snapshot: MemorySnapshot = field(
        default_factory=lambda: MemorySnapshot(
            l1_profile="L1",
            l2_project_ctx="L2",
            l3_knode_state="L3",
            l4_semantic_recall=["M1"],
            l5_skill_ctx="L5",
            injected_at=datetime(2026, 4, 16, 12, 0, 0),
        )
    )
    calls: list[dict[str, Any]] = field(default_factory=list)

    async def inject(self, **kwargs: Any) -> MemorySnapshot:
        self.calls.append(kwargs)
        return self.snapshot


# ---------------------------------------------------------------------------
# Scope resolution
# ---------------------------------------------------------------------------
class TestScopeResolution:
    @pytest.mark.asyncio
    async def test_defaults_project_when_project_name_set(self):
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        await node(TutorState(
            user_id="u1", project_name="P1", knode_id="k10",
            messages=[HumanMessage(content="你好")],
        ))
        assert fake.calls[0]["context_scope"] == "project"

    @pytest.mark.asyncio
    async def test_defaults_global_when_no_project(self):
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        await node(TutorState(
            user_id="u1",
            messages=[HumanMessage(content="我是新来的")],
        ))
        assert fake.calls[0]["context_scope"] == "global"

    @pytest.mark.asyncio
    async def test_active_tab_overrides_default(self):
        """Gateway can force a scope via state.active_tab (T5.1 payload)."""
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        await node(TutorState(
            user_id="u1", project_name="P1",
            active_tab="global",  # force global despite project_name
            messages=[HumanMessage(content="hi")],
        ))
        assert fake.calls[0]["context_scope"] == "global"

    @pytest.mark.asyncio
    async def test_unknown_active_tab_falls_back(self):
        """An unknown active_tab value shouldn't poison the scope."""
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        await node(TutorState(
            user_id="u1", project_name="P1",
            active_tab="hub",  # not a valid scope
            messages=[HumanMessage(content="hi")],
        ))
        assert fake.calls[0]["context_scope"] == "project"


# ---------------------------------------------------------------------------
# Last-message extraction
# ---------------------------------------------------------------------------
class TestLastUserMessage:
    @pytest.mark.asyncio
    async def test_picks_latest_human_message(self):
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        await node(TutorState(
            user_id="u1", project_name="P1",
            messages=[
                HumanMessage(content="第一条"),
                AIMessage(content="AI 回复"),
                HumanMessage(content="第二条最新"),
            ],
        ))
        assert fake.calls[0]["last_user_msg"] == "第二条最新"

    @pytest.mark.asyncio
    async def test_no_human_message_returns_empty(self):
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        await node(TutorState(
            user_id="u1", project_name="P1",
            messages=[AIMessage(content="仅 AI")],
        ))
        assert fake.calls[0]["last_user_msg"] == ""

    @pytest.mark.asyncio
    async def test_no_messages_at_all(self):
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        await node(TutorState(user_id="u1", project_name="P1"))
        assert fake.calls[0]["last_user_msg"] == ""


# ---------------------------------------------------------------------------
# State wiring
# ---------------------------------------------------------------------------
class TestStateWiring:
    @pytest.mark.asyncio
    async def test_forwards_skill_state(self):
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        skill_state = {"skill_name": "socratic", "turn_count": 3}
        await node(TutorState(
            user_id="u1", project_name="P1", skill_state=skill_state,
            messages=[HumanMessage(content="q")],
        ))
        assert fake.calls[0]["active_skill_state"] == skill_state

    @pytest.mark.asyncio
    async def test_empty_skill_state_becomes_none(self):
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        await node(TutorState(
            user_id="u1", project_name="P1", skill_state={},
            messages=[HumanMessage(content="q")],
        ))
        # {} is falsy — normalize to None so L5 short-circuits cleanly
        assert fake.calls[0]["active_skill_state"] is None

    @pytest.mark.asyncio
    async def test_returns_memory_snapshot(self):
        fake = FakeInjector()
        node = make_memory_inject_node(fake)
        update = await node(TutorState(
            user_id="u1", project_name="P1",
            messages=[HumanMessage(content="q")],
        ))
        assert update["memory"] is fake.snapshot
        assert update["memory"]["l4_semantic_recall"] == ["M1"]


# ---------------------------------------------------------------------------
# Fallbacks
# ---------------------------------------------------------------------------
class TestNoInjector:
    @pytest.mark.asyncio
    async def test_none_injector_returns_empty_snapshot(self):
        node = make_memory_inject_node(None)
        update = await node(TutorState(
            user_id="u1", project_name="P1",
            messages=[HumanMessage(content="q")],
        ))
        snap = update["memory"]
        assert snap["l1_profile"] == ""
        assert snap["l4_semantic_recall"] == []
        assert isinstance(snap["injected_at"], datetime)

    @pytest.mark.asyncio
    async def test_legacy_compat_node_still_works(self):
        """`memory_inject_node` (no args) stays importable for Phase-1 tests."""
        update = await memory_inject_node(TutorState(
            user_id="u1",
            messages=[HumanMessage(content="q")],
        ))
        assert update["memory"]["l4_semantic_recall"] == []


# ---------------------------------------------------------------------------
# End-to-end through compiled graph
# ---------------------------------------------------------------------------
class TestGraphIntegration:
    @pytest.mark.asyncio
    async def test_injector_wired_through_build_tutor_graph(self):
        fake = FakeInjector()
        app = build_tutor_graph(memory_injector=fake)
        out = await app.ainvoke(TutorState(
            user_id="u1", project_name="P1", knode_id="k10",
            messages=[HumanMessage(content="上次学了什么")],
        ))
        assert fake.calls, "injector should have been called by memory_inject node"
        assert out["memory"]["l1_profile"] == "L1"
        assert isinstance(out["memory"]["injected_at"], datetime)

    @pytest.mark.asyncio
    async def test_graph_without_injector_still_compiles(self):
        """Smoke test: no DB / Mem0 wired in — graph should still run."""
        app = build_tutor_graph()  # no memory_injector
        out = await app.ainvoke(TutorState(
            user_id="u1",
            messages=[HumanMessage(content="hi")],
        ))
        assert out["memory"]["l4_semantic_recall"] == []
