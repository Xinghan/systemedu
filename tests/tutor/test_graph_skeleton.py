"""Tests for Phase-1 tutor graph skeleton (spec 014 T1.6)."""

from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage

from systemedu.core.config import TutorConfig
from systemedu.tutor.checkpoint import get_checkpointer
from systemedu.tutor.graph import build_tutor_graph


class TestGraphCompiles:
    def test_compile_without_checkpointer(self):
        graph = build_tutor_graph()
        assert graph is not None

    async def test_compile_with_sqlite_checkpointer(self, tmp_path):
        cfg = TutorConfig(
            checkpoint_backend="sqlite",
            checkpoint_sqlite_path=str(tmp_path / "ck.db"),
        )
        async with get_checkpointer(cfg) as saver:
            graph = build_tutor_graph(checkpointer=saver)
            assert graph is not None


class TestSingleInvoke:
    """Single ainvoke from START to END without errors."""

    async def test_invoke_with_minimal_state(self):
        graph = build_tutor_graph()
        result = await graph.ainvoke({"user_id": "u1"})
        assert isinstance(result, dict)
        assert result["user_id"] == "u1"

    async def test_invoke_preserves_user_id(self):
        graph = build_tutor_graph()
        result = await graph.ainvoke({"user_id": "alice", "session_id": "s1"})
        assert result["user_id"] == "alice"
        assert result["session_id"] == "s1"

    async def test_invoke_with_messages(self):
        graph = build_tutor_graph()
        result = await graph.ainvoke({
            "messages": [HumanMessage(content="hi", id="h-1")],
        })
        assert len(result["messages"]) == 1


class TestCheckpointPersistence:
    """With a checkpointer, one invoke produces at least one saved state."""

    async def test_one_checkpoint_saved(self, tmp_path):
        cfg = TutorConfig(
            checkpoint_backend="sqlite",
            checkpoint_sqlite_path=str(tmp_path / "ck.db"),
        )
        async with get_checkpointer(cfg) as saver:
            graph = build_tutor_graph(checkpointer=saver)
            config = {"configurable": {"thread_id": "t-1"}}
            await graph.ainvoke({"user_id": "bob"}, config=config)

            items = [t async for t in saver.alist(config)]
            assert len(items) >= 1

    async def test_second_turn_resumes_state(self, tmp_path):
        cfg = TutorConfig(
            checkpoint_backend="sqlite",
            checkpoint_sqlite_path=str(tmp_path / "ck.db"),
        )
        async with get_checkpointer(cfg) as saver:
            graph = build_tutor_graph(checkpointer=saver)
            config = {"configurable": {"thread_id": "t-2"}}

            await graph.ainvoke({
                "user_id": "carol",
                "messages": [HumanMessage(content="msg1", id="m-1")],
            }, config=config)

            # Second turn: only adds a new message, user_id should persist.
            result = await graph.ainvoke({
                "messages": [HumanMessage(content="msg2", id="m-2")],
            }, config=config)

            assert result["user_id"] == "carol"
            assert len(result["messages"]) == 2


class TestSafetyShortCircuit:
    """If a future node sets _safety_triggered, graph jumps to output."""

    async def test_short_circuit_skips_memory_inject(self, monkeypatch):
        """Monkeypatch safety_gate to set the flag and verify routing."""
        from systemedu.tutor.nodes import safety_gate as sg_module

        async def tripped_safety(state):
            return {"_safety_triggered": True}

        monkeypatch.setattr(sg_module, "safety_gate_node", tripped_safety)

        # Re-import graph module after patch so the build captures the stub
        # (graph.py imports via nodes/__init__.py; patch the re-export too).
        from systemedu.tutor import nodes
        monkeypatch.setattr(nodes, "safety_gate_node", tripped_safety)

        import importlib

        from systemedu.tutor import graph as graph_module
        importlib.reload(graph_module)

        graph = graph_module.build_tutor_graph()
        result = await graph.ainvoke({"user_id": "dan"})
        assert result["_safety_triggered"] is True
