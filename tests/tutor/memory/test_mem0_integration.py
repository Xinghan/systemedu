"""Tests for Mem0AsyncAdapter + layers.py L4 wiring (spec 014 T2.6).

We mock `systemedu.core.memory.client.retrieve_memories` at module scope so
Mem0 / Qdrant never get imported. The goal is to pin down the contract
between MemoryInjector and retrieve_memories — filter pass-through,
scope-aware filtering, and the "disabled" short-circuit.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.core.storage.db import Base, StudentFact
from systemedu.core.tutor.memory import Mem0AsyncAdapter, MemoryInjector


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def session_factory(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'mem.db'}")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.fixture
def seeded(session_factory):
    """Minimal L1 seed so the injector returns a non-empty snapshot."""
    db = session_factory()
    try:
        db.add(StudentFact(
            user_id="u1", category="interest",
            content="喜欢做机械玩具", confidence=0.9,
        ))
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Adapter contract
# ---------------------------------------------------------------------------
class TestAdapter:
    @pytest.mark.asyncio
    async def test_passes_project_id_to_client(self):
        adapter = Mem0AsyncAdapter()
        with patch(
            "systemedu.core.tutor.memory.mem0_adapter.retrieve_memories",
            return_value=["片段1", "片段2"],
        ) as mock:
            out = await adapter.search(
                "我之前学过什么",
                user_id="u1",
                filters={"project_name": "P1"},
                limit=3,
            )
        mock.assert_called_once_with(
            user_id="u1",
            query="我之前学过什么",
            project_id="P1",
            limit=3,
        )
        assert out == [{"memory": "片段1"}, {"memory": "片段2"}]

    @pytest.mark.asyncio
    async def test_no_filters_passes_none(self):
        adapter = Mem0AsyncAdapter()
        with patch(
            "systemedu.core.tutor.memory.mem0_adapter.retrieve_memories",
            return_value=[],
        ) as mock:
            await adapter.search("q", user_id="u1", filters=None, limit=3)
        call = mock.call_args.kwargs
        assert call["project_id"] is None

    @pytest.mark.asyncio
    async def test_empty_results_returns_empty_list(self):
        adapter = Mem0AsyncAdapter()
        with patch(
            "systemedu.core.tutor.memory.mem0_adapter.retrieve_memories",
            return_value=[],
        ):
            out = await adapter.search("q", user_id="u1")
        assert out == []

    @pytest.mark.asyncio
    async def test_accepts_legacy_project_id_key(self):
        """Tolerate both project_name and project_id keys in filters."""
        adapter = Mem0AsyncAdapter()
        with patch(
            "systemedu.core.tutor.memory.mem0_adapter.retrieve_memories",
            return_value=[],
        ) as mock:
            await adapter.search(
                "q", user_id="u1", filters={"project_id": "P1"},
            )
        assert mock.call_args.kwargs["project_id"] == "P1"


# ---------------------------------------------------------------------------
# End-to-end: MemoryInjector + adapter
# ---------------------------------------------------------------------------
class TestInjectorWithAdapter:
    @pytest.mark.asyncio
    async def test_project_scope_filters_by_project(
        self, session_factory, seeded,
    ):
        adapter = Mem0AsyncAdapter()
        with patch(
            "systemedu.core.tutor.memory.mem0_adapter.retrieve_memories",
            return_value=["只有 P1 的记忆"],
        ) as mock:
            inj = MemoryInjector(session_factory, adapter)
            snap = await inj.inject(
                user_id="u1", project_name="P1", knode_id="k10",
                last_user_msg="上次学了什么",
                context_scope="project",
            )
        assert snap["l4_semantic_recall"] == ["只有 P1 的记忆"]
        call = mock.call_args.kwargs
        assert call["project_id"] == "P1"

    @pytest.mark.asyncio
    async def test_global_scope_unfiltered(self, session_factory, seeded):
        adapter = Mem0AsyncAdapter()
        with patch(
            "systemedu.core.tutor.memory.mem0_adapter.retrieve_memories",
            return_value=["跨项目的记忆"],
        ) as mock:
            inj = MemoryInjector(session_factory, adapter)
            snap = await inj.inject(
                user_id="u1", project_name=None, knode_id=None,
                last_user_msg="我以前学什么",
                context_scope="global",
            )
        assert snap["l4_semantic_recall"] == ["跨项目的记忆"]
        assert mock.call_args.kwargs["project_id"] is None

    @pytest.mark.asyncio
    async def test_mem0_disabled_via_client_returns_empty(
        self, session_factory, seeded,
    ):
        """retrieve_memories returns [] when config.memory.enabled is false.

        We simulate that by making the patched function return [].
        """
        adapter = Mem0AsyncAdapter()
        with patch(
            "systemedu.core.tutor.memory.mem0_adapter.retrieve_memories",
            return_value=[],
        ):
            inj = MemoryInjector(session_factory, adapter)
            snap = await inj.inject(
                user_id="u1", project_name="P1", knode_id="k10",
                last_user_msg="q",
                context_scope="project",
            )
        assert snap["l4_semantic_recall"] == []
        assert snap["l1_profile"]  # rest of pipeline unaffected

    @pytest.mark.asyncio
    async def test_mem0_client_none_short_circuits(
        self, session_factory, seeded,
    ):
        """When the injector is built without a mem0_client, don't even try."""
        with patch(
            "systemedu.core.tutor.memory.mem0_adapter.retrieve_memories",
        ) as mock:
            inj = MemoryInjector(session_factory, mem0_client=None)
            snap = await inj.inject(
                user_id="u1", project_name="P1", knode_id="k10",
                last_user_msg="q",
                context_scope="project",
            )
        mock.assert_not_called()
        assert snap["l4_semantic_recall"] == []
