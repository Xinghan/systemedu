"""L2 机制 E2E: 学习链路确定性验证 (Task 7)。

两类测试:
- A 类: 走真实双进程 HTTP (eeg_client + eeg_services fixture), 不依赖 LLM。
  覆盖 pull 生命周期 / 学习内容代理 / 进度增长 + DAG。
- B 类: 进程内确定性 (不起子进程, 不依赖 LLM/网络)。
  覆盖 context 注入 / 记忆召回 / safety gate。

所有断言验证机制语义; 真实 LLM 行为留给 L3 (Task 8)。
"""

from __future__ import annotations

import uuid

import pytest

from tests.student._fixtures.eeg_project import KNODES, SLUG


# ====================================================================
# 共用 helper (A 类)
# ====================================================================

import hashlib


def _phone_for(name: str) -> str:
    digits = int(hashlib.sha1(name.encode()).hexdigest(), 16) % 10**8
    return f"138{digits:08d}"


def _register_and_login(make_token, name: str) -> str:
    """免 SMS 登录: 直接建手机号用户并签 token (绝不真发短信)。返回 Bearer token。"""
    return make_token(_phone_for(name))


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _uname(tag: str) -> str:
    # 不同测试用不同 name 派生不同手机号, 避免撞号
    return f"e2e{tag}{uuid.uuid4().hex[:6]}"


# ====================================================================
# E2E-1 pull 生命周期 (A 类, HTTP)
# ====================================================================

