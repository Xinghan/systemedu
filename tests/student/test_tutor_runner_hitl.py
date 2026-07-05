"""HITL flow in student-app tutor_runner.stream() (spec 043 T1.11/1C).

`stream()` must, on a write-tool interrupt: emit a `tool_confirm` event, await
the caller-supplied `resume_provider` for a decision, resume the SAME thread
with `Command(resume={"decisions": [...]})`, and stream the continuation. We
drive this with a fake graph that mimics `astream_events` + `aget_state`
(interrupt on the first segment, finish on the resume), so the test exercises
the runner's orchestration without a full LLM/graph/checkpointer stack.

The pure mappers (`_decision_to_resume`, `_confirm_from_interrupt_value`,
`_extract_interrupt_value`) are unit-tested directly.
"""

from __future__ import annotations

import pytest

from systemedu.student.chat import tutor_runner
from systemedu.student.chat.payload import ChatPayload


# ---------------------------------------------------------------------------
# Pure mapper unit tests
# ---------------------------------------------------------------------------
class TestMappers:
    def test_decision_approve(self):
        assert tutor_runner._decision_to_resume({"type": "approve"}) == {
            "decisions": [{"type": "approve"}]
        }

    def test_decision_reject_with_message(self):
        out = tutor_runner._decision_to_resume({"type": "reject", "message": "先别"})
        assert out == {"decisions": [{"type": "reject", "message": "先别"}]}

    def test_decision_none_is_reject(self):
        """Missing decision must fail safe as a reject (never run an
        unapproved write tool)."""
        out = tutor_runner._decision_to_resume(None)
        assert out["decisions"][0]["type"] == "reject"

    def test_decision_unknown_type_is_reject(self):
        out = tutor_runner._decision_to_resume({"type": "banana"})
        assert out["decisions"][0]["type"] == "reject"

    def test_confirm_from_interrupt_value(self):
        val = {
            "action_requests": [
                {"name": "complete_node", "args": {"knode_id": "M01"}, "description": "d"}
            ],
            "review_configs": [{"action_name": "complete_node"}],
        }
        confirm = tutor_runner._confirm_from_interrupt_value(val)
        assert confirm["tool"] == "complete_node"
        assert confirm["args"] == {"knode_id": "M01"}
        assert confirm["confirm_id"].startswith("c-")

    def test_confirm_from_empty_is_none(self):
        assert tutor_runner._confirm_from_interrupt_value({"action_requests": []}) is None

    def test_extract_interrupt_value_from_result(self):
        class _I:
            value = {"action_requests": [{"name": "x", "args": {}}]}

        result = {"__interrupt__": (_I(),)}
        val = tutor_runner._extract_interrupt_value(result)
        assert val == {"action_requests": [{"name": "x", "args": {}}]}

    def test_extract_interrupt_value_absent(self):
        assert tutor_runner._extract_interrupt_value({"messages": []}) is None


# ---------------------------------------------------------------------------
# Fake graph mimicking astream_events + aget_state for the stream() loop
# ---------------------------------------------------------------------------
def _chunk_event(text: str) -> dict:
    class _Chunk:
        content = text

    return {
        "event": "on_chat_model_stream",
        "tags": [],
        "metadata": {"langgraph_node": "skill:direct_instruction"},
        "data": {"chunk": _Chunk()},
    }


class _State:
    def __init__(self, *, next_, interrupts=None, values=None):
        self.next = next_
        self.interrupts = interrupts or []
        self.values = values or {}


class _Interrupt:
    def __init__(self, value):
        self.value = value


class _FakeGraph:
    """Segment 1: stream one chunk then interrupt. Segment 2 (resume): stream a
    final chunk then finish. `aget_state` returns interrupted state after seg 1,
    finished state after seg 2."""

    def __init__(self):
        self.segments = 0
        self.resume_inputs: list = []
        self._interrupt_val = {
            "action_requests": [
                {"name": "complete_node", "args": {"knode_id": "M01"}, "description": "d"}
            ],
            "review_configs": [{"action_name": "complete_node"}],
        }

    async def astream_events(self, graph_input, config, version):  # noqa: ARG002
        self.segments += 1
        if self.segments == 1:
            yield _chunk_event("我先帮你确认一下…")
        else:
            # this is a resume
            from langgraph.types import Command

            assert isinstance(graph_input, Command)
            self.resume_inputs.append(graph_input)
            yield _chunk_event("好的, 已经标记完成了。")

    async def aget_state(self, config):  # noqa: ARG002
        if self.segments == 1:
            return _State(
                next_=("skill:direct_instruction",),
                interrupts=[_Interrupt(self._interrupt_val)],
            )
        return _State(
            next_=(),
            values={"skill_decision": {"action": "continue", "target_skill": "di", "reason": "r"}},
        )


@pytest.fixture()
def _patch_runner(monkeypatch):
    """Stub graph resolution + tool context so stream() runs offline."""
    graph = _FakeGraph()

    async def _fake_resolve(user_id):
        return graph, False

    class _Ctx:
        pass

    monkeypatch.setattr(tutor_runner, "_resolve_user_graph", _fake_resolve)
    monkeypatch.setattr(tutor_runner, "_make_tool_context", lambda p, u: _Ctx())
    return graph


@pytest.mark.asyncio
async def test_stream_emits_tool_confirm_then_resumes(_patch_runner):
    graph = _patch_runner
    payload = ChatPayload(message="帮我标记 M01 完成", session_id="s1")

    decisions_seen: list = []

    async def resume_provider(confirm):
        decisions_seen.append(confirm)
        return {"type": "approve"}

    events = []
    async for ev in tutor_runner.stream(payload, "u1", resume_provider=resume_provider):
        events.append(ev)

    types = [e["type"] for e in events]
    # ordering: chunk (seg1) → tool_confirm → chunk (seg2 after approve) → skill
    assert types == ["chunk", "tool_confirm", "chunk", "skill"], types
    # the confirm carried the pending tool
    confirm_ev = next(e for e in events if e["type"] == "tool_confirm")
    assert confirm_ev["tool"] == "complete_node"
    assert confirm_ev["args"] == {"knode_id": "M01"}
    # resume_provider was consulted and the graph resumed once
    assert len(decisions_seen) == 1
    assert len(graph.resume_inputs) == 1
    # both chunks made it to the student
    chunks = [e["content"] for e in events if e["type"] == "chunk"]
    assert chunks == ["我先帮你确认一下…", "好的, 已经标记完成了。"]
    # skill trailer emitted from finished state
    assert any(e["type"] == "skill" for e in events)


@pytest.mark.asyncio
async def test_stream_without_provider_stops_at_tool_confirm(_patch_runner):
    """No resume_provider → stream emits tool_confirm and ends (caller re-drives)."""
    payload = ChatPayload(message="标记 M01 完成", session_id="s2")

    events = []
    async for ev in tutor_runner.stream(payload, "u1", resume_provider=None):
        events.append(ev)

    types = [e["type"] for e in events]
    assert types[-1] == "tool_confirm", f"should end at tool_confirm, got {types}"
    # never resumed
    assert _patch_runner.resume_inputs == []
