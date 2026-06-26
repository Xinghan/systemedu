"""T9 (C-chat-memory): fact worker 端到端链路。

闭环验证 (全进程内, 不起子进程, 不真 LLM/Redis/网络):
  inactive session  --enqueue_inactive_sessions-->  PendingExtraction(pending)
       --worker.tick(FakeLLM extractor)-->  mark_done + StudentFact 落库
       --下一个 StudentMemoryInjector.inject(home/learn)-->  L1 profile 含刚抽出的 fact

外加失败旁路: FakeLLM 抛异常 → mark_failed; 连续 3 次 → status=dead 不再重试。

fixture:
- tmp_db: 进程内 SQLite (照搬 test_fact_extractor.py / test_e2e_learning_flow.py 范式)
- fake_cache: fakeredis (memory_layers L4 / cache 兜底, 不连真 Redis)
- FakeLLM: 返预设 JSON 的假 extractor LLM (照搬 test_fact_extractor.py, 绝不真 LLM)

依赖既有范式:
- tests/student/test_fact_extractor.py (FakeLLM + tmp_db + worker tick/enqueue_inactive)
- tests/student/test_e2e_learning_flow.py (StudentMemoryInjector + upsert_fact 召回断言)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest

from langchain_core.messages import AIMessage


# ============================== fixtures ==============================

@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    """进程内 SQLite + 一个测试用户, 返回 user_id。"""
    db_path = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_PATH", str(db_path))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    u = _db.create_user(f"u_{uuid.uuid4().hex[:6]}", "h")
    yield u.id
    _db.reset_engine_for_tests()


@pytest.fixture
def fake_cache():
    """fakeredis, 替换 student cache client (L4 / cache 层走它而非真 Redis)。"""
    import fakeredis.aioredis
    from systemedu.student import cache as cache_mod
    fake = fakeredis.aioredis.FakeRedis(decode_responses=False)
    cache_mod.reset_client_for_tests()
    cache_mod.replace_client_for_tests(fake)
    yield fake
    cache_mod.reset_client_for_tests()


class FakeLLM:
    """返预设 JSON 内容的假 extractor LLM; 记录调用次数。绝不真 LLM。"""

    def __init__(self, content: str):
        self.content = content
        self.calls = 0

    async def ainvoke(self, messages):
        self.calls += 1
        return AIMessage(content=self.content)


class BrokenLLM:
    """ainvoke 始终抛异常, 用于失败旁路。"""

    def __init__(self):
        self.calls = 0

    async def ainvoke(self, messages):
        self.calls += 1
        raise RuntimeError("llm exploded")


# ============================== helpers ==============================

def _make_inactive_session(
    user_id: str,
    slug: str = "p027-test",
    module: str = "M01",
    inactive_minutes: int = 45,
    n_messages: int = 4,
):
    """造一个 updated_at 已过期 (inactive) 且含 user+assistant message 的 session。

    不入队 (留给 enqueue_inactive_sessions 自动扫到)。返回 session_id。
    """
    from systemedu.student import db as _db
    old = datetime.utcnow() - timedelta(minutes=inactive_minutes)
    with _db.get_session() as sess:
        s = _db.ChatSession(
            user_id=user_id,
            library_slug=slug,
            module_id=module,
            title="inactive sess",
            updated_at=old,
        )
        sess.add(s)
        sess.commit()
        sess.refresh(s)
        sid = s.id
        for i in range(n_messages):
            sess.add(_db.ChatMessage(
                session_id=sid,
                user_id=user_id,
                library_slug=slug,
                module_id=module,
                role="user" if i % 2 == 0 else "assistant",
                content=f"对话消息 {i}",
            ))
        sess.commit()
    return sid


# 一条 global interest fact, 用于闭环召回断言: inject 后 L1 应能看到它。
_FACT_JSON = (
    '[{"scope":"global","category":"interest","key":"loves_space",'
    '"value":"对太空和火箭很感兴趣","confidence":0.92}]'
)


# ======================================================================
# Scenario 1: inactive session → enqueue_inactive_sessions 入队 PendingExtraction
# ======================================================================

def test_inactive_session_gets_enqueued(tmp_db):
    """造一个 inactive session → enqueue_inactive_sessions 入队 1 条 pending。"""
    from systemedu.student import db as _db

    sid = _make_inactive_session(tmp_db)

    # 入队前: 队列空
    assert _db.list_pending_extractions() == []

    n = _db.enqueue_inactive_sessions(inactive_minutes=30)
    assert n == 1

    pending = _db.list_pending_extractions()
    assert len(pending) == 1
    p = pending[0]
    assert p["session_id"] == sid
    assert p["user_id"] == tmp_db
    assert p["status"] == "pending"
    assert p["attempts"] == 0


# ======================================================================
# Scenario 2: worker.tick(FakeLLM) → 处理 pending → mark_done + StudentFact 落库
# ======================================================================

async def test_tick_marks_done_and_writes_fact(tmp_db):
    """enqueue → tick(FakeLLM) → pending=done + StudentFact 落库 (facts_written>0)。"""
    from systemedu.student import db as _db
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student.workers.fact_extractor_worker import tick

    _make_inactive_session(tmp_db)
    assert _db.enqueue_inactive_sessions(inactive_minutes=30) == 1
    pid = _db.list_pending_extractions()[0]["id"]

    ext = StudentFactExtractor(llm=FakeLLM(_FACT_JSON))
    n = await tick(ext, batch=5)
    assert n == 1

    # pending 行 done + attempts=1
    with _db.get_session() as sess:
        row = sess.get(_db.PendingExtraction, pid)
        assert row.status == "done"
        assert row.attempts == 1
        assert row.processed_at is not None

    # StudentFact 真落库 (facts_written>0)
    facts = _db.list_current_facts(tmp_db, scope="global")
    assert len(facts) == 1
    f = facts[0]
    assert f["key"] == "loves_space"
    assert f["value"] == "对太空和火箭很感兴趣"
    assert f["category"] == "interest"
    assert f["scope"] == "global"
    # source_session 记录了来源 session (链路可追溯)
    assert f["source_session"] is not None

    # 队列已清空 (无残留 pending)
    assert _db.list_pending_extractions() == []


# ======================================================================
# Scenario 3: 下一次 inject(home/learn) → L1 profile 含刚抽出的 fact (闭环召回)
# ======================================================================

async def test_injector_recalls_extracted_fact_home(tmp_db, fake_cache):
    """全链路闭环 (home 页): enqueue → tick → inject(home) 的 L1 含刚抽出的 fact。"""
    from systemedu.student import db as _db
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    from systemedu.student.workers.fact_extractor_worker import tick

    # 阶段 1: inactive → enqueue
    _make_inactive_session(tmp_db)
    assert _db.enqueue_inactive_sessions(inactive_minutes=30) == 1

    # 阶段 2: worker tick 抽取并落库
    ext = StudentFactExtractor(llm=FakeLLM(_FACT_JSON))
    assert await tick(ext, batch=5) == 1

    # 阶段 3: 下一个 session 召回 — home 页 inject 的 L1 含刚抽出的 fact
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    assert "对太空和火箭很感兴趣" in snap["l1_profile"]
    assert "loves_space" in snap["l1_profile"]
    assert "interest" in snap["l1_profile"]


async def test_injector_recalls_extracted_fact_learn(tmp_db, fake_cache):
    """全链路闭环 (learn 页): learn 页同样激活 L1, 含刚抽出的 global fact。

    learn 页还会激活 L3 (knode content)。library_client=None 时 L3 走兜底为空,
    不报错; 这里只断言 L1 召回闭环, 与 page_kind=home 同源 (PAGES_WITH_L1)。
    """
    from systemedu.student import db as _db
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    from systemedu.student.workers.fact_extractor_worker import tick

    sid = _make_inactive_session(tmp_db, slug="p027-test", module="M01")
    assert _db.enqueue_inactive_sessions(inactive_minutes=30) == 1
    ext = StudentFactExtractor(llm=FakeLLM(_FACT_JSON))
    assert await tick(ext, batch=5) == 1

    inj = StudentMemoryInjector()  # library_client=None → L3 兜底为空, 不影响 L1
    snap = await inj.inject(
        user_id=tmp_db,
        page_kind="learn",
        library_slug="p027-test",
        module_id="M01",
        last_user_msg="我们刚聊到哪了",
    )
    # L1 闭环召回
    assert "对太空和火箭很感兴趣" in snap["l1_profile"]
    # learn 页 L3 在无 library_client 时兜底为空 (不抛, 链路不被打断)
    assert snap["l3_knode_content"] == ""

    # 链路可追溯: 抽出的 fact 的 source_session 指回入队的那个 session
    facts = _db.list_current_facts(tmp_db, scope="global")
    assert facts[0]["source_session"] == sid


# ======================================================================
# Scenario 4: FakeLLM 抛异常 → mark_failed; 连续 3 次 → status=dead 不再重试
# ======================================================================

async def test_failure_bypass_failed_then_dead(tmp_db):
    """失败旁路: extractor 始终抛 → failed → failed → 第 3 次 dead, 不再重试。

    验证端到端链路上的 dead-letter 旁路 (与既有 mark_extraction_failed 行为一致):
    worker tick 每轮先 mark_processing (attempts+1) 再跑 extractor, 抛异常则
    mark_failed; attempts>=3 时落 dead。现实中 worker 靠下一 tick 自然重试 failed
    (idx_pe_status_enqueued 含 'failed'), 但 list_pending_extractions 只取 'pending',
    故这里手动把 failed reset 回 pending 模拟 5min 后再 tick (照搬 test_fact_extractor
    的 test_worker_tick_marks_failed_then_dead 范式)。
    """
    from systemedu.student import db as _db
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student.workers.fact_extractor_worker import tick

    _make_inactive_session(tmp_db)
    assert _db.enqueue_inactive_sessions(inactive_minutes=30) == 1
    pid = _db.list_pending_extractions()[0]["id"]

    broken = BrokenLLM()
    ext = StudentFactExtractor(llm=broken)

    statuses = []
    for _ in range(3):
        # 把上一轮 failed reset 回 pending (模拟下一 tick 自然重试)
        with _db.get_session() as sess:
            row = sess.get(_db.PendingExtraction, pid)
            if row.status == "failed":
                row.status = "pending"
                sess.commit()
        await tick(ext, batch=1)
        with _db.get_session() as sess:
            statuses.append(sess.get(_db.PendingExtraction, pid).status)

    # 前两轮 failed, 第三轮 dead
    assert statuses == ["failed", "failed", "dead"]

    with _db.get_session() as sess:
        row = sess.get(_db.PendingExtraction, pid)
        assert row.status == "dead"
        assert row.attempts == 3
        assert "llm exploded" in (row.error or "")

    # extractor 被调了 3 次 (每轮 1 次)
    assert broken.calls == 3

    # dead 行不再被 list_pending_extractions 取到 → 不会再 tick 重试
    assert _db.list_pending_extractions() == []
    assert await tick(ext, batch=5) == 0
    assert broken.calls == 3  # 没有新增调用

    # 失败链路下无 fact 落库
    assert _db.list_current_facts(tmp_db, scope="global") == []
