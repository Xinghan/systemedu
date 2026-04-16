"""Unit tests for the six built-in teaching skills (spec 014 T3.4-T3.9).

Each skill is loaded through the real `SkillLoader` pointed at the
`src/systemedu/tutor/skills/` tree so the SKILL.md + skill.py pair is
exercised end-to-end. A tiny fake LLM is passed to `build_subgraph`
so we don't touch the network.

Coverage (from tasks.md lines 319-346):
- socratic-questioning: 5 question templates, 2-round stuck adjustment,
  max_turns escalation, early-exit on "直接告诉我"
- direct-instruction: fact query → direct answer, explanation → practice
- scaffolding: renders memory block, uses SKILL.md body as system prompt
- error-diagnosis: classify concept/calc/strategy, unknown fallback
- pbl-driving-question: first turn of new knode, cites L1 interest
- reflection-prompt: metacognition prompt, ready_to_complete parsing
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from systemedu.tutor.skills import SkillLoader


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------
class FakeLLM:
    """Queue-based fake LLM — pops the next scripted reply per call.

    Records every (system, user) prompt pair so tests can assert which
    instructions the skill produced.
    """

    def __init__(self, replies: list[str]):
        self._replies = list(replies)
        self.calls: list[tuple[str, str]] = []

    async def ainvoke(self, messages: list[BaseMessage]) -> AIMessage:
        sys_text = ""
        user_text = ""
        for m in messages:
            if isinstance(m, SystemMessage):
                sys_text = m.content if isinstance(m.content, str) else str(m.content)
            elif isinstance(m, HumanMessage):
                user_text = m.content if isinstance(m.content, str) else str(m.content)
        self.calls.append((sys_text, user_text))
        if not self._replies:
            raise AssertionError("FakeLLM ran out of scripted replies")
        return AIMessage(content=self._replies.pop(0))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
SKILLS_ROOT = (
    Path(__file__).resolve().parents[3]
    / "src"
    / "systemedu"
    / "tutor"
    / "skills"
)


@pytest.fixture(scope="module")
def loader() -> SkillLoader:
    l = SkillLoader([SKILLS_ROOT])
    l.scan()
    return l


def _memory_fixture(**overrides: Any) -> dict[str, Any]:
    base = {
        "l1_profile": "小明 12 岁，爱踢足球",
        "l2_project_ctx": "当前项目：火星探测器设计（进度 30%）",
        "l3_knode_state": "knode m5 尚未通过；m5 的前置是 m4（已过）",
        "l4_semantic_recall": ["上次他把 force 说成 mass 的例子", "类似题答错过"],
        "l5_skill_ctx": "上一轮是 direct-instruction，讲了牛顿第二定律",
    }
    base.update(overrides)
    return base


def _state(**overrides: Any) -> dict[str, Any]:
    base = {
        "messages": [HumanMessage(content="我该怎么想这个问题？")],
        "turn_count": 0,
        "memory": _memory_fixture(),
    }
    base.update(overrides)
    return base


# ===========================================================================
# T3.4 socratic-questioning
# ===========================================================================
class TestSocraticQuestioning:
    def _skill(self, loader: SkillLoader):
        s = loader.get("socratic-questioning")
        assert s is not None
        return s

    def test_skill_config_matches_md(self, loader):
        s = self._skill(loader)
        assert s.config.max_turns == 5
        assert s.config.priority >= 50
        assert "search_student_facts" in s.config.tools
        assert "get_knode_content" in s.config.tools
        assert "get_knode_prerequisites" in s.config.tools

    @pytest.mark.asyncio
    async def test_exploring_asks_question(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["你觉得这个力的方向可能是哪边？"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(
            _state(messages=[HumanMessage(content="我试过但不确定")])
        )
        assert result["turn_count"] == 1
        assert result["progress"] == "exploring"
        assert len(result["questions_asked"]) == 1
        assert "方向" in result["questions_asked"][0]
        assert result["stuck_streak"] == 0
        # Single question issued (AIMessage appended)
        ai_msgs = [m for m in result["messages"] if isinstance(m, AIMessage)]
        assert len(ai_msgs) == 1

    @pytest.mark.asyncio
    async def test_early_exit_on_direct_answer_request(self, loader):
        """'直接告诉我' marks progress=breakthrough (exit-worthy)."""
        s = self._skill(loader)
        llm = FakeLLM(["好，让我们直接看结论。"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(
            _state(messages=[HumanMessage(content="别问了，直接告诉我答案")])
        )
        assert result["progress"] == "breakthrough"
        assert len(llm.calls) == 1  # still ran LLM once before exit

    @pytest.mark.asyncio
    async def test_stuck_streak_increments(self, loader):
        """One "不知道" → stuck_streak=1, stays exploring; follow-up LLM call still fires."""
        s = self._skill(loader)
        llm = FakeLLM(["换个角度：如果这个球不动呢？"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(
            _state(messages=[HumanMessage(content="我不知道")])
        )
        assert result["stuck_streak"] == 1
        assert result["progress"] == "exploring"
        # The LLM prompt should carry the difficulty-down hint
        assert "卡壳" in llm.calls[0][1] or "降低" in llm.calls[0][1]

    @pytest.mark.asyncio
    async def test_two_rounds_stuck_triggers_escalation(self, loader):
        """stuck_streak=1 coming in + new 'i don't know' → stuck → escalation node."""
        s = self._skill(loader)
        llm = FakeLLM([])  # escalation path doesn't call LLM
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(
            _state(
                messages=[HumanMessage(content="还是不会")],
                stuck_streak=1,
            )
        )
        assert result["progress"] == "stuck"
        assert result["escalation_hint"] is not None
        assert "scaffolding" in result["escalation_hint"]
        assert result["last_step"] == "set_escalation"

    def test_summarize_state_mentions_progress(self, loader):
        s = self._skill(loader)
        text = s.summarize_state(
            {
                "turn_count": 3,
                "progress": "exploring",
                "questions_asked": ["q1", "q2", "q3"],
                "escalation_hint": None,
            }
        )
        assert "socratic" in text
        assert "turn 3" in text
        assert "3" in text

    def test_summarize_state_includes_escalation(self, loader):
        s = self._skill(loader)
        text = s.summarize_state(
            {
                "turn_count": 5,
                "progress": "stuck",
                "questions_asked": ["q1"],
                "escalation_hint": "切 scaffolding",
            }
        )
        assert "escalation" in text
        assert "切 scaffolding" in text


