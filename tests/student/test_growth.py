"""spec 039: 动态知识树生长 — 队列 + evaluator (mock LLM)。"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest

from systemedu.student import db


@pytest.fixture(autouse=True)
def _sqlite(monkeypatch, tmp_path):
    monkeypatch.setenv("STUDENT_DB_URL", f"sqlite:///{tmp_path}/g.db")
    # 重置 engine/session 缓存
    import importlib
    importlib.reload(db)
    db.init_db()
    with db.get_session() as s:
        s.add(db.User(id="u1", username="g", password_hash="x"))
        s.commit()
    yield


def test_enqueue_and_list_growth():
    gid = db.enqueue_growth("u1", "complete_knode", "学了 cnn", subject_hint="cs")
    assert gid
    pend = db.list_pending_growth()
    assert len(pend) == 1 and pend[0]["id"] == gid


def test_mark_growth_lifecycle():
    gid = db.enqueue_growth("u1", "question", "x")
    db.mark_growth_processing(gid)
    db.mark_growth_done(gid)
    assert db.list_pending_growth() == []  # done 不在 pending


def _fake_platform():
    return {"subjects": [{"id": "cs", "name_zh": "计算机科学", "nodes": [
        {"id": "cs.ai.cnn", "name_zh": "卷积神经网络"},
    ]}]}


def _mk_evaluator(llm_json: str):
    from systemedu.student.chat.growth_evaluator import GrowthEvaluator
    llm = AsyncMock()
    llm.ainvoke.return_value = type("R", (), {"content": llm_json})()
    return GrowthEvaluator(llm=llm)


def test_evaluate_grows_nodes_with_gray_middle():
    """学第五层, 第四层缺 → 第四层补灰, 第五层点亮。"""
    gid = db.enqueue_growth("u1", "question", "深入卷积", subject_hint="cs")
    ev = _mk_evaluator(json.dumps([{
        "concept": "3x3 卷积核",
        "parent": "cs.ai.cnn",
        "path": ["cs.ai.cnn.kernel", "cs.ai.cnn.kernel.k3x3"],  # 第四层 + 第五层
        "lit": True,
        "reuse_id": None,
    }]))
    with patch("systemedu.student.chat.growth_evaluator.get_library_client") as gc:
        cli = gc.return_value
        cli.get_platform_knowledge_tree = AsyncMock(return_value=_fake_platform())
        stats = asyncio.run(ev.evaluate(gid))
    assert stats.grown == 2
    grown = {g["node_id"]: g for g in db.get_user_grown_nodes("u1")}
    assert grown["cs.ai.cnn.kernel"]["lit"] is False        # 中间层灰
    assert grown["cs.ai.cnn.kernel.k3x3"]["lit"] is True     # 目标亮
    assert grown["cs.ai.cnn.kernel"]["depth"] == 4
    assert grown["cs.ai.cnn.kernel.k3x3"]["depth"] == 5


def test_evaluate_dedup_no_rebuild():
    """二次生长同节点不重建。"""
    payload = json.dumps([{"concept": "卷积核", "parent": "cs.ai.cnn",
                           "path": ["cs.ai.cnn.kernel"], "lit": True, "reuse_id": None}])
    with patch("systemedu.student.chat.growth_evaluator.get_library_client") as gc:
        gc.return_value.get_platform_knowledge_tree = AsyncMock(return_value=_fake_platform())
        g1 = db.enqueue_growth("u1", "question", "a")
        asyncio.run(_mk_evaluator(payload).evaluate(g1))
        g2 = db.enqueue_growth("u1", "question", "b")
        asyncio.run(_mk_evaluator(payload).evaluate(g2))
    nodes = [g for g in db.get_user_grown_nodes("u1") if g["node_id"] == "cs.ai.cnn.kernel"]
    assert len(nodes) == 1  # 去重: 只一个


def test_evaluate_illegal_parent_skipped():
    """parent 不在平台树/已生长 → 丢弃 (防凭空挂)。"""
    gid = db.enqueue_growth("u1", "question", "x", subject_hint="cs")
    ev = _mk_evaluator(json.dumps([{"concept": "野点", "parent": "nonexist.x",
                                    "path": ["nonexist.x.y"], "lit": True, "reuse_id": None}]))
    with patch("systemedu.student.chat.growth_evaluator.get_library_client") as gc:
        gc.return_value.get_platform_knowledge_tree = AsyncMock(return_value=_fake_platform())
        stats = asyncio.run(ev.evaluate(gid))
    assert stats.grown == 0
    assert db.get_user_grown_nodes("u1") == []
