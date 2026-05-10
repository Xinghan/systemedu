"""Tests for skill_router (spec 014 T3.3).

We fake both the SkillLoader (with stub SkillBase instances) and the
LLM (response queue). No real network calls.

Pipeline we're verifying:
- knode switch → reset active_skill + skill_turn_count
- max_turns reached → force switch regardless of LLM's 'continue'
- LLM JSON continue/switch/exit parses correctly
- malformed LLM response → fallback to switch → direct-instruction
- unknown switch target → fallback
- LLM exception → fallback
- no loader/llm wired → quietly emit fallback
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.core.tutor.nodes import make_skill_router_node, skill_router_node
from systemedu.core.tutor.skills import SkillBase, SkillConfig
from systemedu.core.tutor.state import TutorState


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------
class StubSkill(SkillBase):
    def build_subgraph(self, llm, tools):
        return f"compiled::{self.config.name}"


def _skill(name: str, *, max_turns: int = 5, triggers: list[str] | None = None):
    return StubSkill(SkillConfig(
        name=name, description=f"{name} skill",
        max_turns=max_turns, triggers=triggers or [],
    ))


class StubLoader:
    def __init__(self, skills: list[SkillBase]):
        self._skills = skills

    def list_all(self) -> list[SkillBase]:
        return list(self._skills)


@dataclass
class FakeLLM:
    """Replay a queue of response strings; .ainvoke records calls."""

    responses: list[str]
    calls: list[list[Any]] = None  # type: ignore[assignment]

    def __post_init__(self):
        self.calls = []
        self._q = deque(self.responses)

    async def ainvoke(self, messages):
        self.calls.append(messages)
        if not self._q:
            raise AssertionError("FakeLLM exhausted")
        return AIMessage(content=self._q.popleft())


class BrokenLLM:
    async def ainvoke(self, messages):
        raise RuntimeError("boom")


def _skills_catalog() -> list[SkillBase]:
    return [
        _skill("socratic-questioning", max_turns=5),
        _skill("direct-instruction", max_turns=3),
        _skill("scaffolding", max_turns=4),
        _skill("error-diagnosis", max_turns=2),
        _skill("pbl-driving-question", max_turns=2),
        _skill("reflection-prompt", max_turns=3),
    ]


# ---------------------------------------------------------------------------
# LLM decision parsing
# ---------------------------------------------------------------------------
class TestLLMDecision:
    @pytest.mark.asyncio
    async def test_continue(self):
        llm = FakeLLM(['{"action":"continue","target_skill":null,"reason":"ok"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1", knode_id="k1",
            active_skill="socratic-questioning", skill_turn_count=1,
            messages=[HumanMessage(content="再想想")],
        ))
        d = out["skill_decision"]
        assert d["action"] == "continue"
        assert d["target_skill"] is None

    @pytest.mark.asyncio
    async def test_switch(self):
        llm = FakeLLM(['{"action":"switch","target_skill":"scaffolding","reason":"前置未过"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1", knode_id="k1",
            active_skill="socratic-questioning", skill_turn_count=2,
            messages=[HumanMessage(content="我完全不会")],
        ))
        d = out["skill_decision"]
        assert d["action"] == "switch"
        assert d["target_skill"] == "scaffolding"

    @pytest.mark.asyncio
    async def test_exit(self):
        llm = FakeLLM(['{"action":"exit","target_skill":null,"reason":"学生下线"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1", knode_id="k1",
            active_skill="reflection-prompt", skill_turn_count=1,
            messages=[HumanMessage(content="我先去吃饭")],
        ))
        assert out["skill_decision"]["action"] == "exit"

    @pytest.mark.asyncio
    async def test_strips_code_fences(self):
        llm = FakeLLM([
            '```json\n{"action":"continue","target_skill":null,"reason":"r"}\n```',
        ])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1", knode_id="k1",
            active_skill="socratic-questioning", skill_turn_count=1,
        ))
        assert out["skill_decision"]["action"] == "continue"


# ---------------------------------------------------------------------------
# Fallbacks
# ---------------------------------------------------------------------------
class TestFallbacks:
    @pytest.mark.asyncio
    async def test_malformed_json_falls_back(self):
        llm = FakeLLM(["not json at all"])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(user_id="u1", knode_id="k1"))
        d = out["skill_decision"]
        assert d["action"] == "switch"
        assert d["target_skill"] == "direct-instruction"

    @pytest.mark.asyncio
    async def test_unknown_switch_target_falls_back(self):
        llm = FakeLLM(['{"action":"switch","target_skill":"nonexistent","reason":"x"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(user_id="u1", knode_id="k1"))
        d = out["skill_decision"]
        assert d["action"] == "switch"
        assert d["target_skill"] == "direct-instruction"

    @pytest.mark.asyncio
    async def test_llm_exception_falls_back(self):
        node = make_skill_router_node(
            loader=StubLoader(_skills_catalog()), llm=BrokenLLM(),
        )
        out = await node(TutorState(user_id="u1", knode_id="k1"))
        d = out["skill_decision"]
        assert d["action"] == "switch"
        assert d["target_skill"] == "direct-instruction"

    @pytest.mark.asyncio
    async def test_invalid_action(self):
        """Unknown 'action' string should trigger fallback."""
        llm = FakeLLM(['{"action":"teleport","target_skill":null,"reason":"x"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(user_id="u1", knode_id="k1"))
        assert out["skill_decision"]["action"] == "switch"

    @pytest.mark.asyncio
    async def test_no_loader_still_emits_decision(self):
        node = make_skill_router_node(loader=None, llm=None)
        out = await node(TutorState(user_id="u1", knode_id="k1"))
        assert out["skill_decision"]["action"] == "switch"
        assert out["skill_decision"]["target_skill"] == "direct-instruction"


# ---------------------------------------------------------------------------
# max_turns override
# ---------------------------------------------------------------------------
class TestMaxTurnsOverride:
    @pytest.mark.asyncio
    async def test_forces_switch_when_at_max(self):
        """LLM says continue, but turn_count >= max_turns so router overrides."""
        llm = FakeLLM(['{"action":"continue","target_skill":null,"reason":"go"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1", knode_id="k1",
            active_skill="socratic-questioning", skill_turn_count=5,
            messages=[HumanMessage(content="还是不懂")],
        ))
        d = out["skill_decision"]
        assert d["action"] == "switch"
        # Since LLM didn't specify a target, default is direct-instruction
        assert d["target_skill"] == "direct-instruction"
        assert "max_turns" in d["reason"]

    @pytest.mark.asyncio
    async def test_respects_llm_target_on_max_turns(self):
        """If LLM's continue had an implied better target (switch), keep it."""
        llm = FakeLLM(['{"action":"switch","target_skill":"scaffolding","reason":"r"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1", knode_id="k1",
            active_skill="socratic-questioning", skill_turn_count=5,
        ))
        # LLM already said switch → scaffolding; no override needed
        assert out["skill_decision"]["target_skill"] == "scaffolding"

    @pytest.mark.asyncio
    async def test_not_at_max_allows_continue(self):
        llm = FakeLLM(['{"action":"continue","target_skill":null,"reason":"ok"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1", knode_id="k1",
            active_skill="socratic-questioning", skill_turn_count=2,
        ))
        assert out["skill_decision"]["action"] == "continue"