def test_e2e1_pull_lifecycle(eeg_client, make_token_eeg):
    token = _register_and_login(make_token_eeg, _uname("a"))
    h = _auth(token)

    # 首次 pull -> 201 + knode_count=7 + stage_count=3
    r = eeg_client.post(f"/api/my/projects/{SLUG}", headers=h)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["created"] is True
    assert body["knode_count"] == 7
    assert body["stage_count"] == 3

    # list 含 slug
    r = eeg_client.get("/api/my/projects", headers=h)
    assert r.status_code == 200
    slugs = [p["slug"] for p in r.json()]
    assert SLUG in slugs

    # remove -> removed True
    r = eeg_client.delete(f"/api/my/projects/{SLUG}", headers=h)
    assert r.status_code == 200
    assert r.json()["removed"] is True

    # 重新 pull -> 200 (再次, created False)
    r = eeg_client.post(f"/api/my/projects/{SLUG}", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["created"] is False


# ====================================================================
# E2E-2 学习内容代理 (A 类, HTTP)
# ====================================================================

def test_e2e2_learn_content_proxy(eeg_client, make_token_eeg):
    token = _register_and_login(make_token_eeg, _uname("b"))
    h = _auth(token)

    # 未 pull 的新用户 GET knode -> 403 not_pulled
    r = eeg_client.get(f"/api/my/projects/{SLUG}/knodes/M02", headers=h)
    assert r.status_code == 403, r.text
    assert r.json()["error"] == "not_pulled"

    # pull 后 GET knode M02 -> 200 且响应含「奈奎斯特」(代理真实 library lesson)
    eeg_client.post(f"/api/my/projects/{SLUG}", headers=h)
    r = eeg_client.get(f"/api/my/projects/{SLUG}/knodes/M02", headers=h)
    assert r.status_code == 200, r.text
    assert "奈奎斯特" in r.text


# ====================================================================
# E2E-5 DAG / 进度增长 (A 类, HTTP + 数据断言)
# ====================================================================

def test_e2e5_dag_and_progress(eeg_client, make_token_eeg):
    token = _register_and_login(make_token_eeg, _uname("e"))
    h = _auth(token)
    eeg_client.post(f"/api/my/projects/{SLUG}", headers=h)

    # 初始进度 None
    r = eeg_client.get(f"/api/my/progress/{SLUG}", headers=h)
    assert r.status_code == 200
    assert r.json()["last_module_id"] is None

    # PUT M01 -> GET 得 M01 (进度增长)
    r = eeg_client.put(f"/api/my/progress/{SLUG}/M01", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["last_module_id"] == "M01"
    r = eeg_client.get(f"/api/my/progress/{SLUG}", headers=h)
    assert r.json()["last_module_id"] == "M01"

    # 未 pull 用户 PUT 进度 -> 403 pull_required
    token2 = _register_and_login(make_token_eeg, _uname("e2"))
    r = eeg_client.put(f"/api/my/progress/{SLUG}/M01", headers=_auth(token2))
    assert r.status_code == 403
    assert r.json()["error"] == "pull_required"

    # DAG 结构验证: EEG 树 M03 的前置含 M02 (DAG 边存在)。
    # 直接断言注入树的 KNODES 数据结构 (build_eeg_tarball 的正源)。
    m03 = next(k for k in KNODES if k[0] == "M03")
    m03_prereqs = m03[7]
    assert "M02" in m03_prereqs, f"M03 prereq 应含 M02, 实际 {m03_prereqs}"
    # 顺带验证 M02 自身依赖 M01 (DAG 链条 M01->M02->M03)
    m02 = next(k for k in KNODES if k[0] == "M02")
    assert "M01" in m02[7]


# ====================================================================
# B 类 进程内 fixtures (复制自 test_memory_layers.py, 仅本文件用)
# ====================================================================

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


class _EegKnode:
    """带 EEG 专业内容的 fake knode: plan_markdown 含「奈奎斯特」。

    _build_knode_summary 取 title + plan_markdown[:300], 故专业词放 plan_markdown。
    """

    def __init__(self):
        self.title = "M02 采样率与奈奎斯特"
        self.plan_markdown = (
            "本节讲奈奎斯特定理: 采样率 fs 必须 >= 2 倍信号最高频率 fmax "
            "才能不失真。EEG 关心 1-40Hz, 常用 250 或 500Hz。"
        )
        self.theories = [{"theory_id": "t1"}]
        self.rendered_sections = {
            "ideas": [{"idea_id": "ex1", "mode": "exercise"}],
            "rendered_sections": {
                "ex1": {"mode": "exercise", "exercises": [{"q": "Q1"}]},
            },
        }


class _EegLibrary:
    def __init__(self):
        self.knode = _EegKnode()
        self.calls = 0

    async def get_knode(self, slug, knode_id):
        self.calls += 1
        return self.knode


# ====================================================================
# E2E-3 context 注入 (B 类, 进程内)
# ====================================================================

async def test_e2e3_context_injection_per_page(tmp_db, fake_cache):
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    inj = StudentMemoryInjector(library_client=_EegLibrary())

    # learn 页 (有 module_id) -> l3_knode_content 非空且含 EEG 专业词
    snap = await inj.inject(
        user_id=tmp_db, page_kind="learn",
        library_slug=SLUG, module_id="M02",
    )
    assert snap["l3_knode_content"] != ""
    assert "奈奎斯特" in snap["l3_knode_content"]

    # global 页 (无 module_id) -> l3_knode_content == "" (context 随页面正确切换)
    snap2 = await inj.inject(
        user_id=tmp_db, page_kind="global", module_id=None, last_user_msg="hi",
    )
    assert snap2["l3_knode_content"] == ""


# ====================================================================
# E2E-4 记忆召回 (B 类, 进程内)
# ====================================================================

async def test_e2e4_memory_recall(tmp_db, fake_cache):
    from systemedu.student.db import upsert_fact
    from systemedu.student.chat.memory_layers import StudentMemoryInjector

    # seed 一条 misconception 全局 fact
    upsert_fact(
        tmp_db, "global", "misconception",
        "sampling_rate", "以为采样率越高越好",
    )

    inj = StudentMemoryInjector()
    # home 页注入 l1 (跨项目稳定事实)
    snap = await inj.inject(user_id=tmp_db, page_kind="home")
    assert "以为采样率越高越好" in snap["l1_profile"]
    assert "misconception" in snap["l1_profile"]


# ====================================================================
# E2E-6 safety gate (B 类, 进程内)
# ====================================================================

async def test_e2e6_safety_gate(tmp_db, fake_cache):
    from langchain_core.messages import AIMessage, HumanMessage
    from systemedu.core.tutor.nodes.safety_gate import (
        SAFETY_RESPONSE,
        safety_gate_node,
    )

    # 危险输入触发 _safety_triggered + SAFETY_RESPONSE
    state = {"messages": [HumanMessage(content="我真的不想活了")]}
    result = await safety_gate_node(state)
    assert result["_safety_triggered"] is True
    ai_msgs = [m for m in result["messages"] if isinstance(m, AIMessage)]
    assert len(ai_msgs) == 1
    assert ai_msgs[0].content == SAFETY_RESPONSE

    # 正常输入放行 (空 dict), 证明 gate 不误伤、危险时短路不进 LLM 节点
    passthrough = await safety_gate_node(
        {"messages": [HumanMessage(content="奈奎斯特定理怎么算")]}
    )
    assert passthrough == {}
