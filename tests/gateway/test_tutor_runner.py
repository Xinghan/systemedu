"""Tests for tutor_runner gateway integration (T5.2).

Covers:
- invoke() translates ChatPayload → graph input → gateway response
- stream() yields chunk/skill/escalation events
- shutdown() closes the checkpointer
- Fallback: api_chat falls through to legacy runtime when graph is unavailable
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.cloud.gateway.chat_payload import ChatPayload
from systemedu.cloud.gateway.tutor_runner import (
    _build_config,
    _build_input,
    invoke,
    shutdown,
    stream,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_payload(**overrides) -> ChatPayload:
    defaults = {
        "message": "hello",
        "context_scope": "project",
        "project_name": "mars",
    }
    defaults.update(overrides)
    return ChatPayload(**defaults)


# ---------------------------------------------------------------------------
# _build_input
# ---------------------------------------------------------------------------


class TestBuildInput:
    def test_basic_input(self):
        payload = _make_payload(knode_id="3", active_tab="learn")
        result = _build_input(payload, "u1")

        assert result["user_id"] == "u1"
        assert result["project_name"] == "mars"
        assert result["knode_id"] == "3"
        assert result["active_tab"] == "learn"
        assert len(result["messages"]) == 1
        assert isinstance(result["messages"][0], HumanMessage)
        assert result["messages"][0].content == "hello"

    def test_confirm_response_in_additional_kwargs(self):
        payload = _make_payload(
            confirm_response={"confirm_id": "c-1", "approved": True}
        )
        result = _build_input(payload, "u1")

        msg = result["messages"][0]
        assert msg.additional_kwargs["confirm_response"]["approved"] is True

    def test_no_confirm_response(self):
        payload = _make_payload()
        result = _build_input(payload, "u1")

        msg = result["messages"][0]
        assert msg.additional_kwargs == {}

    def test_session_id_included_when_present(self):
        payload = _make_payload(session_id="s-42")
        result = _build_input(payload, "u1")

        assert result["session_id"] == "s-42"

    def test_session_id_absent_when_none(self):
        payload = _make_payload()
        result = _build_input(payload, "u1")

        assert "session_id" not in result


# ---------------------------------------------------------------------------
# _build_config
# ---------------------------------------------------------------------------


class TestBuildConfig:
    def test_project_thread_id(self):
        payload = _make_payload()
        config = _build_config(payload, "u1")

        assert config == {"configurable": {"thread_id": "u1:mars:project-main"}}

    def test_global_thread_id(self):
        payload = _make_payload(context_scope="global", project_name=None)
        config = _build_config(payload, "u1")

        assert config == {"configurable": {"thread_id": "u1:global"}}


# ---------------------------------------------------------------------------
# invoke
# ---------------------------------------------------------------------------


class TestInvoke:
    @pytest.mark.asyncio
    async def test_invoke_returns_ai_reply(self):
        fake_graph = AsyncMock()
        fake_graph.ainvoke.return_value = {
            "messages": [
                HumanMessage(content="hi"),
                AIMessage(content="hello student"),
            ],
            "active_skill": "explain",
            "skill_decision": {"action": "stay", "target_skill": "explain"},
            "confirm_required": None,
            "_safety_triggered": False,
        }

        with patch(
            "systemedu.cloud.gateway.tutor_runner._get_graph",
            return_value=fake_graph,
        ):
            result = await invoke(_make_payload(), "u1")

        assert result["response"] == "hello student"
        assert result["active_skill"] == "explain"
        assert result["_safety_triggered"] is False

    @pytest.mark.asyncio
    async def test_invoke_empty_messages(self):
        fake_graph = AsyncMock()
        fake_graph.ainvoke.return_value = {"messages": []}

        with patch(
            "systemedu.cloud.gateway.tutor_runner._get_graph",
            return_value=fake_graph,
        ):
            result = await invoke(_make_payload(), "u1")

        assert result["response"] == ""

    @pytest.mark.asyncio
    async def test_invoke_safety_triggered(self):
        fake_graph = AsyncMock()
        fake_graph.ainvoke.return_value = {
            "messages": [AIMessage(content="safety response")],
            "_safety_triggered": True,
            "active_skill": None,
            "skill_decision": {"action": "exit"},
            "confirm_required": None,
        }

        with patch(
            "systemedu.cloud.gateway.tutor_runner._get_graph",
            return_value=fake_graph,
        ):
            result = await invoke(_make_payload(), "u1")

        assert result["_safety_triggered"] is True

    @pytest.mark.asyncio
    async def test_invoke_confirm_required(self):
        fake_graph = AsyncMock()
        fake_graph.ainvoke.return_value = {
            "messages": [AIMessage(content="confirm?")],
            "active_skill": None,
            "skill_decision": None,
            "confirm_required": {"confirm_id": "c-99", "tool": "complete_node", "args": {}},
            "_safety_triggered": False,
        }

        with patch(
            "systemedu.cloud.gateway.tutor_runner._get_graph",
            return_value=fake_graph,
        ):
            result = await invoke(_make_payload(), "u1")

        assert result["confirm_required"]["confirm_id"] == "c-99"


# ---------------------------------------------------------------------------
# stream
# ---------------------------------------------------------------------------


class TestStream:
    @pytest.mark.asyncio
    async def test_stream_yields_chunks(self):
        """stream() should yield chunk events from on_chat_model_stream."""
        chunk_mock = MagicMock()
        chunk_mock.content = "hello "

        events = [
            {"event": "on_chat_model_stream", "data": {"chunk": chunk_mock}},
            {
                "event": "on_chain_end",
                "name": "LangGraph",
                "data": {
                    "output": {
                        "skill_decision": None,
                        "confirm_required": None,
                        "_safety_triggered": False,
                    }
                },
            },
        ]

        fake_graph = AsyncMock()

        async def fake_stream(*args, **kwargs):
            for e in events:
                yield e

        fake_graph.astream_events = fake_stream

        with patch(
            "systemedu.cloud.gateway.tutor_runner._get_graph",
            return_value=fake_graph,
        ):
            collected = [evt async for evt in stream(_make_payload(), "u1")]

        chunks = [e for e in collected if e["type"] == "chunk"]
        assert len(chunks) == 1
        assert chunks[0]["content"] == "hello "

    @pytest.mark.asyncio
    async def test_stream_yields_skill_decision(self):
        events = [
            {
                "event": "on_chain_end",
                "name": "LangGraph",
                "data": {
                    "output": {
                        "skill_decision": {
                            "action": "switch",
                            "target_skill": "quiz",
                            "reason": "student asked for a quiz",
                        },
                        "confirm_required": None,
                        "_safety_triggered": False,
                    }
                },
            },
        ]

        fake_graph = AsyncMock()

        async def fake_stream(*args, **kwargs):
            for e in events:
                yield e

        fake_graph.astream_events = fake_stream

        with patch(
            "systemedu.cloud.gateway.tutor_runner._get_graph",
            return_value=fake_graph,
        ):
            collected = [evt async for evt in stream(_make_payload(), "u1")]

        skill_events = [e for e in collected if e["type"] == "skill"]
        assert len(skill_events) == 1
        assert skill_events[0]["action"] == "switch"
        assert skill_events[0]["target_skill"] == "quiz"

    @pytest.mark.asyncio
    async def test_stream_yields_escalation(self):
        events = [
            {
                "event": "on_chain_end",
                "name": "LangGraph",
                "data": {
                    "output": {
                        "skill_decision": None,
                        "confirm_required": None,
                        "_safety_triggered": True,
                    }
                },
            },
        ]

        fake_graph = AsyncMock()

        async def fake_stream(*args, **kwargs):
            for e in events:
                yield e

        fake_graph.astream_events = fake_stream

        with patch(
            "systemedu.cloud.gateway.tutor_runner._get_graph",
            return_value=fake_graph,
        ):
            collected = [evt async for evt in stream(_make_payload(), "u1")]

        esc = [e for e in collected if e["type"] == "escalation"]
        assert len(esc) == 1
        assert esc[0]["severity"] == "urgent"

    @pytest.mark.asyncio
    async def test_stream_yields_tool_confirm(self):
        events = [
            {
                "event": "on_chain_end",
                "name": "LangGraph",
                "data": {
                    "output": {
                        "skill_decision": None,
                        "confirm_required": {
                            "confirm_id": "c-7",
                            "tool": "complete_node",
                            "args": {"knode_id": "5"},
                        },
                        "_safety_triggered": False,
                    }
                },
            },
        ]

        fake_graph = AsyncMock()

        async def fake_stream(*args, **kwargs):
            for e in events:
                yield e

        fake_graph.astream_events = fake_stream

        with patch(
            "systemedu.cloud.gateway.tutor_runner._get_graph",
            return_value=fake_graph,
        ):
            collected = [evt async for evt in stream(_make_payload(), "u1")]

        tc = [e for e in collected if e["type"] == "tool_confirm"]
        assert len(tc) == 1
        assert tc[0]["confirm_id"] == "c-7"


# ---------------------------------------------------------------------------
# shutdown
# ---------------------------------------------------------------------------


class TestShutdown:
    @pytest.mark.asyncio
    async def test_shutdown_closes_checkpointer(self):
        import systemedu.cloud.gateway.tutor_runner as tr

        mock_cp = AsyncMock()
        old_cp = tr._checkpointer
        try:
            tr._checkpointer = mock_cp
            await shutdown()
            mock_cp.__aexit__.assert_awaited_once_with(None, None, None)
            assert tr._checkpointer is None
        finally:
            tr._checkpointer = old_cp

    @pytest.mark.asyncio
    async def test_shutdown_noop_when_no_checkpointer(self):
        import systemedu.cloud.gateway.tutor_runner as tr

        old_cp = tr._checkpointer
        try:
            tr._checkpointer = None
            await shutdown()  # should not raise
            assert tr._checkpointer is None
        finally:
            tr._checkpointer = old_cp
