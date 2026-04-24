"""s15_theory 单元 + 集成测试。"""

from __future__ import annotations

import json

import pytest

from systemedu.course_factory_v3.progress import Emitter
from systemedu.course_factory_v3.steps import s15_theory


@pytest.fixture
def normal_ctx():
    return {
        "project_name": "rocket-design",
        "category": "aerospace",
        "knowledge_level": "K3",
        "knode": {
            "title": "推力的产生",
            "core_question": "如何让火箭获得足够的推力升空?",
            "module_role": "core",
        },
        "plan_markdown": """> Module: P-RKT-01-M02 · core

## 学习目标
ok
## 引入
ok
## 核心概念: 推力与质量流量
推力 = 质量流量 × 排气速度
## 深入理解: 牛顿第三定律
作用力等于反作用力
## 应用与拓展
完成实验
## 推荐互动资源
- foo
## 学习路径建议
done
""",
    }


@pytest.mark.asyncio
async def test_skip_for_capstone_node():
    ctx = {
        "project_name": "x", "category": "x", "knowledge_level": "K3",
        "knode": {"title": "终极", "module_role": "capstone"},
        "plan_markdown": "## 项目背景\n...",
    }
    em = Emitter(lambda e, d: None)
    res = await s15_theory.run(ctx, em=em)
    assert res == []


@pytest.mark.asyncio
async def test_skip_when_plan_empty():
    ctx = {
        "project_name": "x", "category": "x", "knowledge_level": "K3",
        "knode": {"title": "x", "module_role": "core"},
        "plan_markdown": "",
    }
    em = Emitter(lambda e, d: None)
    res = await s15_theory.run(ctx, em=em)
    assert res == []


@pytest.mark.asyncio
async def test_pick_theories_parses_json(normal_ctx, monkeypatch):
    fake = json.dumps({
        "theories": [
            {"theory_id": "theory_phys_thrust", "title": "推力",
             "subject": "physics", "tags": ["physics/mechanics/thrust"],
             "related_paragraph": "## 核心概念: 推力与质量流量"},
            {"theory_id": "theory_phys_newton3", "title": "牛顿第三定律",
             "subject": "physics", "tags": ["physics/mechanics/newton-laws"],
             "related_paragraph": "## 深入理解: 牛顿第三定律"},
        ]
    })

    async def fake_invoke(llm, msgs, **kw):
        return fake
    monkeypatch.setattr(s15_theory, "ainvoke", fake_invoke)

    em = Emitter(lambda e, d: None)
    picks = await s15_theory._pick_theories(normal_ctx, normal_ctx["plan_markdown"], em=em)
    assert len(picks) == 2
    assert picks[0]["theory_id"] == "theory_phys_thrust"
    assert "physics/mechanics/thrust" in picks[0]["tags"]


@pytest.mark.asyncio
async def test_pick_theories_caps_at_5(normal_ctx, monkeypatch):
    items = [
        {"theory_id": f"t_{i}", "title": f"T{i}", "subject": "physics",
         "tags": [], "related_paragraph": ""}
        for i in range(8)
    ]
    async def fake_invoke(llm, msgs, **kw):
        return json.dumps({"theories": items})
    monkeypatch.setattr(s15_theory, "ainvoke", fake_invoke)

    em = Emitter(lambda e, d: None)
    picks = await s15_theory._pick_theories(normal_ctx, normal_ctx["plan_markdown"], em=em)
    assert len(picks) == 5  # 硬上限


@pytest.mark.asyncio
async def test_write_theory_body_validates_K1_present(monkeypatch):
    pick = {
        "theory_id": "theory_phys_thrust", "title": "推力", "subject": "physics",
        "tags": [], "related_paragraph": "",
    }
    ctx = {"project_name": "x", "knode": {"title": "x"}, "knowledge_level": "K3"}

    # K1 缺失 → 应返 None
    fake = json.dumps({
        "body_markdown": "x", "level_bodies": [{"level": "K3", "body_markdown": "x"}],
        "exercises": [],
    })
    async def fake_invoke(llm, msgs, **kw):
        return fake
    monkeypatch.setattr(s15_theory, "ainvoke", fake_invoke)

    em = Emitter(lambda e, d: None)
    res = await s15_theory._write_theory_body(pick, ctx, em=em)
    assert res is None


