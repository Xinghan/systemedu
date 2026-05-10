"""Tests for FactExtractor (spec 014 T2.3).

Mock LLM via a minimal object with `ainvoke`. Each test wires up a
fresh in-memory SQLite with a session, a couple of messages, and a
pending row pointing at them.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.core.storage.db import (
    Base,
    ChatMessage,
    ChatSession,
    PendingFactExtraction,
    StudentFact,
)
from systemedu.core.tutor.memory import FactExtractor


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@dataclass
class _FakeAIMessage:
    content: str


class FakeLLM:
    """Records calls, returns a queue of responses in order.

    If `responses` is a list, each ainvoke pops one off the front. If a
    response is a callable, it's called with the messages and its return
    value (string) is used.
    """

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls: list[list] = []

    async def ainvoke(self, messages):
        self.calls.append(messages)
        resp = self.responses.pop(0)
        if callable(resp):
            text = resp(messages)
        else:
            text = resp
        return _FakeAIMessage(content=text)


def _seed_session(db, *, user_id="u1", project="mars-rover", knode="k10"):
    session = ChatSession(
        id="sess-1",
        agent_name="tutor",
        project_name=project,
        user_id=user_id,
        knode_id=knode,
    )
    db.add(session)
    db.flush()

    m1 = ChatMessage(session_id="sess-1", role="user",
                     content="我看不懂坡度对摩擦力的影响")
    m2 = ChatMessage(session_id="sess-1", role="assistant",
                     content="让我们一步步想...")
    m3 = ChatMessage(session_id="sess-1", role="user",
                     content="哦我懂了！原来坡度越大下滑越快")
    db.add_all([m1, m2, m3])
    db.flush()

    pending = PendingFactExtraction(
        session_id="sess-1",
        user_id=user_id,
        last_message_at=datetime.utcnow(),
        first_unextracted_msg_id=None,
    )
    db.add(pending)
    db.flush()
    return session, pending, [m1, m2, m3]


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------
class TestExtractLegalJSON:
    @pytest.mark.asyncio
    async def test_inserts_fact_no_existing(self, db):
        _, pending, msgs = _seed_session(db)
        db.commit()

        extraction_resp = json.dumps([{
            "category": "knowledge",
            "content": "理解坡度与下滑速度的关系",
            "confidence": 0.8,
            "knode_id": "k10",
            "metadata": {"mastery_level": "understand"},
            "evidence_msg_ids": [msgs[2].id],
        }])
        llm = FakeLLM([extraction_resp])

        extractor = FactExtractor(db, llm)
        stats = await extractor.extract_session(pending.id)
        db.commit()

        facts = db.query(StudentFact).all()
        assert len(facts) == 1
        assert facts[0].category == "knowledge"
        assert facts[0].content == "理解坡度与下滑速度的关系"
        assert facts[0].fact_metadata["mastery_level"] == "understand"
        assert facts[0].fact_metadata["evidence_msg_ids"] == [msgs[2].id]
        assert facts[0].source_session_id == "sess-1"
        assert stats.facts_inserted == 1
        assert stats.facts_superseded == 0

    @pytest.mark.asyncio
    async def test_empty_array_no_facts(self, db):
        _, pending, _ = _seed_session(db)
        db.commit()

        llm = FakeLLM(["[]"])
        extractor = FactExtractor(db, llm)
        stats = await extractor.extract_session(pending.id)
        assert stats.facts_extracted == 0
        assert db.query(StudentFact).count() == 0

    @pytest.mark.asyncio
    async def test_multiple_facts_different_categories(self, db):
        _, pending, _ = _seed_session(db)
        db.commit()

        resp = json.dumps([
            {"category": "knowledge", "content": "懂坡度",
             "confidence": 0.8, "knode_id": "k10"},
            {"category": "interest", "content": "对机械很感兴趣",
             "confidence": 0.7, "knode_id": None},
        ])
        llm = FakeLLM([resp])
        extractor = FactExtractor(db, llm)
        await extractor.extract_session(pending.id)
        db.commit()

        assert db.query(StudentFact).count() == 2
        cats = {f.category for f in db.query(StudentFact).all()}
        assert cats == {"knowledge", "interest"}

    @pytest.mark.asyncio
    async def test_strips_markdown_code_fence(self, db):
        _, pending, _ = _seed_session(db)
        db.commit()

        wrapped = "```json\n" + json.dumps([{
            "category": "knowledge",
            "content": "懂了",
            "confidence": 0.7,
            "knode_id": "k10",
        }]) + "\n```"
        llm = FakeLLM([wrapped])
        extractor = FactExtractor(db, llm)
        stats = await extractor.extract_session(pending.id)
        db.commit()
        assert stats.facts_inserted == 1


# ---------------------------------------------------------------------------
# Malformed responses
# ---------------------------------------------------------------------------
class TestMalformed:
    @pytest.mark.asyncio
    async def test_non_json_raises(self, db):
        _, pending, _ = _seed_session(db)
        db.commit()

        llm = FakeLLM(["sorry I can't do that"])
        extractor = FactExtractor(db, llm)
        with pytest.raises(ValueError, match="non-JSON"):
            await extractor.extract_session(pending.id)

    @pytest.mark.asyncio
    async def test_object_not_list_raises(self, db):
        _, pending, _ = _seed_session(db)
        db.commit()

        llm = FakeLLM([json.dumps({"category": "knowledge", "content": "x"})])
        extractor = FactExtractor(db, llm)
        with pytest.raises(ValueError, match="list"):
            await extractor.extract_session(pending.id)

    @pytest.mark.asyncio
    async def test_missing_required_key_raises(self, db):
        _, pending, _ = _seed_session(db)
        db.commit()

        llm = FakeLLM([json.dumps([{"category": "knowledge"}])])  # no content
        extractor = FactExtractor(db, llm)
        with pytest.raises(ValueError, match="category/content"):
            await extractor.extract_session(pending.id)


# ---------------------------------------------------------------------------
# Supersede logic
# ---------------------------------------------------------------------------
class TestSupersede:
    @pytest.mark.asyncio
    async def test_overwrite_retires_old_fact(self, db):
        _, pending, _ = _seed_session(db)
        # seed an existing current fact
        old = StudentFact(
            user_id="u1", project_name="mars-rover", knode_id="k10",
            category="knowledge", content="刚接触坡度概念",
            confidence=0.6, fact_metadata={"mastery_level": "exposure"},
            valid_from=datetime.utcnow() - timedelta(days=5),
        )
        db.add(old)
        db.commit()

        extraction = json.dumps([{
            "category": "knowledge", "content": "理解坡度与摩擦的关系",
            "confidence": 0.85, "knode_id": "k10",
            "metadata": {"mastery_level": "understand"},
        }])
        supersede_decision = json.dumps({"action": "overwrite", "reason": "掌握度提升"})
        llm = FakeLLM([extraction, supersede_decision])
        extractor = FactExtractor(db, llm)

        stats = await extractor.extract_session(pending.id)
        db.commit()

        db.refresh(old)
        assert old.valid_to is not None
        assert old.superseded_by is not None

        all_facts = db.query(StudentFact).order_by(StudentFact.id).all()
        assert len(all_facts) == 2
        new = all_facts[-1]
        assert new.valid_to is None
        assert new.content == "理解坡度与摩擦的关系"
        assert old.superseded_by == new.id
        assert stats.facts_superseded == 1

    @pytest.mark.asyncio
    async def test_coexist_keeps_both_current(self, db):
        _, pending, _ = _seed_session(db)
        old = StudentFact(
            user_id="u1", project_name="mars-rover", knode_id="k10",
            category="interest", content="喜欢机械",
            confidence=0.7,
            valid_from=datetime.utcnow() - timedelta(days=3),
        )
        db.add(old)
        db.commit()

        extraction = json.dumps([{
            "category": "interest", "content": "对编程也感兴趣",
            "confidence": 0.7, "knode_id": "k10",
        }])
        llm = FakeLLM([extraction, json.dumps({"action": "coexist"})])
        extractor = FactExtractor(db, llm)
        await extractor.extract_session(pending.id)
        db.commit()

        current = db.query(StudentFact).filter(StudentFact.valid_to.is_(None)).all()
        # insert_with_supersede(supersede=False) still inserts → two current
        assert len(current) == 2

    @pytest.mark.asyncio
    async def test_ignore_does_not_insert(self, db):
        _, pending, _ = _seed_session(db)
        old = StudentFact(
            user_id="u1", project_name="mars-rover", knode_id="k10",
            category="knowledge", content="懂了坡度",
            confidence=0.8,
            valid_from=datetime.utcnow() - timedelta(days=1),
        )
        db.add(old)
        db.commit()

        extraction = json.dumps([{
            "category": "knowledge", "content": "明白坡度了",
            "confidence": 0.7, "knode_id": "k10",
        }])
        llm = FakeLLM([extraction, json.dumps({"action": "ignore"})])
        extractor = FactExtractor(db, llm)
        stats = await extractor.extract_session(pending.id)
        db.commit()

        assert db.query(StudentFact).count() == 1  # only the old one
        assert stats.facts_ignored == 1

    @pytest.mark.asyncio
    async def test_supersede_judge_non_json_defaults_coexist(self, db):
        _, pending, _ = _seed_session(db)
        old = StudentFact(
            user_id="u1", project_name="mars-rover", knode_id="k10",
            category="interest", content="喜欢飞机",
            valid_from=datetime.utcnow() - timedelta(days=2),
        )
        db.add(old)
        db.commit()

        extraction = json.dumps([{
            "category": "interest", "content": "也喜欢火箭",
            "confidence": 0.7, "knode_id": "k10",
        }])
        llm = FakeLLM([extraction, "哦那就让它们并存吧"])  # bogus response
        extractor = FactExtractor(db, llm)
        await extractor.extract_session(pending.id)
        db.commit()

        current = db.query(StudentFact).filter(StudentFact.valid_to.is_(None)).all()
        assert len(current) == 2  # defaulted to coexist


# ---------------------------------------------------------------------------
# Message cursor
# ---------------------------------------------------------------------------
class TestMessageCursor:
    @pytest.mark.asyncio
    async def test_respects_first_unextracted_msg_id(self, db):
        _, pending, msgs = _seed_session(db)
        pending.first_unextracted_msg_id = msgs[1].id  # skip m1, m2
        db.commit()

        llm = FakeLLM(["[]"])
        extractor = FactExtractor(db, llm)
        stats = await extractor.extract_session(pending.id)
        assert stats.messages_read == 1  # only m3

        # confirm LLM saw only msg#3
        convo_prompt = llm.calls[0][0].content
        assert f"msg#{msgs[2].id}" in convo_prompt
        assert f"msg#{msgs[0].id}" not in convo_prompt

    @pytest.mark.asyncio
    async def test_no_messages_returns_zero_stats(self, db):
        _, pending, msgs = _seed_session(db)
        pending.first_unextracted_msg_id = msgs[-1].id  # past everything
        db.commit()

        llm = FakeLLM([])  # should not be called
        extractor = FactExtractor(db, llm)
        stats = await extractor.extract_session(pending.id)
        assert stats.messages_read == 0
        assert stats.facts_extracted == 0
        assert llm.calls == []


# ---------------------------------------------------------------------------
# Low-confidence facts still persisted (filtered by L3 query later)
# ---------------------------------------------------------------------------
class TestLowConfidence:
    @pytest.mark.asyncio
    async def test_low_confidence_fact_stored(self, db):
        _, pending, _ = _seed_session(db)
        db.commit()

        extraction = json.dumps([{
            "category": "struggle", "content": "可能卡在比例换算",
            "confidence": 0.3, "knode_id": "k10",
            "metadata": {"struggle_type": "calc"},
        }])
        llm = FakeLLM([extraction])
        extractor = FactExtractor(db, llm)
        await extractor.extract_session(pending.id)
        db.commit()

        fact = db.query(StudentFact).one()
        assert fact.confidence == pytest.approx(0.3)
        assert fact.fact_metadata["struggle_type"] == "calc"


# ---------------------------------------------------------------------------
# Missing inputs
# ---------------------------------------------------------------------------
class TestMissingInputs:
    @pytest.mark.asyncio
    async def test_missing_pending_raises(self, db):
        llm = FakeLLM([])
        extractor = FactExtractor(db, llm)
        with pytest.raises(ValueError, match="not found"):
            await extractor.extract_session(pending_id=999)
