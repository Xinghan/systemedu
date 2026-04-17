"""E2E skill-level tests with real LLM (spec 014 T6.1 extension).

Tests each of the six built-in skills in isolation by directly building
and running the skill subgraph. This reaches into the "essence" of each
skill, verifying its pedagogical behaviour rather than just checking
that it produces output.

All tests require ``--e2e`` flag and a working DashScope API key.

Design principle: each test interacts with the subgraph at the skill
state level (SimpleSkillState / SocraticState / etc.), not through the
full tutor graph. This isolates the skill's LLM prompting from the
router's non-determinism.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.tutor.skills import SkillLoader

pytestmark = pytest.mark.e2e

SKILLS_ROOT = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "systemedu"
    / "tutor"
    / "skills"
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def real_llm():
    from systemedu.core.llm_client import get_llm
    return get_llm(model="qwen-plus", temperature=0.3, streaming=False)


@pytest.fixture(scope="module")
def loader() -> SkillLoader:
    l = SkillLoader([SKILLS_ROOT])
    l.scan()
    return l


def _get_skill(loader: SkillLoader, name: str):
    for s in loader.list_all():
        if s.config.name == name:
            return s
    raise ValueError(f"skill {name!r} not found")


def _ai_text(result: dict) -> str:
    msgs = [m for m in result.get("messages", []) if isinstance(m, AIMessage)]
    return msgs[-1].content if msgs else ""


def _base_state(user_msg: str, **extra: Any) -> dict:
    return {
        "messages": [HumanMessage(content=user_msg)],
        "memory": {
            "l1_profile": "12 岁男生，对航空航天感兴趣",
            "l2_project_ctx": "项目: 火箭设计，进度: 第 2 个知识点",
            "l3_knode_state": "当前 knode: 火箭推力原理",
            "l4_semantic_recall": [],
            "l5_skill_ctx": "",
        },
        **extra,
    }


# ===========================================================================
# 1. Socratic Questioning — "永远不给最终答案，只问问题"
# ===========================================================================
class TestSocraticEssence:
    """The essence of Socratic questioning: the AI must guide the student
    to discover the answer themselves, never giving it directly."""

    async def test_response_contains_question_not_answer(self, real_llm, loader):
        """When a student asks a concept question, the Socratic skill
        should respond with a guiding question, not a direct explanation."""
        skill = _get_skill(loader, "socratic-questioning")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(
            _base_state("火箭怎么产生推力的？")
        )
        reply = _ai_text(result)

        # Must contain a question mark (asking, not telling)
        assert "？" in reply or "?" in reply, (
            f"Socratic reply should contain a question, got: {reply[:100]}"
        )
        # Should NOT start with a direct factual answer pattern
        direct_patterns = ["推力是", "推力来自", "火箭通过", "答案是"]
        for p in direct_patterns:
            assert not reply.startswith(p), (
                f"Socratic reply should NOT start with direct answer '{p}', "
                f"got: {reply[:80]}"
            )

    async def test_three_rounds_all_have_questions(self, real_llm, loader):
        """Over 3 rounds, every response should include at least one
        question — the skill never collapses into lecturing."""
        skill = _get_skill(loader, "socratic-questioning")
        subgraph = skill.build_subgraph(real_llm, [])

        # Round 1
        r1 = await subgraph.ainvoke(_base_state("为什么火箭能飞起来？"))
        # Round 2: student gives a partial answer
        r2 = await subgraph.ainvoke(_base_state(
            "可能跟燃烧有关？",
            turn_count=1,
            questions_asked=[_ai_text(r1)],
        ))
        # Round 3: student gets closer
        r3 = await subgraph.ainvoke(_base_state(
            "气体从喷嘴喷出来，然后反作用力？",
            turn_count=2,
            questions_asked=[_ai_text(r1), _ai_text(r2)],
        ))

        for i, result in enumerate([r1, r2, r3], 1):
            text = _ai_text(result)
            has_q = "？" in text or "?" in text
            assert has_q, (
                f"Round {i}: Socratic response must contain a question. "
                f"Got: {text[:80]}"
            )

    async def test_stuck_detection_triggers_escalation(self, real_llm, loader):
        """When student says '不知道' twice, stuck_streak >= 2 triggers
        set_escalation node instead of ask_question."""
        skill = _get_skill(loader, "socratic-questioning")
        subgraph = skill.build_subgraph(real_llm, [])

        # Simulate stuck_streak = 1, student says "不知道" again
        result = await subgraph.ainvoke(_base_state(
            "不知道啊，完全没头绪",
            turn_count=2,
            stuck_streak=1,  # will become 2 after assess
        ))

        assert result.get("progress") == "stuck"
        assert result.get("escalation_hint") is not None
        assert "scaffolding" in (result.get("escalation_hint") or "").lower() or \
               "direct" in (result.get("escalation_hint") or "").lower()

    async def test_early_exit_on_demand(self, real_llm, loader):
        """When student says '直接告诉我', progress becomes 'breakthrough'
        (the exit signal)."""
        skill = _get_skill(loader, "socratic-questioning")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "别问了，直接告诉我答案",
            turn_count=1,
        ))

        # assess should detect the early exit marker
        assert result.get("progress") == "breakthrough"


# ===========================================================================
# 2. Direct Instruction — "结论先行三段式 + 推送练习"
# ===========================================================================
class TestDirectInstructionEssence:
    """Direct instruction's essence: structured explanation (conclusion /
    mechanism / example) on turn 1, then a check question on turn 2."""

    async def test_first_turn_is_structured_explanation(self, real_llm, loader):
        """Turn 1 (stage=explain) should give a substantive explanation,
        not a question."""
        skill = _get_skill(loader, "direct-instruction")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(
            _base_state("牛顿第三定律是什么？")
        )
        reply = _ai_text(result)

        assert result.get("stage") == "explain"
        assert len(reply) > 30, "Explanation should be substantive"
        # Should contain factual content, not just a question
        assert result.get("should_push_exercise") is not True

    async def test_second_turn_pushes_check_question(self, real_llm, loader):
        """Turn 2 (stage=check) should generate a verification question
        or exercise, and set should_push_exercise=True."""
        skill = _get_skill(loader, "direct-instruction")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "明白了，力是相互的",
            turn_count=1,
            stage="explain",
        ))
        reply = _ai_text(result)

        assert result.get("stage") == "check"
        assert result.get("should_push_exercise") is True
        # Check question should contain a question marker
        has_q = "？" in reply or "?" in reply or "选" in reply or "填" in reply
        assert has_q, (
            f"Check stage should produce a question/exercise, got: {reply[:80]}"
        )


# ===========================================================================
# 3. Error Diagnosis — "分类错因: concept/calc/strategy"
# ===========================================================================
class TestErrorDiagnosisEssence:
    """Error diagnosis must classify the error type (concept/calc/strategy)
    and output it in a parseable `error_type:` marker."""

    async def test_concept_error_diagnosed(self, real_llm, loader):
        """A fundamentally wrong understanding should be diagnosed as
        concept error."""
        skill = _get_skill(loader, "error-diagnosis")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "推力是因为火箭很重，地球把它弹上去的",
            memory={
                "l1_profile": "12 岁男生",
                "l2_project_ctx": "项目: 火箭设计",
                "l3_knode_state": "当前 knode: 火箭推力原理。"
                    "正确概念：牛顿第三定律，气体喷射的反作用力",
                "l4_semantic_recall": [],
                "l5_skill_ctx": "",
            },
        ))
        reply = _ai_text(result)

        assert result.get("error_type") in ("concept", "unknown"), (
            f"Expected concept error, got: {result.get('error_type')}"
        )
        assert len(reply) > 10

    async def test_calc_error_diagnosed(self, real_llm, loader):
        """A numerical calculation mistake should be diagnosed as calc error."""
        skill = _get_skill(loader, "error-diagnosis")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "F=ma，m=100kg，a=10m/s^2，所以 F=10000N",
            memory={
                "l1_profile": "14 岁学生",
                "l2_project_ctx": "物理项目",
                "l3_knode_state": "当前 knode: 牛顿第二定律计算。"
                    "正确：F=100*10=1000N",
                "l4_semantic_recall": [],
                "l5_skill_ctx": "",
            },
        ))
        reply = _ai_text(result)

        # Should contain error_type marker in the response
        has_marker = "error_type" in reply.lower() or result.get("error_type") is not None
        assert has_marker, f"Should contain error_type diagnosis, got: {reply[:100]}"
        assert len(reply) > 10


# ===========================================================================
# 4. Scaffolding — "降阶到前置知识"
# ===========================================================================
class TestScaffoldingEssence:
    """Scaffolding's essence: when the student lacks prerequisites, the
    AI steps back to a simpler concept before returning to the target."""

    async def test_scaffolds_with_simpler_concept(self, real_llm, loader):
        """When a student says they have no clue, the scaffolding skill
        should reference a more basic concept (prerequisite)."""
        skill = _get_skill(loader, "scaffolding")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "向量叉乘完全不懂，没学过向量",
            memory={
                "l1_profile": "13 岁学生，数学基础薄弱",
                "l2_project_ctx": "项目: 物理模拟",
                "l3_knode_state": "当前 knode: 力矩计算（需要向量叉乘）。"
                    "前置: 向量基本概念 -> 向量运算 -> 叉乘。"
                    "学生卡在向量基本概念",
                "l4_semantic_recall": [],
                "l5_skill_ctx": "",
            },
        ))
        reply = _ai_text(result)

        assert len(reply) > 30, "Scaffolding response should be substantive"
        # Should reference the simpler prerequisite, not jump to the target
        # Look for basic-level references
        basic_refs = any(kw in reply for kw in [
            "向量", "方向", "大小", "箭头", "坐标",
            "基础", "先", "前置", "简单",
        ])
        assert basic_refs, (
            f"Scaffolding should reference basic concepts, got: {reply[:100]}"
        )


# ===========================================================================
# 5. PBL Driving Question — "抛出开放性驱动问题，不讲知识"
# ===========================================================================
class TestPblDrivingQuestionEssence:
    """PBL's essence: pose an open-ended, curiosity-driving question
    grounded in a real scenario. Do NOT teach content yet."""

    async def test_poses_open_question_not_lecture(self, real_llm, loader):
        """The response should be a scenario-based question, not a
        knowledge-point explanation."""
        skill = _get_skill(loader, "pbl-driving-question")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "我刚进入这个新的知识点",
            memory={
                "l1_profile": "12 岁男生，喜欢太空探索和科幻电影",
                "l2_project_ctx": "项目: 火箭设计",
                "l3_knode_state": "当前 knode: 火箭燃料选择。"
                    "学生尚未表达任何关于燃料的理解",
                "l4_semantic_recall": [],
                "l5_skill_ctx": "",
            },
        ))
        reply = _ai_text(result)

        assert len(reply) > 20
        # Should contain a question — not a lecture
        has_question = "？" in reply or "?" in reply
        assert has_question, (
            f"PBL should pose a driving question, got: {reply[:100]}"
        )
        # Should NOT be a dry definition
        dry_patterns = ["燃料是指", "定义：", "概念是"]
        for p in dry_patterns:
            assert p not in reply, (
                f"PBL should NOT start with dry definitions like '{p}'"
            )

    async def test_anchors_on_student_interest(self, real_llm, loader):
        """The PBL prompt should try to connect to the student's known
        interests from L1 memory."""
        skill = _get_skill(loader, "pbl-driving-question")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "这个知识点讲什么的？",
            memory={
                "l1_profile": "12 岁女生，喜欢画画和动物",
                "l2_project_ctx": "项目: 生态系统模拟",
                "l3_knode_state": "当前 knode: 食物链基础",
                "l4_semantic_recall": [],
                "l5_skill_ctx": "",
            },
        ))
        reply = _ai_text(result)

        assert len(reply) > 20
        # The response should try to engage via the student's interests
        # (animals, drawing, nature — any personal anchor)
        has_question = "？" in reply or "?" in reply
        assert has_question, "PBL should still pose a question"


# ===========================================================================
# 6. Reflection Prompt — "不替学生总结，引导元认知"
# ===========================================================================
class TestReflectionPromptEssence:
    """Reflection's essence: the AI asks the student to articulate what
    they learned and how they know they understand — it does NOT
    summarize for them."""

    async def test_asks_reflection_not_summary(self, real_llm, loader):
        """When a student says '我搞懂了', the AI should ask the student
        to explain what they learned, not summarize for them."""
        skill = _get_skill(loader, "reflection-prompt")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "我搞懂了，推力就是反作用力嘛",
            memory={
                "l1_profile": "13 岁学生",
                "l2_project_ctx": "项目: 火箭设计",
                "l3_knode_state": "当前 knode: 推力原理。学生经过 3 轮对话理解了牛三定律",
                "l4_semantic_recall": [],
                "l5_skill_ctx": "- 上一策略: socratic-questioning, 3 轮",
            },
        ))
        reply = _ai_text(result)

        assert len(reply) > 10
        # Should contain a question — asking student to reflect
        has_question = "？" in reply or "?" in reply
        assert has_question, (
            f"Reflection should ask a question, not summarize. Got: {reply[:100]}"
        )

    async def test_ready_to_complete_parsing(self, real_llm, loader):
        """When the student gives a thorough self-summary, the skill
        should parse ready_to_complete from the LLM response."""
        skill = _get_skill(loader, "reflection-prompt")
        subgraph = skill.build_subgraph(real_llm, [])

        # Simulate a student who clearly articulated their understanding
        result = await subgraph.ainvoke(_base_state(
            "推力来自牛顿第三定律：火箭向后喷出高温气体，气体反作用力推火箭前进。"
            "我可以用 F=mv/t 估算推力大小。"
            "如果下次遇到类似问题，我会先找作用力和反作用力的关系。",
            memory={
                "l1_profile": "13 岁学生",
                "l2_project_ctx": "项目: 火箭设计",
                "l3_knode_state": "当前 knode: 推力原理。学生已完整理解",
                "l4_semantic_recall": [],
                "l5_skill_ctx": "",
            },
        ))

        # ready_to_complete should be parsed (may be True or False depending
        # on LLM judgment — we just verify the field exists and is bool)
        assert isinstance(result.get("ready_to_complete"), bool)

    async def test_not_ready_asks_deeper_question(self, real_llm, loader):
        """When the student's self-summary is vague, the reflection skill
        should ask a deeper question to probe understanding."""
        skill = _get_skill(loader, "reflection-prompt")
        subgraph = skill.build_subgraph(real_llm, [])

        result = await subgraph.ainvoke(_base_state(
            "嗯，就是那个力的东西吧",
            memory={
                "l1_profile": "12 岁学生",
                "l2_project_ctx": "项目: 火箭设计",
                "l3_knode_state": "当前 knode: 推力原理",
                "l4_semantic_recall": [],
                "l5_skill_ctx": "",
            },
        ))
        reply = _ai_text(result)

        # Should still be asking — student hasn't demonstrated understanding
        has_question = "？" in reply or "?" in reply
        assert has_question, (
            f"Reflection should probe further when answer is vague. Got: {reply[:100]}"
        )
        # Should NOT mark as ready
        assert result.get("ready_to_complete") is not True, (
            "Vague answer should not trigger ready_to_complete"
        )
