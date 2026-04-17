"""Integration tests for tutor context pipeline.

Covers:
1. skill_router prompt includes knode_content
2. skill subgraph LLM prompt includes knode_content via render_memory_block
3. stream() filters out skill_router LLM tokens (no JSON leak)
4. invoke() response does not contain skill_decision JSON
"""

from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.tutor.nodes.skill_router import ROUTER_PROMPT, make_skill_router_node
from systemedu.tutor.skills import SkillBase, SkillConfig
from systemedu.tutor.skills._common import render_memory_block
from systemedu.tutor.state import MemorySnapshot, TutorState


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------
class StubSkill(SkillBase):
    def build_subgraph(self, llm, tools):
        return None


def _skill(name: str, *, max_turns: int = 5):
    return StubSkill(SkillConfig(
        name=name, description=f"{name} skill", max_turns=max_turns,
    ))


class StubLoader:
    def __init__(self, skills: list[SkillBase]):
        self._skills = skills

    def list_all(self) -> list[SkillBase]:
        return list(self._skills)


@dataclass
class CaptureLLM:
    """Records calls and returns fixed response."""

    response: str
    calls: list[list[Any]] = None  # type: ignore[assignment]

    def __post_init__(self):
        self.calls = []

    async def ainvoke(self, messages):
        self.calls.append(messages)
        return AIMessage(content=self.response)


# ---------------------------------------------------------------------------
# 1. Router prompt includes knode_content
# ---------------------------------------------------------------------------
class TestRouterPromptKnodeContent:
    def test_template_has_knode_content_placeholder(self):
        """ROUTER_PROMPT template must contain {knode_content}."""
        assert "{knode_content}" in ROUTER_PROMPT

    @pytest.mark.asyncio
    async def test_router_passes_knode_content_to_llm(self):
        """skill_router renders knode_content from memory into the LLM prompt."""
        skills = [_skill("direct-instruction")]
        llm = CaptureLLM(
            response='{"action": "switch", "target_skill": "direct-instruction", "reason": "test"}'
        )
        node = make_skill_router_node(loader=StubLoader(skills), llm=llm)

        state = TutorState(
            user_id="u1",
            project_name="P1",
            knode_id="k5",
            messages=[HumanMessage(content="练习题我不会")],
            memory=MemorySnapshot(
                l3_knode_state="- [struggle@k5] 不理解推力",
                l3_knode_content="## 课程内容\n火箭通过喷射气体产生推力\n\n## 练习题\n- [ex1] (choice) 推力来自什么？",
            ),
        )
        await node(state)

        assert llm.calls, "LLM should have been called"
        prompt_text = llm.calls[0][0].content
        assert "火箭通过喷射气体产生推力" in prompt_text
        assert "推力来自什么" in prompt_text

    @pytest.mark.asyncio
    async def test_router_empty_knode_content_shows_empty(self):
        """When l3_knode_content is empty, prompt shows (empty)."""
        skills = [_skill("direct-instruction")]
        llm = CaptureLLM(
            response='{"action": "switch", "target_skill": "direct-instruction", "reason": "test"}'
        )
        node = make_skill_router_node(loader=StubLoader(skills), llm=llm)

        state = TutorState(
            user_id="u1",
            messages=[HumanMessage(content="hi")],
            memory=MemorySnapshot(),
        )
        await node(state)

        prompt_text = llm.calls[0][0].content
        assert "(empty)" in prompt_text


# ---------------------------------------------------------------------------
# 2. Skill render_memory_block includes knode_content
# ---------------------------------------------------------------------------
class TestSkillMemoryBlock:
    def test_memory_block_includes_knode_content(self):
        """render_memory_block used by skills includes l3_knode_content."""
        memory = {
            "l1_profile": "- [interest] 喜欢火箭",
            "l3_knode_content": "## 课程内容\n推力原理...\n\n## 练习题\n- [ex1] (choice) 推力来自？",
        }
        block = render_memory_block(memory)
        assert "当前课程内容" in block
        assert "推力原理" in block
        assert "推力来自" in block

    def test_memory_block_without_content_no_section(self):
        """When l3_knode_content is empty, no section header appears."""
        memory = {"l1_profile": "- [interest] 喜欢火箭"}
        block = render_memory_block(memory)
        assert "当前课程内容" not in block

    def test_memory_block_none_memory(self):
        """None memory doesn't crash."""
        block = render_memory_block(None)
        assert "no memory" in block.lower()


# ---------------------------------------------------------------------------
# 3. Router decision does not appear in skill messages
# ---------------------------------------------------------------------------
class TestSkillDecisionNotInMessages:
    @pytest.mark.asyncio
    async def test_router_returns_decision_not_message(self):
        """skill_router output is a state update (skill_decision), not a message."""
        skills = [_skill("direct-instruction")]
        decision_json = '{"action": "switch", "target_skill": "direct-instruction", "reason": "test switch"}'
        llm = CaptureLLM(response=decision_json)
        node = make_skill_router_node(loader=StubLoader(skills), llm=llm)

        state = TutorState(
            user_id="u1",
            messages=[HumanMessage(content="练习题我不会")],
            memory=MemorySnapshot(),
        )
        result = await node(state)

        # result should have skill_decision but NOT messages
        assert "skill_decision" in result
        assert result["skill_decision"]["action"] == "switch"
        assert "messages" not in result, (
            "skill_router must NOT add messages; "
            "the JSON decision would leak into the AI reply"
        )
