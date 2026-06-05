"""跨 session 记忆召回端到端验证 (L3 Q4=0 缺口补全)。

L3 质量评估发现: 对话当下 recalled_facts 恒空 — fact 抽取走异步 worker,
单次对话内不入库。本文件确定性验证完整链路:

    对话 (session A) → enqueue → worker 抽取 (extract_session) → upsert StudentFact
    → 新 session B (无对话历史) 经 StudentMemoryInjector 召回该 fact

抽取的 LLM 用 FakeLLM (确定性, 机制层); 抽取质量由 L3 真 LLM 评估。
证明: 记忆是 *跨 session* 持久召回的, 不是当轮对话上下文的回显。
"""

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


@pytest.fixture
def fake_cache():
    import fakeredis.aioredis
    from systemedu.student import cache as cache_mod
    fake = fakeredis.aioredis.FakeRedis(decode_responses=False)
    cache_mod.reset_client_for_tests()
    cache_mod.replace_client_for_tests(fake)
    yield fake
    cache_mod.reset_client_for_tests()


class FakeLLM:
    """抽取 LLM 桩: 返预设 JSON fact 数组。"""

    def __init__(self, content: str):
        self.content = content
        self.calls = 0

    async def ainvoke(self, messages):
        self.calls += 1
        return AIMessage(content=self.content)


def _seed_session_with_utterances(user_id: str, slug: str, module: str, utterances: list[str]):
    """建一个 session + 一串 user/assistant 消息, enqueue, 返 (session_id, pending_id)。"""
    from systemedu.student import db as _db
    with _db.get_session() as sess:
        s = _db.ChatSession(user_id=user_id, library_slug=slug, module_id=module, title="t")
        sess.add(s); sess.commit(); sess.refresh(s)
        sid = s.id
        for i, u in enumerate(utterances):
            sess.add(_db.ChatMessage(
                session_id=sid, user_id=user_id,
                library_slug=slug, module_id=module,
                role="user" if i % 2 == 0 else "assistant",
                content=u,
            ))
        sess.commit()
    p = _db.enqueue_extraction(sid, user_id)
    return sid, p["id"]


async def test_misconception_recalled_in_new_session(tmp_db, fake_cache):
    """对话表达误区 → worker 抽取入库 → 新 session 经 injector 召回。

    这是 L3 Q4=0 的端到端证明: 跨 session 记忆链路真生效。
    """
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    from systemedu.student.db import list_current_facts

    slug = "eeg-signals-test"

    # --- session A: 学生表达一个误区 ---
    _, pid = _seed_session_with_utterances(
        tmp_db, slug, "M02",
        ["我觉得采样率越高越好", "采样率开到最高就行了吧"],
    )

    # --- worker 抽取 (FakeLLM 确定性抽出 misconception) ---
    llm = FakeLLM(
        '[{"scope":"global","category":"misconception","key":"sampling_higher_better",'
        '"value":"以为采样率越高越好","confidence":0.9}]'
    )
    ext = StudentFactExtractor(llm=llm)
    stats = await ext.extract_session(pid)
    assert stats.facts_written == 1

    # 入库确认 (不依赖当轮对话上下文, 是持久 StudentFact)
    facts = list_current_facts(tmp_db)
    assert any(f["key"] == "sampling_higher_better" for f in facts)

    # --- session B: 全新会话 (无任何对话历史), injector 召回 ---
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    # l1_profile 含该 misconception → 跨 session 召回成功
    assert "misconception:" in snap["l1_profile"]
    assert "采样率越高越好" in snap["l1_profile"]


async def test_recall_isolated_per_user(tmp_db, fake_cache):
    """召回按 user 隔离: 别人的 fact 不会串到本用户。"""
    from systemedu.student.chat.fact_extractor import StudentFactExtractor
    from systemedu.student.chat.memory_layers import StudentMemoryInjector
    from systemedu.student import db as _db

    other = _db.create_user(f"o_{uuid.uuid4().hex[:6]}", "h")
    _, pid = _seed_session_with_utterances(
        other.id, "eeg-signals-test", "M01", ["我叫小明", "我喜欢打游戏"],
    )
    llm = FakeLLM(
        '[{"scope":"global","category":"interest","key":"games","value":"喜欢打游戏","confidence":0.9}]'
    )
    await StudentFactExtractor(llm=llm).extract_session(pid)

    # 本用户 (tmp_db) 新 session 召回, 不应看到 other 的 fact
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    assert "打游戏" not in snap["l1_profile"]


async def test_no_facts_before_extraction(tmp_db, fake_cache):
    """对话已发生但 worker 未抽取前, 新 session 召回为空 (复现 L3 Q4=0 的时序)。

    这正是 L3 报告里 recalled_facts 恒空的根因: 抽取是异步的。
    """
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    # 只 seed 对话 + enqueue, 不调 extract_session (模拟 worker 还没跑)
    _seed_session_with_utterances(
        tmp_db, "eeg-signals-test", "M02", ["我觉得采样率越高越好"],
    )
    inj = StudentMemoryInjector()
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    # 抽取前召回为空 — 证明 fact 不是从对话上下文实时产生的
    assert snap["l1_profile"] == ""