# ===========================================================================
# T3.5 direct-instruction
# ===========================================================================
class TestDirectInstruction:
    def _skill(self, loader: SkillLoader):
        s = loader.get("direct-instruction")
        assert s is not None
        return s

    def test_config(self, loader):
        s = self._skill(loader)
        assert s.config.max_turns == 3
        assert "get_knode_content" in s.config.tools
        assert "get_practice_exercises" in s.config.tools
        assert "complete_node" in s.config.tools

    @pytest.mark.asyncio
    async def test_turn1_explains_structured(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["核心是加速度等于合力除以质量。机制：...。例：推车"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["turn_count"] == 1
        assert result["stage"] == "explain"
        assert result["should_push_exercise"] is False
        assert "结论" in llm.calls[0][1] or "三段" in llm.calls[0][1]

    @pytest.mark.asyncio
    async def test_turn2_pushes_check_question(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["如果合力是 10N 质量 2kg，加速度是多少？"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state(turn_count=1))
        assert result["turn_count"] == 2
        assert result["stage"] == "check"
        assert result["should_push_exercise"] is True
        # Prompt should ask LLM to emit a check question without answer
        assert "检验" in llm.calls[0][1] or "不要给答案" in llm.calls[0][1]


# ===========================================================================
# T3.6 scaffolding
# ===========================================================================
class TestScaffolding:
    def _skill(self, loader: SkillLoader):
        s = loader.get("scaffolding")
        assert s is not None
        return s

    def test_config(self, loader):
        s = self._skill(loader)
        assert s.config.max_turns == 4
        assert "get_knode_prerequisites" in s.config.tools
        assert "search_student_facts" in s.config.tools

    @pytest.mark.asyncio
    async def test_memory_is_rendered_into_prompt(self, loader):
        """Scaffolding needs L3 knode_state to pick the prerequisite."""
        s = self._skill(loader)
        llm = FakeLLM(["我们先复习一下 m4 的例子 ..."])
        graph = s.build_subgraph(llm, [])
        await graph.ainvoke(_state())
        # User block must carry the L3 knode_state so LLM can see prereqs
        assert "m4" in llm.calls[0][1]
        # System prompt must be the SKILL.md body
        assert "脚手架" in llm.calls[0][0] or "降阶" in llm.calls[0][0]

    @pytest.mark.asyncio
    async def test_turn_count_and_summary(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["reply"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state(turn_count=2))
        assert result["turn_count"] == 3
        assert "scaffolding" in result["summary"]


# ===========================================================================
# T3.7 error-diagnosis
# ===========================================================================
class TestErrorDiagnosis:
    def _skill(self, loader: SkillLoader):
        s = loader.get("error-diagnosis")
        assert s is not None
        return s

    def test_config(self, loader):
        s = self._skill(loader)
        assert s.config.max_turns == 2
        assert "grade_submission" in s.config.tools

    @pytest.mark.asyncio
    async def test_classify_concept(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(
            [
                "你把质量当成力了，属于概念混淆。\n"
                "error_type: concept"
            ]
        )
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(
            _state(messages=[HumanMessage(content="F=mass × acceleration 所以 F 就是 mass")])
        )
        assert result["error_type"] == "concept"
        assert result["turn_count"] == 1
        assert "diagnosed concept" in result["summary"]

    @pytest.mark.asyncio
    async def test_classify_calc(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["计算有误：2*5 不是 12。\nerror_type: calc"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["error_type"] == "calc"

    @pytest.mark.asyncio
    async def test_classify_strategy(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["你从结论出发了。\nerror_type: strategy"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["error_type"] == "strategy"

    @pytest.mark.asyncio
    async def test_unknown_when_marker_missing(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["嗯我看不出来哪里错。"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["error_type"] == "unknown"

    @pytest.mark.asyncio
    async def test_fullwidth_colon_also_parses(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["诊断:单位换算错误。\nerror_type：calc"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["error_type"] == "calc"


# ===========================================================================
# T3.8 pbl-driving-question
# ===========================================================================
class TestPblDrivingQuestion:
    def _skill(self, loader: SkillLoader):
        s = loader.get("pbl-driving-question")
        assert s is not None
        return s

    def test_config(self, loader):
        s = self._skill(loader)
        assert s.config.max_turns == 2
        assert "search_student_facts" in s.config.tools

    @pytest.mark.asyncio
    async def test_first_turn_cites_l1_interest(self, loader):
        """Driving question prompt should have access to L1 profile."""
        s = self._skill(loader)
        llm = FakeLLM(["你既然喜欢踢足球，想象 ..."])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["turn_count"] == 1
        # L1 profile must reach the LLM so it can cite interest
        assert "足球" in llm.calls[0][1]
        assert "小明" in llm.calls[0][1]
        assert "pbl" in result["summary"]


# ===========================================================================
# T3.9 reflection-prompt
# ===========================================================================
class TestReflectionPrompt:
    def _skill(self, loader: SkillLoader):
        s = loader.get("reflection-prompt")
        assert s is not None
        return s

    def test_config(self, loader):
        s = self._skill(loader)
        assert s.config.max_turns == 3
        assert "complete_node" in s.config.tools

    @pytest.mark.asyncio
    async def test_ready_yes_sets_flag(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["太棒了，你总结得很完整。\nready_to_complete: yes"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(
            _state(
                messages=[
                    HumanMessage(content="我理解了加速度是合力除以质量，单位是 m/s²")
                ]
            )
        )
        assert result["ready_to_complete"] is True
        assert "ready_for_complete" in result["summary"]

    @pytest.mark.asyncio
    async def test_ready_no_keeps_prompting(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["能再举一个例子吗？\nready_to_complete: no"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["ready_to_complete"] is False
        assert "reflect" in result["summary"]

    @pytest.mark.asyncio
    async def test_ready_missing_defaults_to_false(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["再想想？"])  # no marker
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["ready_to_complete"] is False

    @pytest.mark.asyncio
    async def test_fullwidth_colon(self, loader):
        s = self._skill(loader)
        llm = FakeLLM(["行。\nready_to_complete：YES"])
        graph = s.build_subgraph(llm, [])
        result = await graph.ainvoke(_state())
        assert result["ready_to_complete"] is True


# ===========================================================================
# Cross-cutting: all six skills load and compile
# ===========================================================================
class TestLoadAllBuiltinSkills:
    EXPECTED = [
        "socratic-questioning",
        "direct-instruction",
        "scaffolding",
        "error-diagnosis",
        "pbl-driving-question",
        "reflection-prompt",
    ]

    def test_all_six_skills_discovered(self, loader):
        found = {s.config.name for s in loader.list_all()}
        for name in self.EXPECTED:
            assert name in found, f"skill {name!r} missing from loader"

    @pytest.mark.asyncio
    async def test_every_skill_compiles_and_runs_one_turn(self, loader):
        for name in self.EXPECTED:
            skill = loader.get(name)
            assert skill is not None, name
            # Scripted reply with both marker suffixes so any parser is happy
            llm = FakeLLM(
                ["一个回复。\nerror_type: concept\nready_to_complete: no"] * 3
            )
            graph = skill.build_subgraph(llm, [])
            result = await graph.ainvoke(_state())
            assert result.get("turn_count", 0) >= 1, f"{name} did not advance turn_count"