@pytest.mark.asyncio
async def test_write_theory_body_returns_full_dict(monkeypatch):
    pick = {
        "theory_id": "theory_phys_thrust", "title": "推力", "subject": "physics",
        "tags": ["physics/mechanics/thrust"], "related_paragraph": "## 核心",
    }
    ctx = {"project_name": "x", "knode": {"title": "x"}, "knowledge_level": "K3"}

    fake = json.dumps({
        "body_markdown": "推力就是把东西往前推的力。",
        "level_bodies": [
            {"level": "K1", "body_markdown": "推力就是把东西往前推的力。"},
            {"level": "K3", "body_markdown": "推力 \\(F = \\dot{m} v_e\\),其中 m 是质量流量。"},
        ],
        "exercises": [
            {"question": "下面哪个是推力的例子?", "type": "choice",
             "options": ["推门", "拉绳", "踢球", "扔石头"], "correct": 0,
             "explanation": "推门是经典推力。"},
        ],
    })
    async def fake_invoke(llm, msgs, **kw):
        return fake
    monkeypatch.setattr(s15_theory, "ainvoke", fake_invoke)

    em = Emitter(lambda e, d: None)
    res = await s15_theory._write_theory_body(pick, ctx, em=em)
    assert res is not None
    assert res["theory_id"] == "theory_phys_thrust"
    assert len(res["level_bodies"]) == 2
    assert len(res["exercises"]) == 1
    assert res["exercises"][0]["correct"] == 0


def test_validate_exercises_drops_invalid():
    raw = [
        # 正常
        {"question": "Q1", "options": ["a", "b", "c", "d"], "correct": 1, "explanation": "x"},
        # 选项数错
        {"question": "Q2", "options": ["a", "b"], "correct": 0, "explanation": "x"},
        # correct 越界
        {"question": "Q3", "options": ["a", "b", "c", "d"], "correct": 5, "explanation": "x"},
        # 缺 question
        {"options": ["a", "b", "c", "d"], "correct": 0, "explanation": "x"},
    ]
    out = s15_theory._validate_exercises(raw)
    assert len(out) == 1
    assert out[0]["question"] == "Q1"


def test_insert_placeholders_inserts_after_section(normal_ctx):
    theories = [
        {"theory_id": "theory_phys_thrust", "title": "推力",
         "related_paragraph": "## 核心概念: 推力与质量流量"},
        {"theory_id": "theory_phys_newton3", "title": "牛顿第三定律",
         "related_paragraph": "## 深入理解: 牛顿第三定律"},
    ]
    new_plan = s15_theory._insert_placeholders(normal_ctx["plan_markdown"], theories)
    assert "[[THEORY:theory_phys_thrust]]" in new_plan
    assert "[[THEORY:theory_phys_newton3]]" in new_plan
    # thrust 占位符必须出现在"## 核心概念"段之后、"## 深入理解"之前
    pos_thrust = new_plan.index("[[THEORY:theory_phys_thrust]]")
    pos_deep = new_plan.index("## 深入理解")
    assert pos_thrust < pos_deep


def test_insert_placeholders_no_duplicate():
    plan = "## A\nfoo\n## B\nbar\n"
    theories = [
        {"theory_id": "theory_x", "title": "X", "related_paragraph": "## A"},
        {"theory_id": "theory_x", "title": "X", "related_paragraph": "## A"},  # dup
    ]
    out = s15_theory._insert_placeholders(plan, theories)
    assert out.count("[[THEORY:theory_x]]") == 1


@pytest.mark.asyncio
async def test_run_with_real_llm_rocket_design():
    """集成测试: 真实 Kimi 跑 rocket-design knode 0,验证 theories 生成 + 占位符插入。"""
    from systemedu.course_factory_v3.steps import s00_boot, s10_plan
    em = Emitter(lambda e, d: None)
    ctx = await s00_boot.run("rocket-design", 0, user_id="t", overrides={}, em=em)
    ctx["plan_markdown"] = await s10_plan.run(ctx, em=em)
    theories = await s15_theory.run(ctx, em=em)

    # 数量 2-5 (foundation 节点也应有理论)
    assert 2 <= len(theories) <= 5, f"got {len(theories)} theories"

    # 每个 theory 必有 K1 + 完整字段
    for t in theories:
        assert t["theory_id"].startswith("theory_")
        assert t["title"]
        assert t["subject"] in {"math", "physics", "chemistry", "biology", "cs", "geography", "other"}
        levels = [lb["level"] for lb in t["level_bodies"]]
        assert "K1" in levels, f"{t['theory_id']} missing K1"
        # body_markdown == K1 版本
        k1_body = next(lb["body_markdown"] for lb in t["level_bodies"] if lb["level"] == "K1")
        assert t["body_markdown"] == k1_body
        # exercises 1-3 道
        assert 1 <= len(t["exercises"]) <= 3

    # plan_markdown 中必含 [[THEORY:xxx]] 占位符,数量 = theories 数量
    new_plan = ctx["plan_markdown"]
    for t in theories:
        assert f"[[THEORY:{t['theory_id']}]]" in new_plan, f"missing placeholder for {t['theory_id']}"
