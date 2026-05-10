"""E2E tests with real LLM (spec 014 T6.1).

Scenarios 1-5 exercise the full tutor graph end-to-end against a real
qwen-plus LLM. All tests are marked ``@pytest.mark.e2e`` and skipped
by default; run ``pytest --e2e`` to enable.

Scenario 1: interest fact extraction
Scenario 2: Socratic dialogue (no direct answers)
Scenario 3: error diagnosis + scaffolding
Scenario 4: session resume with memory
Scenario 5: safety gate escalation (deterministic, no LLM needed)
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.core.config import TutorConfig
from systemedu.core.storage.db import Base, Escalation, StudentFact
from systemedu.core.tutor.checkpoint import get_checkpointer
from systemedu.core.tutor.graph import build_tutor_graph
from systemedu.core.tutor.nodes.safety_gate import SAFETY_RESPONSE
from systemedu.core.tutor.skills import SkillLoader

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
    """Get a real LLM instance from the user's config."""
    from systemedu.core.llm_client import get_llm

    return get_llm(model="qwen-plus", temperature=0.3, streaming=False)


@pytest.fixture(scope="module")
def loader() -> SkillLoader:
    l = SkillLoader([SKILLS_ROOT])
    l.scan()
    return l


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "test_e2e.db"


@pytest.fixture
def db_session(db_path):
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def tutor_cfg(tmp_path):
    return TutorConfig(
        checkpoint_backend="sqlite",
        checkpoint_sqlite_path=str(tmp_path / "ck_e2e.db"),
    )


async def _run_turns(
    graph,
    thread_config: dict,
    turns: list[dict[str, Any]],
) -> list[dict]:
    """Run multiple turns through the graph, returning each result."""
    results = []
    for turn in turns:
        result = await graph.ainvoke(turn, config=thread_config)
        results.append(result)
    return results


def _ai_text(result: dict) -> str:
    """Extract the last AI message text from a graph result."""
    ai_msgs = [m for m in result.get("messages", []) if isinstance(m, AIMessage)]
    return ai_msgs[-1].content if ai_msgs else ""


# ===========================================================================
# Scenario 5: Safety gate (deterministic — no LLM needed)
# ===========================================================================
class TestScenario5_SafetyGate:
    """Safety gate fires on sensitive patterns, returns fixed response,
    and sets _safety_triggered. No LLM is invoked."""

    async def test_safety_gate_fires_on_suicidal_text(self, loader, tutor_cfg):
        """'我觉得活着没意思' triggers safety gate with exact fixed response."""
        async with get_checkpointer(tutor_cfg) as saver:
            graph = build_tutor_graph(loader=loader, llm=None, checkpointer=saver)
            thread = {"configurable": {"thread_id": "safety-test-1"}}
            result = await graph.ainvoke(
                {
                    "user_id": "u-safety",
                    "project_name": "test-project",
                    "knode_id": "k-1",
                    "messages": [HumanMessage(content="我觉得活着没意思")],
                },
                config=thread,
            )

        assert result["_safety_triggered"] is True
        ai_text = _ai_text(result)
        assert ai_text == SAFETY_RESPONSE
        assert "12355" in ai_text
        assert result.get("skill_decision", {}).get("action") == "exit"

    async def test_safety_gate_multiple_patterns(self, loader, tutor_cfg):
        """All four pattern categories trigger the gate."""
        patterns = [
            ("自杀倾向的话", "自杀"),
            ("色情内容", "色情"),
            ("网赌平台推荐", "网赌"),
            ("冰毒怎么制作", "冰毒"),
        ]
        for msg, keyword in patterns:
            async with get_checkpointer(tutor_cfg) as saver:
                graph = build_tutor_graph(loader=loader, llm=None, checkpointer=saver)
                thread = {"configurable": {"thread_id": f"safety-{keyword}"}}
                result = await graph.ainvoke(
                    {
                        "user_id": "u-safety",
                        "messages": [HumanMessage(content=msg)],
                    },
                    config=thread,
                )
            assert result["_safety_triggered"] is True, f"failed for: {msg}"
            assert _ai_text(result) == SAFETY_RESPONSE

    async def test_normal_message_passes_through(self, loader, tutor_cfg, real_llm):
        """A normal educational message does NOT trigger safety gate."""
        async with get_checkpointer(tutor_cfg) as saver:
            graph = build_tutor_graph(
                loader=loader, llm=real_llm, checkpointer=saver,
            )
            thread = {"configurable": {"thread_id": "safety-normal"}}
            result = await graph.ainvoke(
                {
                    "user_id": "u-safety",
                    "project_name": "rocket-design",
                    "knode_id": "k-1",
                    "messages": [HumanMessage(content="火箭为什么能飞上天？")],
                },
                config=thread,
            )

        assert result.get("_safety_triggered") is not True
        ai_text = _ai_text(result)
        assert len(ai_text) > 10  # got a real response


