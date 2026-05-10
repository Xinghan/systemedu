"""Tests for confirm_handler node (T4.5)."""

from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.core.tutor.nodes.confirm_handler import confirm_handler_node


def _pending(tool="complete_node", confirm_id="c-42"):
    return {
        "tool": tool,
        "args": {"knode_id": "k-1"},
        "confirm_id": confirm_id,
    }


def _confirm_msg(confirm_id="c-42", approved=True):
    return HumanMessage(
        content="yes" if approved else "no",
        additional_kwargs={
            "confirm_response": {"confirm_id": confirm_id, "approved": approved}
        },
    )


class TestApproved:
    async def test_clears_confirm_required(self):
        state = {
            "confirm_required": _pending(),
            "messages": [_confirm_msg(approved=True)],
        }
        result = await confirm_handler_node(state)
        assert result["confirm_required"] is None
        assert "messages" not in result

    async def test_no_system_message_injected(self):
        state = {
            "confirm_required": _pending(),
            "messages": [_confirm_msg(approved=True)],
        }
        result = await confirm_handler_node(state)
        assert "messages" not in result


class TestRejected:
    async def test_clears_confirm_and_injects_system_msg(self):
        state = {
            "confirm_required": _pending(),
            "messages": [_confirm_msg(approved=False)],
        }
        result = await confirm_handler_node(state)
        assert result["confirm_required"] is None
        assert len(result["messages"]) == 1
        msg = result["messages"][0]
        assert isinstance(msg, SystemMessage)
        assert "拒绝" in msg.content
        assert "complete_node" in msg.content


class TestPassthrough:
    async def test_no_pending_confirm(self):
        state = {
            "messages": [HumanMessage(content="hello")],
        }
        result = await confirm_handler_node(state)
        assert result == {}

    async def test_pending_but_no_confirm_metadata(self):
        state = {
            "confirm_required": _pending(),
            "messages": [HumanMessage(content="hello")],
        }
        result = await confirm_handler_node(state)
        assert result == {}

    async def test_confirm_id_mismatch(self):
        state = {
            "confirm_required": _pending(confirm_id="c-42"),
            "messages": [_confirm_msg(confirm_id="c-99", approved=True)],
        }
        result = await confirm_handler_node(state)
        assert result == {}

    async def test_empty_state(self):
        result = await confirm_handler_node({})
        assert result == {}
