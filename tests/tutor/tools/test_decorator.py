"""Tests for @tutor_tool decorator (T4.1).

Covers the three guarantees from design §8.2:
- ContextVar is required — tools refuse to run without one
- LLM-supplied user_id / session_id are overridden by the ContextVar
- `confirm=True` tools return `pending_confirm` on the first call and
  actually execute only when ctx.approved is True
"""

from __future__ import annotations

import asyncio

import pytest

from systemedu.core.tutor.tools.decorator import (
    ToolContext,
    ToolMeta,
    current_tool_context,
    get_tool_meta,
    push_tool_context,
    require_tool_context,
    tutor_tool,
)


# ---------------------------------------------------------------------------
# Test tools
# ---------------------------------------------------------------------------
@tutor_tool(access="read", scope="user_self", description="Echo the ctx")
async def _echo_ctx(note: str = "") -> dict:
    ctx = require_tool_context()
    return {
        "user_id": ctx.user_id,
        "session_id": ctx.session_id,
        "active_skill": ctx.active_skill,
        "note": note,
    }


_mark_done_side_effects: list[tuple[str, str]] = []


@tutor_tool(access="write", confirm=True, scope="user_self")
async def _mark_done(knode_id: str) -> dict:
    ctx = require_tool_context()
    # Body only runs after approval. Record the side effect for assertions.
    _mark_done_side_effects.append((ctx.user_id, knode_id))
    return {"ok": True, "knode_id": knode_id, "user_id": ctx.user_id}


@tutor_tool(access="read")
async def _boom() -> dict:
    raise RuntimeError("kaboom")


@tutor_tool()
async def _no_args() -> str:
    return "ok"


# ---------------------------------------------------------------------------
# ContextVar plumbing
# ---------------------------------------------------------------------------
class TestContextVar:
    async def test_outside_push_context_raises(self):
        """No push_tool_context → tool must not execute."""
        with pytest.raises(RuntimeError, match="outside push_tool_context"):
            await _echo_ctx.ainvoke({})

    async def test_current_tool_context_none_by_default(self):
        assert current_tool_context() is None

    async def test_push_sets_and_resets(self):
        ctx = ToolContext(user_id="u1")
        assert current_tool_context() is None
        with push_tool_context(ctx):
            assert current_tool_context() is ctx
        assert current_tool_context() is None

    async def test_nested_push_restores_outer(self):
        outer = ToolContext(user_id="outer")
        inner = ToolContext(user_id="inner")
        with push_tool_context(outer):
            assert current_tool_context() is outer
            with push_tool_context(inner):
                assert current_tool_context() is inner
            assert current_tool_context() is outer


# ---------------------------------------------------------------------------
# Reserved-arg stripping
# ---------------------------------------------------------------------------
class TestReservedArgs:
    async def test_llm_user_id_is_discarded(self):
        """Any user_id / session_id the LLM sends must be ignored —
        the ContextVar's value is authoritative."""
        ctx = ToolContext(user_id="u-real", session_id="s-real")
        with push_tool_context(ctx):
            out = await _echo_ctx.ainvoke(
                {"note": "hi", "user_id": "u-fake", "session_id": "s-fake"}
            )
        assert out["user_id"] == "u-real"
        assert out["session_id"] == "s-real"
        assert out["note"] == "hi"


# ---------------------------------------------------------------------------
# Confirm flow
# ---------------------------------------------------------------------------
class TestConfirmFlow:
    async def test_first_call_returns_pending(self):
        ctx = ToolContext(user_id="u1", session_id="s1")
        before = len(_mark_done_side_effects)  # type: ignore[attr-defined]
        with push_tool_context(ctx):
            out = await _mark_done.ainvoke({"knode_id": "k-1"})
        assert out["action"] == "pending_confirm"
        assert out["tool"] == "_mark_done"
        assert out["args"] == {"knode_id": "k-1"}
        assert out["user_id"] == "u1"
        assert out["confirm_id"].startswith("c-")
        # Body never ran.
        assert len(_mark_done_side_effects) == before  # type: ignore[attr-defined]

    async def test_second_call_with_approved_runs(self):
        ctx = ToolContext(user_id="u2", session_id="s2", approved=True)
        before = len(_mark_done_side_effects)  # type: ignore[attr-defined]
        with push_tool_context(ctx):
            out = await _mark_done.ainvoke({"knode_id": "k-7"})
        assert out == {"ok": True, "knode_id": "k-7", "user_id": "u2"}
        assert _mark_done_side_effects[before:] == [("u2", "k-7")]  # type: ignore[attr-defined]

    async def test_approved_false_still_pending(self):
        """approved=False means the user rejected — treat it the same
        as an unapproved first call from the tool's POV (confirm_handler
        is the one that short-circuits the reply, not the tool)."""
        ctx = ToolContext(user_id="u3", approved=False)
        before = len(_mark_done_side_effects)  # type: ignore[attr-defined]
        with push_tool_context(ctx):
            out = await _mark_done.ainvoke({"knode_id": "k-x"})
        assert out["action"] == "pending_confirm"
        assert len(_mark_done_side_effects) == before  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# Meta & LangChain shape
