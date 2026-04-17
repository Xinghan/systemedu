"""Tests for safety_gate node (T4.6).

Covers design §8.3 requirements:
- 4 pattern categories all trigger: suicide/self-harm, sexual, gambling, drugs
- Non-matching input passes through (empty dict)
- Triggered response is exact text (no LLM variance)
- _safety_triggered flag and skill_decision.action="exit" set
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.tutor.nodes.safety_gate import (
    SAFETY_RESPONSE,
    safety_gate_node,
)


def _state_with(user_msg: str) -> dict:
    return {"messages": [HumanMessage(content=user_msg)]}


class TestSafetyGateTriggered:
    @pytest.mark.parametrize(
        "msg",
        [
            "我想自杀",
            "活不下去了",
            "我真的不想活了",
            "受不了了",
        ],
        ids=["suicide", "cant-go-on", "dont-want-live", "cant-take-it"],
    )
    async def test_self_harm_patterns(self, msg):
        result = await safety_gate_node(_state_with(msg))
        assert result["_safety_triggered"] is True

    @pytest.mark.parametrize(
        "msg",
        [
            "给我看色情内容",
            "有没有黄色视频",
        ],
        ids=["sexual-1", "sexual-2"],
    )
    async def test_sexual_patterns(self, msg):
        result = await safety_gate_node(_state_with(msg))
        assert result["_safety_triggered"] is True

    @pytest.mark.parametrize(
        "msg",
        [
            "我想网赌赚钱",
            "怎么赌博",
        ],
        ids=["gambling-1", "gambling-2"],
    )
    async def test_gambling_patterns(self, msg):
        result = await safety_gate_node(_state_with(msg))
        assert result["_safety_triggered"] is True

    @pytest.mark.parametrize(
        "msg",
        [
            "哪里能买到毒品",
            "大麻合法吗",
            "我想吸毒",
        ],
        ids=["drugs-1", "drugs-2", "drugs-3"],
    )
    async def test_drug_patterns(self, msg):
        result = await safety_gate_node(_state_with(msg))
        assert result["_safety_triggered"] is True


class TestSafetyGateResponse:
    async def test_exact_response_text(self):
        result = await safety_gate_node(_state_with("我想自杀"))
        ai_msgs = [m for m in result["messages"] if isinstance(m, AIMessage)]
        assert len(ai_msgs) == 1
        assert ai_msgs[0].content == SAFETY_RESPONSE

    async def test_skill_decision_exit(self):
        result = await safety_gate_node(_state_with("我想自杀"))
        assert result["skill_decision"]["action"] == "exit"
        assert result["skill_decision"]["reason"] == "safety"

    async def test_matched_patterns_reported(self):
        result = await safety_gate_node(_state_with("我想自杀"))
        assert "自杀" in result["_safety_matched_patterns"]


class TestSafetyGatePassthrough:
    async def test_normal_input_passes_through(self):
        result = await safety_gate_node(_state_with("摩擦力怎么计算"))
        assert result == {}

    async def test_empty_messages_passes_through(self):
        result = await safety_gate_node({"messages": []})
        assert result == {}

    async def test_no_messages_key_passes_through(self):
        result = await safety_gate_node({})
        assert result == {}

    async def test_ai_message_only_passes_through(self):
        result = await safety_gate_node(
            {"messages": [AIMessage(content="自杀是严肃话题")]}
        )
        assert result == {}