# ---------------------------------------------------------------------------
# knode switch reset
# ---------------------------------------------------------------------------
class TestKnodeSwitchReset:
    @pytest.mark.asyncio
    async def test_resets_on_knode_change(self):
        llm = FakeLLM(['{"action":"switch","target_skill":"pbl-driving-question","reason":"new knode"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1",
            knode_id="m2",  # different from last_routed_knode_id
            last_routed_knode_id="m1",
            active_skill="socratic-questioning",
            skill_turn_count=3,
        ))
        assert out["active_skill"] is None
        assert out["skill_turn_count"] == 0
        assert out["last_routed_knode_id"] == "m2"
        # LLM still runs → returned decision
        assert out["skill_decision"]["action"] == "switch"

    @pytest.mark.asyncio
    async def test_no_reset_on_same_knode(self):
        llm = FakeLLM(['{"action":"continue","target_skill":null,"reason":"r"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1",
            knode_id="m1",
            last_routed_knode_id="m1",
            active_skill="socratic-questioning",
            skill_turn_count=2,
        ))
        # active_skill should NOT be cleared
        assert "active_skill" not in out or out.get("active_skill") != None  # noqa: E711
        # last_routed_knode_id still tracked
        assert out["last_routed_knode_id"] == "m1"

    @pytest.mark.asyncio
    async def test_first_turn_no_reset(self):
        """last_routed_knode_id missing → no reset (first turn)."""
        llm = FakeLLM(['{"action":"switch","target_skill":"pbl-driving-question","reason":"first"}'])
        node = make_skill_router_node(loader=StubLoader(_skills_catalog()), llm=llm)
        out = await node(TutorState(
            user_id="u1", knode_id="m1",
            # no last_routed_knode_id
        ))
        assert out["last_routed_knode_id"] == "m1"
        # no explicit reset keys written
        assert "active_skill" not in out
        assert "skill_turn_count" not in out


# ---------------------------------------------------------------------------
# Backward-compat shim
# ---------------------------------------------------------------------------
class TestLegacyShim:
    @pytest.mark.asyncio
    async def test_bare_skill_router_node_still_callable(self):
        out = await skill_router_node(TutorState(user_id="u1"))
        assert out["skill_decision"]["action"] == "switch"
        assert out["skill_decision"]["target_skill"] == "direct-instruction"