# ---------------------------------------------------------------------------
class TestMetaAttached:
    def test_meta_present(self):
        meta = get_tool_meta(_echo_ctx)
        assert isinstance(meta, ToolMeta)
        assert meta.name == "_echo_ctx"
        assert meta.access == "read"
        assert meta.confirm is False

    def test_meta_confirm_tool(self):
        meta = get_tool_meta(_mark_done)
        assert meta is not None
        assert meta.confirm is True
        assert meta.access == "write"

    def test_tool_name_matches_function(self):
        assert _echo_ctx.name == "_echo_ctx"
        assert _mark_done.name == "_mark_done"

    def test_reserved_args_tuple(self):
        meta = get_tool_meta(_echo_ctx)
        assert meta is not None
        assert meta.reserved_args == ("user_id", "session_id")


# ---------------------------------------------------------------------------
# Decorator guards
# ---------------------------------------------------------------------------
class TestDecoratorGuards:
    def test_sync_function_rejected(self):
        with pytest.raises(TypeError, match="must be an async function"):
            @tutor_tool()
            def _sync():
                return "no"

    async def test_no_args_tool_runs(self):
        ctx = ToolContext(user_id="u-x")
        with push_tool_context(ctx):
            out = await _no_args.ainvoke({})
        assert out == "ok"


# ---------------------------------------------------------------------------
# Audit sink
# ---------------------------------------------------------------------------
class TestAuditSink:
    async def test_successful_call_logged(self):
        records: list[dict] = []

        def sink(rec):
            records.append(rec)

        ctx = ToolContext(user_id="u1", session_id="s1", log_sink=sink)
        with push_tool_context(ctx):
            await _echo_ctx.ainvoke({"note": "hi"})
        assert len(records) == 1
        r = records[0]
        assert r["tool_name"] == "_echo_ctx"
        assert r["user_id"] == "u1"
        assert r["approved"] is None  # non-confirm tool
        assert r["error"] is None
        assert r["latency_ms"] >= 0

    async def test_error_recorded(self):
        records: list[dict] = []
        ctx = ToolContext(user_id="u1", log_sink=records.append)
        with push_tool_context(ctx):
            with pytest.raises(RuntimeError, match="kaboom"):
                await _boom.ainvoke({})
        assert len(records) == 1
        assert records[0]["error"] == "RuntimeError: kaboom"
        assert records[0]["result"] is None

    async def test_confirm_pending_logged_with_approved_none(self):
        records: list[dict] = []
        ctx = ToolContext(user_id="u1", log_sink=records.append)
        with push_tool_context(ctx):
            await _mark_done.ainvoke({"knode_id": "k-1"})
        assert len(records) == 1
        assert records[0]["approved"] is None
        assert records[0]["result"]["action"] == "pending_confirm"

    async def test_confirm_approved_logged_with_approved_true(self):
        records: list[dict] = []
        ctx = ToolContext(user_id="u1", approved=True, log_sink=records.append)
        with push_tool_context(ctx):
            await _mark_done.ainvoke({"knode_id": "k-2"})
        assert len(records) == 1
        assert records[0]["approved"] is True

    async def test_async_sink_is_fired(self):
        """An async sink must be scheduled, not silently dropped."""
        done = asyncio.Event()
        seen: list[dict] = []

        async def sink(rec):
            seen.append(rec)
            done.set()

        ctx = ToolContext(user_id="u1", log_sink=sink)
        with push_tool_context(ctx):
            await _echo_ctx.ainvoke({"note": "x"})
        await asyncio.wait_for(done.wait(), timeout=1.0)
        assert len(seen) == 1
