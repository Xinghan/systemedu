"""Tests for ToolCallLog DAO + decorator integration (T4.4).

Covers:
- log_call writes a row with correct fields
- confirm tool: pending row (approved=None) then approved=True row
- error in tool body: error field populated, latency_ms still present
- make_log_sink wires into decorator via ToolContext.log_sink
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.core.storage.db import Base, ToolCallLog
from systemedu.core.tutor.audit.tool_call_log import ToolCallLogDAO, make_log_sink
from systemedu.core.tutor.tools.decorator import (
    ToolContext,
    push_tool_context,
    require_tool_context,
    tutor_tool,
)


@pytest.fixture()
def db_session(tmp_path):
    """In-memory SQLite session with tool_call_log table."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    yield session
    session.close()


@pytest.fixture()
def dao(db_session):
    return ToolCallLogDAO(db_session)


# ---------------------------------------------------------------------------
# DAO unit tests
# ---------------------------------------------------------------------------
class TestLogCall:
    def test_basic_write(self, dao, db_session):
        row = dao.log_call(
            user_id="u1",
            session_id="s1",
            active_skill="socratic",
            tool_name="get_progress",
            args={"project": "mars"},
            result={"pct": 42},
            latency_ms=12,
        )
        assert row.id is not None
        assert row.user_id == "u1"
        assert row.tool_name == "get_progress"
        assert row.args_json == {"project": "mars"}
        assert row.result_json == {"pct": 42}
        assert row.approved is None
        assert row.latency_ms == 12
        assert row.error is None

    def test_confirm_pending_then_approved(self, dao, db_session):
        dao.log_call(
            user_id="u1",
            session_id="s1",
            tool_name="complete_node",
            args={"knode_id": "k-1"},
            result={"action": "pending_confirm"},
            approved=None,
            latency_ms=0,
        )
        dao.log_call(
            user_id="u1",
            session_id="s1",
            tool_name="complete_node",
            args={"knode_id": "k-1"},
            result={"ok": True},
            approved=True,
            latency_ms=45,
        )
        rows = dao.list_by_session("s1")
        assert len(rows) == 2
        assert rows[0].approved is None
        assert rows[1].approved is True

    def test_error_recorded(self, dao):
        row = dao.log_call(
            user_id="u1",
            tool_name="boom",
            error="RuntimeError: kaboom",
            latency_ms=3,
        )
        assert row.error == "RuntimeError: kaboom"
        assert row.latency_ms == 3

    def test_list_by_user(self, dao):
        dao.log_call(user_id="u1", tool_name="a")
        dao.log_call(user_id="u1", tool_name="b")
        dao.log_call(user_id="u2", tool_name="c")
        assert len(dao.list_by_user("u1")) == 2
        assert len(dao.list_by_user("u2")) == 1

    def test_list_by_user_with_tool_filter(self, dao):
        dao.log_call(user_id="u1", tool_name="a")
        dao.log_call(user_id="u1", tool_name="b")
        assert len(dao.list_by_user("u1", tool_name="a")) == 1

    def test_non_serialisable_result_coerced(self, dao):
        row = dao.log_call(
            user_id="u1",
            tool_name="x",
            result=object(),
        )
        assert isinstance(row.result_json, str)


# ---------------------------------------------------------------------------
# make_log_sink integration with decorator
# ---------------------------------------------------------------------------
class TestMakeLogSink:
    async def test_sink_wired_into_decorator(self, tmp_path):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        @tutor_tool(access="read")
        async def _ping(msg: str = "hi") -> str:
            return f"pong:{msg}"

        sink = make_log_sink(factory)
        ctx = ToolContext(user_id="u-alice", session_id="s-99", log_sink=sink)
        with push_tool_context(ctx):
            out = await _ping.ainvoke({"msg": "test"})

        assert out == "pong:test"
        db = factory()
        rows = db.query(ToolCallLog).all()
        assert len(rows) == 1
        assert rows[0].user_id == "u-alice"
        assert rows[0].session_id == "s-99"
        assert rows[0].tool_name == "_ping"
        assert rows[0].error is None
        db.close()

    async def test_sink_records_error(self, tmp_path):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        @tutor_tool()
        async def _fail() -> str:
            raise ValueError("nope")

        sink = make_log_sink(factory)
        ctx = ToolContext(user_id="u1", log_sink=sink)
        with push_tool_context(ctx):
            with pytest.raises(ValueError, match="nope"):
                await _fail.ainvoke({})

        db = factory()
        rows = db.query(ToolCallLog).all()
        assert len(rows) == 1
        assert rows[0].error == "ValueError: nope"
        db.close()

    async def test_confirm_flow_two_rows(self, tmp_path):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)

        @tutor_tool(access="write", confirm=True)
        async def _write_thing(x: str) -> dict:
            return {"wrote": x}

        sink = make_log_sink(factory)

        ctx1 = ToolContext(user_id="u1", session_id="s1", log_sink=sink)
        with push_tool_context(ctx1):
            r1 = await _write_thing.ainvoke({"x": "data"})
        assert r1["action"] == "pending_confirm"

        ctx2 = ToolContext(user_id="u1", session_id="s1", approved=True, log_sink=sink)
        with push_tool_context(ctx2):
            r2 = await _write_thing.ainvoke({"x": "data"})
        assert r2 == {"wrote": "data"}

        db = factory()
        rows = db.query(ToolCallLog).order_by(ToolCallLog.id).all()
        assert len(rows) == 2
        assert rows[0].approved is None
        assert rows[1].approved is True
        db.close()
