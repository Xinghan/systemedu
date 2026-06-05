"""L3 质量层 — 跑真实 tutor(qwen) 对话, 落盘结构化 artifact (Task 8)。

pytest 本身不评质量, 只:
- 驱动真实 tutor 多轮对话 (POST /api/chat, learn 页, 带误区发言);
- 收集 turns + 注入 context (knode lesson 文本) + 召回 facts;
- dump_artifact 落盘成 tests/student/_artifacts/quality/<scenario>.json;
- 断言 artifact 结构完整 (turns 非空 / tutor 每轮有回复 / context 是 str /
  recalled_facts 是 list)。

质量评分由 Claude Code 在测试会话里当 judge 按 rubric.md 离线打分。

--quality gate (tests/conftest.py 注册) 默认 skip; 传 --quality 才跑, 此时
需要真实 LLM key (DASHSCOPE_API_KEY), 因 chat 首请求会 lazy build graph 调真实 LLM。
"""
from __future__ import annotations

import uuid

import pytest

from tests.student._fixtures.eeg_project import SLUG


# ====================================================================
# 共用 helper
# ====================================================================

def _register_and_login(client, username: str, password: str = "pw123456") -> str:
    """注册并登录, 返回 Bearer token。"""
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    r.raise_for_status()
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _uname(tag: str) -> str:
    return f"q{tag}{uuid.uuid4().hex[:6]}"


def _run_dialogue(eeg_client, token, knode_id, utterances):
    """驱动一段真实 tutor 对话。

    返回 (turns, injected_context, recalled_facts):
    - turns: [{"role":"user","content":..}, {"role":"assistant","content":..}, ...]
      按轮次交替。
    - injected_context: 该 module 的 lesson 文本 (GET knode 响应), 代表 tutor
      本应基于的 context, 供 judge 判断 Q5 context 落地。HTTP 不直接暴露"注入了
      什么", 故用 knode lesson 文本作务实替身。
    - recalled_facts: GET /api/memory/facts 的结果 (对话后召回/抽取的 facts)。
    """
    h = _auth(token)

    # injected_context: 取该 knode 的 lesson 文本 (学生当前所见 knode 内容)。
    injected_context = ""
    try:
        rk = eeg_client.get(f"/api/my/projects/{SLUG}/knodes/{knode_id}", headers=h)
        if rk.status_code == 200:
            injected_context = rk.text
    except Exception:
        injected_context = ""

    turns: list[dict] = []
    session_id = None
    for utt in utterances:
        body = {
            "message": utt,
            "library_slug": SLUG,
            "module_id": knode_id,
            "page_kind": "learn",
        }
        if session_id:
            body["session_id"] = session_id
        # 真实 LLM 多轮对话慢, 且首轮要 lazy build graph; 给足超时 (默认 20s 不够)。
        r = eeg_client.post("/api/chat", json=body, headers=h, timeout=120.0)
        r.raise_for_status()
        data = r.json()
        session_id = data.get("session_id") or session_id
        turns.append({"role": "user", "content": utt})
        # 存 active_skill 供 judge 归因路由 (苏格拉底 vs 讲授); 缺则 None。
        turns.append({
            "role": "assistant",
            "content": data.get("response") or "",
            "active_skill": data.get("active_skill"),
        })

    # recalled facts: 对话后查当前 user 的 facts (抽取/召回结果)。
    recalled_facts: list = []
    try:
        rf = eeg_client.get("/api/memory/facts", headers=h)
        if rf.status_code == 200:
            by_cat = rf.json().get("by_category") or {}
            for facts in by_cat.values():
                recalled_facts.extend(facts)
    except Exception:
        recalled_facts = []

    return turns, injected_context, recalled_facts


# ====================================================================
# 质量场景
# ====================================================================

SCENARIOS = [
    ("socratic_sampling", "M02", ["采样率是不是越高越好啊？", "那我直接开到最高不就行了"]),
    ("socratic_alpha", "M03", ["我闭上眼 alpha 变强，是不是说明我睡着了？"]),
    ("memory_recall", "M01", ["我之前说过我喜欢打游戏", "脑电能不能直接读出我在想哪个游戏？"]),
]


@pytest.mark.quality
@pytest.mark.parametrize("scenario,knode_id,utterances", SCENARIOS, ids=[s[0] for s in SCENARIOS])
def test_quality_transcript(eeg_client, dump_artifact, scenario, knode_id, utterances):
    """跑真实 tutor 对话并落 artifact; 断言结构完整 (不评质量)。"""
    token = _register_and_login(eeg_client, _uname(scenario[:3]))
    h = _auth(token)

    # pull EEG 项目 (learn 页对话 + GET knode context 都需先 pull)。
    eeg_client.post(f"/api/my/projects/{SLUG}", headers=h)

    turns, injected_context, recalled_facts = _run_dialogue(
        eeg_client, token, knode_id, utterances
    )
    out = dump_artifact(scenario, turns, injected_context, recalled_facts)

    # 结构断言: artifact 完整可供 judge 打分。
    assert out.exists(), f"artifact 未落盘: {out}"
    assert turns, "turns 不能为空"
    assert len(turns) == 2 * len(utterances), "turns 应按 user/assistant 交替每轮 2 条"

    user_turns = [t for t in turns if t["role"] == "user"]
    asst_turns = [t for t in turns if t["role"] == "assistant"]
    assert len(user_turns) == len(utterances)
    assert len(asst_turns) == len(utterances)
    for t in asst_turns:
        assert t["content"].strip(), "tutor 每轮必须有非空回复"

    assert isinstance(injected_context, str), "injected_context 必须是 str"
    assert isinstance(recalled_facts, list), "recalled_facts 必须是 list"
