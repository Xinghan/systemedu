"""spec 031 P4: StudentFactExtractor + worker tick tests."""

from __future__ import annotations

import uuid

import pytest

from langchain_core.messages import AIMessage


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    u = _db.create_user(f"u_{uuid.uuid4().hex[:6]}", "h")
    yield u.id
    _db.reset_engine_for_tests()


class FakeLLM:
    """返预设 JSON; 记录 call."""

    def __init__(self, content: str):
        self.content = content
        self.calls = 0

    async def ainvoke(self, messages):
        self.calls += 1
        return AIMessage(content=self.content)


class FakeMem0:
    def __init__(self, fail=False):
        self.fail = fail
        self.calls = []

    async def add(self, messages, *, user_id, metadata=None):
        self.calls.append({"user_id": user_id, "metadata": metadata, "n": len(messages)})
        if self.fail:
            raise RuntimeError("mem0 down")


def _make_session_with_messages(user_id: str, slug="s", module="M01", n=3):
    """Build a chat session with n user+assistant messages, return (session_id, pending_id)."""
    from systemedu.student import db as _db
    with _db.get_session() as sess:
        s = _db.ChatSession(user_id=user_id, library_slug=slug, module_id=module, title="t")
        sess.add(s); sess.commit(); sess.refresh(s)
        sid = s.id
        for i in range(n):
            sess.add(_db.ChatMessage(
                session_id=sid, user_id=user_id,
                library_slug=slug, module_id=module,
                role="user" if i % 2 == 0 else "assistant",
                content=f"消息 {i}",
            ))
        sess.commit()
    p = _db.enqueue_extraction(sid, user_id)
    return sid, p["id"]


# ============================== Extractor 主路径 ==============================

async def test_extract_inserts_facts(tmp_db):
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student.db import list_current_facts
    _, pid = _make_session_with_messages(tmp_db)
    llm = FakeLLM(
        '[{"scope":"global","category":"interest","key":"outdoor","value":"喜欢户外","confidence":0.9},'
        '{"scope":"project","category":"goal","key":"finish_purpleair","value":"完成空气质量项目","library_slug":"s"}]'
    )
    ext = StudentFactExtractor(llm=llm)
    stats = await ext.extract_session(pid)
    assert stats.messages_read == 3
    assert stats.facts_extracted == 2
    assert stats.facts_written == 2
    facts = list_current_facts(tmp_db)
    assert {f["key"] for f in facts} == {"outdoor", "finish_purpleair"}


async def test_extract_invalid_json_returns_empty(tmp_db):
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    _, pid = _make_session_with_messages(tmp_db)
    llm = FakeLLM("this is not json")
    ext = StudentFactExtractor(llm=llm)
    stats = await ext.extract_session(pid)
    assert stats.facts_extracted == 0
    assert stats.facts_written == 0


async def test_extract_strips_code_fence(tmp_db):
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    _, pid = _make_session_with_messages(tmp_db)
    llm = FakeLLM('```json\n[{"scope":"global","category":"interest","key":"k","value":"v"}]\n```')
    ext = StudentFactExtractor(llm=llm)
    stats = await ext.extract_session(pid)
    assert stats.facts_written == 1


async def test_extract_empty_array(tmp_db):
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    _, pid = _make_session_with_messages(tmp_db)
    llm = FakeLLM("[]")
    ext = StudentFactExtractor(llm=llm)
    stats = await ext.extract_session(pid)
    assert stats.facts_extracted == 0
    assert stats.facts_written == 0


async def test_extract_no_messages_skips_llm(tmp_db):
    from systemedu.student import db as _db
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    # 空 session
    with _db.get_session() as sess:
        s = _db.ChatSession(user_id=tmp_db, library_slug="s", title="t")
        sess.add(s); sess.commit(); sess.refresh(s)
        sid = s.id
    p = _db.enqueue_extraction(sid, tmp_db)
    llm = FakeLLM("[]")
    ext = StudentFactExtractor(llm=llm)
    stats = await ext.extract_session(p["id"])
    assert stats.messages_read == 0
    assert llm.calls == 0