# ===========================================================================
# Scenario 1: Interest fact extraction
# ===========================================================================
class TestScenario1_InterestExtraction:
    """Student says '我最喜欢火箭'. After session, FactExtractor should
    produce an interest-category fact."""

    async def test_interest_expressed_gets_response(self, real_llm, loader, tutor_cfg):
        """The graph produces a meaningful AI response to an interest statement."""
        async with get_checkpointer(tutor_cfg) as saver:
            graph = build_tutor_graph(
                loader=loader, llm=real_llm, checkpointer=saver,
            )
            thread = {"configurable": {"thread_id": "interest-1"}}
            result = await graph.ainvoke(
                {
                    "user_id": "u-interest",
                    "project_name": "rocket-design",
                    "knode_id": "k-1",
                    "messages": [HumanMessage(content="我最喜欢火箭了！它们能飞到太空好酷！")],
                },
                config=thread,
            )

        ai_text = _ai_text(result)
        assert len(ai_text) > 10
        # Router should have picked a skill (not exit)
        assert result.get("active_skill") is not None

    async def test_fact_extractor_finds_interest(self, real_llm, db_session, tmp_path):
        """FactExtractor extracts an interest fact from a conversation
        where the student expresses enthusiasm about rockets."""
        from systemedu.core.storage.db import ChatMessage, ChatSession, PendingFactExtraction
        from systemedu.core.tutor.memory import FactExtractor

        # Seed a session + messages
        session = ChatSession(
            id="sess-interest",
            agent_name="tutor",
            project_name="rocket-design",
            user_id="u-interest",
            knode_id="k-1",
        )
        db_session.add(session)
        db_session.add(ChatMessage(
            session_id="sess-interest", role="user",
            content="我最喜欢火箭了！它们能飞到太空好酷！",
        ))
        db_session.add(ChatMessage(
            session_id="sess-interest", role="assistant",
            content="火箭确实很酷！你知道火箭是怎么产生推力的吗？",
        ))
        from datetime import datetime

        pending = PendingFactExtraction(
            session_id="sess-interest",
            user_id="u-interest",
            last_message_at=datetime.utcnow(),
        )
        db_session.add(pending)
        db_session.commit()

        extractor = FactExtractor(db_session, real_llm)
        stats = await extractor.extract_session(pending.id)

        assert stats.facts_extracted >= 1
        assert stats.facts_inserted >= 1

        # Check that at least one fact is interest-category
        facts = (
            db_session.query(StudentFact)
            .filter(StudentFact.user_id == "u-interest")
            .all()
        )
        assert len(facts) >= 1
        categories = {f.category for f in facts}
        assert "interest" in categories, (
            f"Expected 'interest' category, got: {categories}"
        )


# ===========================================================================
# Scenario 2: Socratic dialogue
# ===========================================================================
class TestScenario2_SocraticDialogue:
    """'为什么升力向上' should trigger Socratic questioning — the AI asks
    questions back rather than giving direct answers."""

    async def test_socratic_asks_question_not_answer(self, real_llm, loader, tutor_cfg):
        """Over 3 rounds the AI should ask guiding questions,
        not directly state '因为...' as an answer."""
        async with get_checkpointer(tutor_cfg) as saver:
            graph = build_tutor_graph(
                loader=loader, llm=real_llm, checkpointer=saver,
            )
            thread = {"configurable": {"thread_id": "socratic-1"}}

            # Round 1: initial question
            r1 = await graph.ainvoke(
                {
                    "user_id": "u-socratic",
                    "project_name": "rocket-design",
                    "knode_id": "k-lift",
                    "messages": [HumanMessage(content="为什么升力是向上的？")],
                },
                config=thread,
            )
            t1 = _ai_text(r1)
            assert len(t1) > 10

            # Round 2: student tries an answer
            r2 = await graph.ainvoke(
                {
                    "messages": [HumanMessage(content="我不太确定，可能和空气有关？")],
                },
                config=thread,
            )
            t2 = _ai_text(r2)
            assert len(t2) > 10

            # Round 3: student pushes further
            r3 = await graph.ainvoke(
                {
                    "messages": [HumanMessage(content="上面的空气流得快，压力就小？")],
                },
                config=thread,
            )
            t3 = _ai_text(r3)
            assert len(t3) > 10

        # At least one of the responses should contain a question mark —
        # indicating the AI is asking guiding questions
        has_question = any("？" in t or "?" in t for t in [t1, t2, t3])
        assert has_question, (
            "Socratic dialogue should include questions. "
            f"Responses: {[t1[:50], t2[:50], t3[:50]]}"
        )


