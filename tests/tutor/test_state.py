"""Tests for TutorState TypedDicts (spec 014 T1.5)."""

from __future__ import annotations

from datetime import datetime

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph

from systemedu.tutor.state import MemorySnapshot, SkillDecision, TutorState


class TestTypedDictConstruction:
    """TypedDict with total=False allows empty/partial construction."""

    def test_empty_state(self):
        state: TutorState = {}
        assert state == {}

    def test_partial_state(self):
        state: TutorState = {
            "user_id": "u1",
            "session_id": "s1",
            "active_skill": "socratic",
            "skill_turn_count": 2,
        }
        assert state["user_id"] == "u1"
        assert state["skill_turn_count"] == 2

    def test_memory_snapshot(self):
        snap: MemorySnapshot = {
            "l1_profile": "学生画像",
            "l4_semantic_recall": ["片段1", "片段2", "片段3"],
            "injected_at": datetime(2026, 4, 16),
        }
        assert snap["l4_semantic_recall"] == ["片段1", "片段2", "片段3"]

    def test_skill_decision(self):
        dec: SkillDecision = {
            "action": "switch",
            "target_skill": "direct_explain",
            "reason": "student hit a conceptual wall",
        }
        assert dec["action"] == "switch"
        assert dec["target_skill"] == "direct_explain"


class TestLangGraphAcceptsState:
    """TutorState must be a valid state schema for StateGraph."""

    def test_stategraph_compiles_with_tutor_state(self):
        builder = StateGraph(TutorState)

        async def noop(state):
            return {}

        builder.add_node("noop", noop)
        builder.add_edge(START, "noop")
        builder.add_edge("noop", END)

        graph = builder.compile()
        assert graph is not None

    async def test_invoke_preserves_user_id(self):
        builder = StateGraph(TutorState)

        async def echo(state: TutorState):
            return {"active_skill": f"echoed-{state.get('user_id', 'nobody')}"}

        builder.add_node("echo", echo)
        builder.add_edge(START, "echo")
        builder.add_edge("echo", END)

        graph = builder.compile()
        result = await graph.ainvoke({"user_id": "alice"})
        assert result["user_id"] == "alice"
        assert result["active_skill"] == "echoed-alice"


class TestAddMessagesReducer:
    """messages channel uses add_messages reducer (append, dedupe by id)."""

    async def test_messages_appended_across_turns(self):
        builder = StateGraph(TutorState)

        async def add_one(state: TutorState):
            return {"messages": [AIMessage(content="response", id="ai-1")]}

        builder.add_node("add", add_one)
        builder.add_edge(START, "add")
        builder.add_edge("add", END)

        graph = builder.compile()
        initial_msg = HumanMessage(content="hello", id="human-1")
        result = await graph.ainvoke({"messages": [initial_msg]})

        assert len(result["messages"]) == 2
        assert result["messages"][0].content == "hello"
        assert result["messages"][1].content == "response"

    async def test_dedupe_by_message_id(self):
        """add_messages dedupes by id — same id overwrites."""
        builder = StateGraph(TutorState)

        async def overwrite(state: TutorState):
            return {"messages": [AIMessage(content="updated", id="ai-1")]}

        builder.add_node("overwrite", overwrite)
        builder.add_edge(START, "overwrite")
        builder.add_edge("overwrite", END)

        graph = builder.compile()
        initial = [AIMessage(content="original", id="ai-1")]
        result = await graph.ainvoke({"messages": initial})

        # Dedupe by id -> only one message with id ai-1, content updated
        ai_1 = [m for m in result["messages"] if m.id == "ai-1"]
        assert len(ai_1) == 1
        assert ai_1[0].content == "updated"