async def test_extract_skips_invalid_scope(tmp_db):
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    _, pid = _make_session_with_messages(tmp_db)
    llm = FakeLLM(
        '[{"scope":"BOGUS","category":"interest","key":"k","value":"v"},'
        '{"scope":"global","category":"interest","key":"ok","value":"v"}]'
    )
    ext = StudentFactExtractor(llm=llm)
    stats = await ext.extract_session(pid)
    assert stats.facts_extracted == 2
    assert stats.facts_written == 1


async def test_extract_calls_mem0_with_metadata(tmp_db):
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    sid, pid = _make_session_with_messages(tmp_db, slug="sx", module="M02")
    llm = FakeLLM("[]")
    mem0 = FakeMem0()
    ext = StudentFactExtractor(llm=llm, mem0_client=mem0)
    stats = await ext.extract_session(pid)
    assert stats.mem0_added is True
    assert len(mem0.calls) == 1
    assert mem0.calls[0]["user_id"] == tmp_db
    assert mem0.calls[0]["metadata"]["library_slug"] == "sx"
    assert mem0.calls[0]["metadata"]["module_id"] == "M02"


async def test_extract_mem0_fail_doesnt_break(tmp_db):
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    _, pid = _make_session_with_messages(tmp_db)
    mem0 = FakeMem0(fail=True)
    ext = StudentFactExtractor(
        llm=FakeLLM('[{"scope":"global","category":"interest","key":"k","value":"v"}]'),
        mem0_client=mem0,
    )
    stats = await ext.extract_session(pid)
    assert stats.facts_written == 1
    assert stats.mem0_added is False


# ============================== Worker tick ==============================

async def test_worker_tick_marks_done(tmp_db):
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student.workers.fact_extractor_worker import tick
    from systemedu.student import db as _db
    _, pid = _make_session_with_messages(tmp_db)
    ext = StudentFactExtractor(
        llm=FakeLLM('[{"scope":"global","category":"interest","key":"k","value":"v"}]')
    )
    n = await tick(ext, batch=5)
    assert n == 1
    with _db.get_session() as sess:
        row = sess.get(_db.PendingExtraction, pid)
        assert row.status == "done"
        assert row.attempts == 1


async def test_worker_tick_marks_failed_then_dead(tmp_db):
    """LLM 始终抛 → failed → failed → dead."""
    from systemedu.student.workers.fact_extractor_worker import tick
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student import db as _db

    class BrokenLLM:
        async def ainvoke(self, messages):
            raise RuntimeError("oops")

    _, pid = _make_session_with_messages(tmp_db)
    ext = StudentFactExtractor(llm=BrokenLLM())

    for _ in range(3):
        # 每次 tick 前把 status 还回 pending (worker 现实中靠 systemd 重启或下一 tick 自然重试,
        # 这里手动 reset 模拟 5min 后再 tick)
        with _db.get_session() as sess:
            row = sess.get(_db.PendingExtraction, pid)
            if row.status == "failed":
                row.status = "pending"
                sess.commit()
        await tick(ext, batch=1)

    with _db.get_session() as sess:
        row = sess.get(_db.PendingExtraction, pid)
        assert row.status == "dead"
        assert row.attempts == 3
        assert "oops" in (row.error or "")


async def test_worker_tick_empty_queue(tmp_db):
    from systemedu.student.workers.fact_extractor_worker import tick
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    ext = StudentFactExtractor(llm=FakeLLM("[]"))
    n = await tick(ext)
    assert n == 0


async def test_worker_tick_processes_multiple(tmp_db):
    from systemedu.student.workers.fact_extractor_worker import tick
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student import db as _db
    _make_session_with_messages(tmp_db, slug="a", module="M01")
    _make_session_with_messages(tmp_db, slug="b", module="M01")
    _make_session_with_messages(tmp_db, slug="c", module="M01")
    ext = StudentFactExtractor(llm=FakeLLM("[]"))
    n = await tick(ext, batch=10)
    assert n == 3
    assert len(_db.list_pending_extractions()) == 0