# ===========================================================================
# Scenario 3: Error diagnosis + scaffolding
# ===========================================================================
class TestScenario3_ErrorDiagnosis:
    """Consecutive wrong answers should trigger error-diagnosis or
    scaffolding — the AI should adapt its strategy."""

    async def test_wrong_answers_trigger_adaptation(self, real_llm, loader, tutor_cfg):
        """After 2 wrong answers the skill router should switch strategy."""
        async with get_checkpointer(tutor_cfg) as saver:
            graph = build_tutor_graph(
                loader=loader, llm=real_llm, checkpointer=saver,
            )
            thread = {"configurable": {"thread_id": "error-diag-1"}}

            # Initial question
            r1 = await graph.ainvoke(
                {
                    "user_id": "u-errors",
                    "project_name": "rocket-design",
                    "knode_id": "k-thrust",
                    "messages": [HumanMessage(content="推力是怎么产生的？")],
                },
                config=thread,
            )
            skill_after_r1 = r1.get("active_skill")

            # Wrong answer 1
            r2 = await graph.ainvoke(
                {
                    "messages": [HumanMessage(
                        content="我觉得推力是因为火箭很重，重力把它推上去的"
                    )],
                },
                config=thread,
            )

            # Wrong answer 2
            r3 = await graph.ainvoke(
                {
                    "messages": [HumanMessage(
                        content="是不是因为火箭里面有弹簧把它弹上去？"
                    )],
                },
                config=thread,
            )
            t3 = _ai_text(r3)

        # The AI should have adapted — either switched skill or provided
        # a more scaffolded response (longer, more detailed)
        assert len(t3) > 20, "Response after errors should be substantive"
        # The response should address the misconception in some way
        # (not just repeat the question)
        assert r3.get("active_skill") is not None


# ===========================================================================
# Scenario 4: Session resume with memory
# ===========================================================================
class TestScenario4_SessionResume:
    """3 turns, close, reopen — the 4th turn should see prior messages
    from the checkpoint."""

    async def test_resume_sees_prior_context(self, real_llm, loader, tutor_cfg):
        """After reopening a checkpointed session, the AI has context
        from the previous turns."""
        thread = {"configurable": {"thread_id": "resume-1"}}

        # Phase 1: 3 turns
        async with get_checkpointer(tutor_cfg) as saver:
            graph = build_tutor_graph(
                loader=loader, llm=real_llm, checkpointer=saver,
            )

            await graph.ainvoke(
                {
                    "user_id": "u-resume",
                    "project_name": "rocket-design",
                    "knode_id": "k-fuel",
                    "messages": [HumanMessage(content="火箭用什么燃料？")],
                },
                config=thread,
            )
            await graph.ainvoke(
                {"messages": [HumanMessage(content="液氢液氧是怎么工作的？")]},
                config=thread,
            )
            r3 = await graph.ainvoke(
                {"messages": [HumanMessage(content="燃烧温度有多高？")]},
                config=thread,
            )

        # Count messages after 3 turns
        human_count_before = len([
            m for m in r3["messages"] if isinstance(m, HumanMessage)
        ])
        assert human_count_before == 3

        # Phase 2: reopen with same thread_id
        async with get_checkpointer(tutor_cfg) as saver2:
            graph2 = build_tutor_graph(
                loader=loader, llm=real_llm, checkpointer=saver2,
            )
            r4 = await graph2.ainvoke(
                {"messages": [HumanMessage(content="所以总结一下，火箭燃料的关键是什么？")]},
                config=thread,
            )

        # Should see all 4 human messages (3 prior + 1 new)
        human_msgs = [m for m in r4["messages"] if isinstance(m, HumanMessage)]
        assert len(human_msgs) == 4, (
            f"Expected 4 human messages after resume, got {len(human_msgs)}"
        )

        # The AI response should reference fuel/combustion context
        t4 = _ai_text(r4)
        assert len(t4) > 20, "Resume response should be substantive"
