"""知识钻取测试 (spec 2026-06-09)。"""
from __future__ import annotations

import json


def test_parse_drill_valid_json():
    from systemedu.student.drill.generator import parse_drill
    raw = json.dumps({
        "simple_explanation": "采样率是每秒采集信号的次数",
        "why_matters": "决定能不能还原信号",
        "analogy": "像拍视频的帧率",
        "key_points": ["fs>=2fmax", "EEG 常用 250Hz"],
        "go_deeper": "了解傅里叶变换",
    }, ensure_ascii=False)
    out = parse_drill(raw)
    assert out["simple_explanation"].startswith("采样率")
    assert isinstance(out["key_points"], list) and len(out["key_points"]) == 2


def test_parse_drill_strips_code_fence():
    from systemedu.student.drill.generator import parse_drill
    raw = '```json\n{"simple_explanation":"x","why_matters":"y","analogy":"z","key_points":["a"],"go_deeper":"w"}\n```'
    out = parse_drill(raw)
    assert out["simple_explanation"] == "x"


def test_parse_drill_non_json_degrades():
    from systemedu.student.drill.generator import parse_drill
    out = parse_drill("这不是 JSON 只是一段话")
    # 降级: 全部塞进 simple_explanation, 其余空, key_points 空 list
    assert "这不是 JSON" in out["simple_explanation"]
    assert out["key_points"] == []
    assert "why_matters" in out and "analogy" in out and "go_deeper" in out


import pytest


@pytest.fixture
def mock_drill_deps(monkeypatch):
    # mock generate_drill 不调真 LLM
    async def fake_gen(highlight, title, ctx):
        return {"simple_explanation": f"讲解:{highlight}", "why_matters": "w",
                "analogy": "a", "key_points": ["k1"], "go_deeper": "g"}
    import systemedu.student.drill.routes as r
    monkeypatch.setattr(r, "generate_drill", fake_gen)
    # mock get_knode
    class _K:
        title = "采样率"; plan_markdown = "ctx"
    class _Client:
        async def get_knode(self, slug, mod): return _K()
    monkeypatch.setattr(r, "get_library_client", lambda: _Client())


async def test_drill_create_and_reuse(asgi_client, mock_drill_deps):
    # register
    await asgi_client.post("/api/auth/register", json={"username": "drilluser", "password": "pw123456"})
    tok = (await asgi_client.post("/api/auth/login", json={"username": "drilluser", "password": "pw123456"})).json()["token"]
    H = {"Authorization": f"Bearer {tok}"}
    body = {"library_slug": "eeg", "module_id": "M01", "highlight_text": "奈奎斯特"}
    r1 = await asgi_client.post("/api/knowledge/drill", json=body, headers=H)
    assert r1.status_code == 201
    assert r1.json()["content"]["simple_explanation"].startswith("讲解:奈奎斯特")
    drill_id = r1.json()["id"]
    # 复用: 同 highlight 再 POST → 返回已存 (200, 同 id)
    r2 = await asgi_client.post("/api/knowledge/drill", json=body, headers=H)
    assert r2.status_code == 200
    assert r2.json()["id"] == drill_id
    # list
    rl = await asgi_client.get("/api/knowledge/drill?library_slug=eeg&module_id=M01", headers=H)
    assert rl.status_code == 200
    assert len(rl.json()["drills"]) == 1
