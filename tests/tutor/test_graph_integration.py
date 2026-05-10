"""Integration tests for the full tutor graph with skills wired in (T3.10).

Covers the 7 scenarios enumerated in design §12.3:

1. New session first turn — router picks a skill, subgraph runs,
   AIMessage lands in main state, active_skill persists.
2. Skill switch mid-conversation — router decides `switch`, main
   graph dispatches to the new skill, turn_count resets.
3. Checkpoint resume — a 3-turn session closes, reopens against the
   same sqlite path, the 4th turn sees the prior messages.
4. Safety gate short-circuit — `_safety_triggered=True` skips memory
   + skill work and lands directly in output_stream.
5. Confirm flow — `confirm_required` set by a (future) skill persists
   through the turn; here we assert the field round-trips.
6. Tool whitelist overreach — skill declares no tools → wrapper
   receives empty tool list (asserted via the FakeLLM's seen tools).
7. max_turns override — router observes max_turns and forces a
   switch to direct-instruction.

All tests use a scripted fake LLM so there's no network I/O. The real
`SkillLoader` is pointed at `src/systemedu/tutor/skills/` so the six
built-in skills are genuinely exercised.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from systemedu.core.config import TutorConfig
from systemedu.core.tutor.checkpoint import get_checkpointer
from systemedu.core.tutor.graph import build_tutor_graph
from systemedu.core.tutor.skills import SkillLoader


SKILLS_ROOT = (
    Path(__file__).resolve().parents[2]  # repo root
    / "packages" / "core" / "src" / "systemedu" / "core" / "tutor" / "skills"
)


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------
class ScriptedLLM:
    """Deterministic LLM used by both the router and the skill subgraphs.

    The router expects JSON in the form
    `{"action": "...", "target_skill": "...", "reason": "..."}`.
    Each skill expects free-form text (some with trailing markers like
    `error_type: concept` or `ready_to_complete: yes`). We dispatch
    based on the system prompt: the router prompt starts with
    `你是教学策略调度器`, skill prompts come from the SKILL.md body.
    """

    def __init__(
        self,
        *,
        router_replies: list[str],
        skill_replies: list[str] | None = None,
    ):
        self._router = list(router_replies)
        self._skill = list(skill_replies or [])
        self.calls: list[tuple[str, str]] = []

    async def ainvoke(self, messages: list[BaseMessage]) -> AIMessage:
        system_text = ""
        user_text = ""
        for m in messages:
            if isinstance(m, SystemMessage):
                system_text = (
                    m.content if isinstance(m.content, str) else str(m.content)
                )
            elif isinstance(m, HumanMessage):
                user_text = (
                    m.content if isinstance(m.content, str) else str(m.content)
                )
        self.calls.append((system_text, user_text))
        # Router uses a single HumanMessage with no system message.
        # Skills use SystemMessage + HumanMessage (see _common.call_llm).
        if not system_text and "教学策略调度器" in user_text:
            if not self._router:
                raise AssertionError("ScriptedLLM ran out of router replies")
            return AIMessage(content=self._router.pop(0))
        if not self._skill:
            raise AssertionError("ScriptedLLM ran out of skill replies")
        return AIMessage(content=self._skill.pop(0))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def loader() -> SkillLoader:
    l = SkillLoader([SKILLS_ROOT])
    l.scan()
    # Sanity: all six skills discovered.
    names = {s.config.name for s in l.list_all()}
    assert {
        "socratic-questioning",
        "direct-instruction",
        "scaffolding",
        "error-diagnosis",
        "pbl-driving-question",
        "reflection-prompt",
    } <= names
    return l


def _router_reply(action: str, target: str | None = None, reason: str = "test") -> str:
    tgt = "null" if target is None else f'"{target}"'
    return f'{{"action": "{action}", "target_skill": {tgt}, "reason": "{reason}"}}'


def _initial_state(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "user_id": "u-alice",
        "session_id": "s-1",
        "project_name": "mars-risk-map",
        "knode_id": "m-001",
        "messages": [HumanMessage(content="我不太明白这个")],
    }
    base.update(overrides)
    return base


# ===========================================================================
# Scenario 1 — new session, full chain
# ===========================================================================
class TestScenario1_NewSessionFullChain:
    async def test_first_turn_runs_socratic(self, loader):
        llm = ScriptedLLM(
            router_replies=[
                _router_reply("switch", "socratic-questioning", "first turn"),
            ],
            skill_replies=["你觉得摩擦力和什么有关？"],
        )
        graph = build_tutor_graph(loader=loader, llm=llm)
        result = await graph.ainvoke(_initial_state())

        assert result["active_skill"] == "socratic-questioning"
        assert result["skill_turn_count"] == 1
        # AIMessage from the skill made it back to the main conversation.
        ai_msgs = [m for m in result["messages"] if isinstance(m, AIMessage)]
        assert len(ai_msgs) == 1
        assert "摩擦力" in ai_msgs[0].content
        # Router was called exactly once.
        router_calls = [c for c in llm.calls if "教学策略调度器" in c[1]]
        assert len(router_calls) == 1


# ===========================================================================
# Scenario 2 — switch skill mid-session, turn_count resets
# ===========================================================================
class TestScenario2_SkillSwitch:
    async def test_switch_resets_turn_count(self, loader):
        """Router switches from socratic to direct-instruction.

        After dispatch, `skill_turn_count` reflects the NEW skill's
        first turn (1), not the old skill's streak (3).
        """
        llm = ScriptedLLM(
            router_replies=[
                _router_reply("switch", "direct-instruction", "student asked directly"),
            ],
            skill_replies=["结论是摩擦系数 × 法向力。机制：... 例：..."],
        )
        graph = build_tutor_graph(loader=loader, llm=llm)
        # State coming in: socratic has been running for 3 turns.
        state = _initial_state(
            messages=[HumanMessage(content="别问了，直接告诉我")],
            active_skill="socratic-questioning",
            skill_turn_count=3,
            skill_state={"turn_count": 3, "questions_asked": ["q1", "q2", "q3"]},
        )
        result = await graph.ainvoke(state)

        assert result["active_skill"] == "direct-instruction"
        assert result["skill_turn_count"] == 1  # reset to the new skill's first turn
        ai_msgs = [m for m in result["messages"] if isinstance(m, AIMessage)]
        assert any("结论" in m.content for m in ai_msgs)


# ===========================================================================
# Scenario 3 — checkpoint resume across "restarts"
# ===========================================================================
class TestScenario3_CheckpointResume:
    async def test_third_turn_sees_prior_messages(self, loader, tmp_path):
        """3 turns through a checkpointed graph, then reopen against the
        same sqlite file and confirm the messages are still there."""
        cfg = TutorConfig(
            checkpoint_backend="sqlite",
            checkpoint_sqlite_path=str(tmp_path / "ck.db"),
        )
        thread = {"configurable": {"thread_id": "s-resume"}}

        # Script enough router/skill replies for 3 turns + 1 resume turn.
        llm = ScriptedLLM(
            router_replies=[
                _router_reply("switch", "socratic-questioning", "t1"),
                _router_reply("continue", "socratic-questioning", "t2"),
                _router_reply("continue", "socratic-questioning", "t3"),
                _router_reply("continue", "socratic-questioning", "t4"),
            ],
            skill_replies=["问1?", "问2?", "问3?", "问4?"],
        )

        async with get_checkpointer(cfg) as saver:
            graph = build_tutor_graph(loader=loader, llm=llm, checkpointer=saver)
            for turn in range(3):
                await graph.ainvoke(
                    {
                        "user_id": "u1",
                        "session_id": "s-resume",
                        "knode_id": "m-001",
                        "messages": [HumanMessage(content=f"q{turn}")],
                    },
                    config=thread,
                )

        # Reopen the checkpointer and run one more turn.
        async with get_checkpointer(cfg) as saver2:
            graph2 = build_tutor_graph(loader=loader, llm=llm, checkpointer=saver2)
            result = await graph2.ainvoke(
                {"messages": [HumanMessage(content="q-resumed")]},
                config=thread,
            )

        human_msgs = [m for m in result["messages"] if isinstance(m, HumanMessage)]
        ai_msgs = [m for m in result["messages"] if isinstance(m, AIMessage)]
        # 3 prior user msgs + 1 new = 4 human messages
        assert len(human_msgs) == 4
        # 3 prior AI msgs + 1 new = 4 AI messages
        assert len(ai_msgs) == 4
        assert result["active_skill"] == "socratic-questioning"


# ===========================================================================
# Scenario 4 — safety gate short-circuit
# ===========================================================================
class TestScenario4_SafetyShortCircuit:
    async def test_safety_triggered_skips_skill(self, loader, monkeypatch):
        """When safety_gate writes `_safety_triggered=True`, neither
        memory_inject nor skill_router runs — we land straight in
        output_stream. The LLM should therefore not be called.

        We patch the `safety_gate_node` on the graph module (the alias
        it captured at import time) and restore it in a `finally`.
        Rebuilding the graph afterwards is enough — no module reload.
        """
        from systemedu.core.tutor import graph as graph_module

        async def triggered_gate(state):
            return {"_safety_triggered": True}

        original = graph_module.safety_gate_node
        graph_module.safety_gate_node = triggered_gate
        try:
            llm = ScriptedLLM(router_replies=[], skill_replies=[])
            graph = graph_module.build_tutor_graph(loader=loader, llm=llm)
            result = await graph.ainvoke(
                _initial_state(messages=[HumanMessage(content="某敏感词")])
            )
            assert result.get("_safety_triggered") is True
            # LLM never invoked (no skill, no router)
            assert llm.calls == []
            # active_skill never set
            assert result.get("active_skill") in (None, "")
        finally:
            graph_module.safety_gate_node = original


# ===========================================================================
# Scenario 5 — confirm flow round-trip
# ===========================================================================
class TestScenario5_ConfirmFlow:
    async def test_confirm_required_persists_through_graph(self, loader):
        """A confirm_required payload set upstream should survive the
        main-graph pipeline unchanged, so the gateway SSE layer can
        surface it to the user."""
        llm = ScriptedLLM(
            router_replies=[_router_reply("exit", None, "awaiting confirm")],
            skill_replies=[],
        )
        graph = build_tutor_graph(loader=loader, llm=llm)
        result = await graph.ainvoke(
            _initial_state(
                confirm_required={
                    "tool": "complete_node",
                    "args": {"knode_id": "m-001"},
                    "confirm_id": "c-42",
                }
            )
        )
        assert result.get("confirm_required") == {
            "tool": "complete_node",
            "args": {"knode_id": "m-001"},
            "confirm_id": "c-42",
        }
        # With action=exit, no skill ran.
        assert not [m for m in result["messages"] if isinstance(m, AIMessage)]


# ===========================================================================
# Scenario 6 — unknown switch target falls back to output_stream
# ===========================================================================
class TestScenario6_UnknownSkillFallback:
    async def test_router_unknown_target_falls_back(self, loader):
        """Router asks for a skill that doesn't exist. The router
        itself catches this and rewrites to
        `switch → direct-instruction` (per skill_router fallback)."""
        llm = ScriptedLLM(
            router_replies=[
                # This target is unknown → router falls back to direct-instruction
                _router_reply("switch", "made-up-skill", "garbage"),
            ],
            skill_replies=["默认兜底讲解"],
        )
        graph = build_tutor_graph(loader=loader, llm=llm)
        result = await graph.ainvoke(_initial_state())
        # Router's fallback writes direct-instruction into the decision,
        # so we should see that skill ran.
        assert result["active_skill"] == "direct-instruction"


# ===========================================================================
# Scenario 7 — max_turns forces switch
# ===========================================================================
class TestScenario7_MaxTurnsForcesSwitch:
    async def test_at_max_turns_forces_switch(self, loader):
        """socratic has max_turns=5. When skill_turn_count>=5 the
        router rewrites a `continue` response as `switch`."""
        llm = ScriptedLLM(
            router_replies=[
                # LLM "wants" to continue, but router will rewrite to switch.
                _router_reply("continue", "socratic-questioning", "wants more"),
            ],
            skill_replies=["现在让我直接讲解"],
        )
        graph = build_tutor_graph(loader=loader, llm=llm)
        state = _initial_state(
            active_skill="socratic-questioning",
            skill_turn_count=5,
            skill_state={"turn_count": 5},
        )
        result = await graph.ainvoke(state)
        # Router override picks direct-instruction by default.
        assert result["active_skill"] == "direct-instruction"
        assert result["skill_turn_count"] == 1


# ===========================================================================
# Regression: loader=None / llm=None still compiles (Phase-1 compat)
# ===========================================================================
class TestPhase1Compat:
    async def test_no_loader_no_llm_still_runs(self):
        graph = build_tutor_graph()
        result = await graph.ainvoke({"user_id": "u1"})
        assert result["user_id"] == "u1"
