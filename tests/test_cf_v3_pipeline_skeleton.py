"""pipeline 骨架测试 — 用 mock 让所有 step 跳过,验证 SSE 事件序列。

阶段 A5 验收点。当 step 实现填实后,这个测试应该仍然通过(只是 step 内部行为变化,
事件序列不变)。
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch, AsyncMock, MagicMock

import pytest

from systemedu.course_factory_v3 import generate_course_v3
from systemedu.course_factory_v3.progress import (
    EV_BOOT, EV_STEP_START, EV_STEP_DONE, EV_DONE,
    STEP_BOOT, STEP_RESEARCH, STEP_LABXCHANGE,
    STEP_PLAN, STEP_THEORY,
    STEP_IDEATION, STEP_DIVERGENCE, STEP_CREATIVITY,
    STEP_DETAIL, STEP_DEBATE, STEP_IMPLEMENT,
    STEP_ASSEMBLE, STEP_ASSIGNMENT, STEP_AUDIO,
)


def _make_step_mocks():
    """为每个 step 模块的 run() 函数返回一个 AsyncMock,使其立即返回合理占位值。"""
    return {
        "s00_boot.run": AsyncMock(return_value={
            "project_name": "test", "knode_id": 0,
            "knode": {"name": "test"}, "milestone": {"title": "M"},
            "sub_project": None, "module_role": "core",
            "category": "physics", "knowledge_level": "K3",
        }),
        "s05_research.run": AsyncMock(return_value={"web_results": [], "youtube_results": []}),
        "s07_labxchange.run": AsyncMock(return_value=[]),
        "s10_plan.run": AsyncMock(return_value="plan markdown body"),
        "s15_theory.run": AsyncMock(return_value=[{"theory_id": "t1"}]),
        "s20_ideation.run": AsyncMock(return_value=("plan_with_ph", [{"idea_id": "i1", "mode": "exercise"}])),
        "s25_divergence.run": AsyncMock(return_value=[{"idea_id": "i1", "mode": "exercise"}]),
        "s26_creativity_gate.run": AsyncMock(return_value=[{"idea_id": "i1", "mode": "exercise"}]),
        "s30_detail.run": AsyncMock(return_value=[{"idea_id": "i1", "mode": "exercise", "detail_plan": {}}]),
        "s40_debate.run": AsyncMock(return_value=[{"idea_id": "i1", "mode": "exercise", "decision": "approve"}]),
        "s50_implement.run": AsyncMock(return_value=[{"idea_id": "i1", "mode": "exercise", "status": "ready"}]),
        "s60_assemble.run": AsyncMock(return_value={"plan_markdown": "x", "ideas": [], "rendered_sections": {}}),
        "s65_assignment.run": AsyncMock(return_value="assignment text"),
        "s66_audio.run": AsyncMock(return_value=[{"heading": "h", "audio_script": "a"}]),
    }


@pytest.mark.asyncio
async def test_pipeline_skeleton_emits_full_sse_sequence(monkeypatch, tmp_path):
    """让所有 step mock 通过,断言 SSE 事件按 12 步顺序推送。"""

    # patch DB helpers 避免真打数据库
    monkeypatch.setattr(
        "systemedu.course_factory_v3.pipeline._load_cached",
        lambda p, k: None,
    )
    monkeypatch.setattr(
        "systemedu.course_factory_v3.pipeline._mark_generating",
        lambda p, k: None,
    )
    monkeypatch.setattr(
        "systemedu.course_factory_v3.pipeline._mark_failed",
        lambda p, k: None,
    )

    # patch 所有 step 模块
    mocks = _make_step_mocks()
    from systemedu.course_factory_v3.steps import (
        s00_boot, s05_research, s07_labxchange,
        s10_plan, s15_theory,
        s20_ideation, s25_divergence, s26_creativity_gate,
        s30_detail, s40_debate, s50_implement,
        s60_assemble, s65_assignment, s66_audio,
    )
    monkeypatch.setattr(s00_boot, "run", mocks["s00_boot.run"])
    monkeypatch.setattr(s05_research, "run", mocks["s05_research.run"])
    monkeypatch.setattr(s07_labxchange, "run", mocks["s07_labxchange.run"])
    monkeypatch.setattr(s10_plan, "run", mocks["s10_plan.run"])
    monkeypatch.setattr(s15_theory, "run", mocks["s15_theory.run"])
    monkeypatch.setattr(s20_ideation, "run", mocks["s20_ideation.run"])
    monkeypatch.setattr(s25_divergence, "run", mocks["s25_divergence.run"])
    monkeypatch.setattr(s26_creativity_gate, "run", mocks["s26_creativity_gate.run"])
    monkeypatch.setattr(s30_detail, "run", mocks["s30_detail.run"])
    monkeypatch.setattr(s40_debate, "run", mocks["s40_debate.run"])
    monkeypatch.setattr(s50_implement, "run", mocks["s50_implement.run"])
    monkeypatch.setattr(s60_assemble, "run", mocks["s60_assemble.run"])
    monkeypatch.setattr(s65_assignment, "run", mocks["s65_assignment.run"])
    monkeypatch.setattr(s66_audio, "run", mocks["s66_audio.run"])

    events: list[tuple[str, dict]] = []
    def cb(event: str, data: dict):
        events.append((event, data))

    result = await generate_course_v3(
        project_name="test", knode_id=0,
        progress_cb=cb, regenerate=True,
    )

    assert result["status"] == "ready"
    assert result["project_name"] == "test"
    assert result["knode_id"] == 0

    # ---- 事件序列断言 ----
    event_names = [e for e, _ in events]

    # 1. boot 事件由 s00_boot.run 内部 emit(在 step_start 之前),所以在真实运行中
    # 它一定是 events[0]。本测试 mock 了 s00_boot.run, boot 事件不会发出,但顺序断言
    # 仍能验证 12 步状态机本身。boot 事件本身由 s00_boot 单元测试覆盖。
    # 这里只断言 step_start[0] == STEP_BOOT。
    assert event_names[0] == EV_STEP_START
    assert events[0][1]["step"] == STEP_BOOT

    # 2. 顺序铁律 (F.1.1): step_start 事件按 14 个 step ID 严格排序出现
    expected_steps = [
        STEP_BOOT, STEP_RESEARCH, STEP_LABXCHANGE,
        STEP_PLAN, STEP_THEORY,
        STEP_IDEATION, STEP_DIVERGENCE, STEP_CREATIVITY,
        STEP_DETAIL, STEP_DEBATE, STEP_IMPLEMENT,
        STEP_ASSEMBLE, STEP_ASSIGNMENT, STEP_AUDIO,
    ]
    starts = [d["step"] for e, d in events if e == EV_STEP_START]
    assert starts == expected_steps, f"step_start 顺序不对: {starts}"

    # 3. 每个 step_start 都有对应 step_done
    dones = [d["step"] for e, d in events if e == EV_STEP_DONE]
    assert dones == expected_steps, f"step_done 顺序不对: {dones}"

    # 4. 最后一个事件是 done
    assert event_names[-1] == EV_DONE
    assert events[-1][1]["status"] == "ready"


@pytest.mark.asyncio
async def test_s00_boot_emits_boot_event_with_full_checklist():
    """单独验证 s00_boot.run 真实跑时会发出含 15 项 checklist 的 boot 事件 (F.0.1)。"""
    from systemedu.course_factory_v3.steps import s00_boot
    from systemedu.course_factory_v3.progress import Emitter, EV_BOOT

    events = []
    em = Emitter(lambda e, d: events.append((e, d)))

    # 用真实存在的 rocket-design knode 0
    ctx = await s00_boot.run(
        "rocket-design", 0, user_id="test", overrides={}, em=em,
    )

    # 必须 emit 1 次 boot 事件
    boot_events = [d for e, d in events if e == EV_BOOT]
    assert len(boot_events) == 1
    boot = boot_events[0]
    assert boot["project_name"] == "rocket-design"
    assert boot["knode_id"] == 0
    assert "checklist" in boot
    assert len(boot["checklist"]) == 15
    # checklist 第一项必须是 "0 加载上下文"
    assert boot["checklist"][0].startswith("0 ")
    # 最后一项必须是 6.6
    assert boot["checklist"][-1].startswith("6.6 ")

    # ctx 必含 v4.1 字段
    assert "knode" in ctx
    assert "milestone" in ctx
    assert "module_role" in ctx


@pytest.mark.asyncio
async def test_pipeline_returns_cached_when_not_regenerate(monkeypatch):
    """已 ready 时 regenerate=False 应直接返回 cache,不走 step。"""
    monkeypatch.setattr(
        "systemedu.course_factory_v3.pipeline._load_cached",
        lambda p, k: {
            "project_name": p, "knode_id": k,
            "status": "ready", "course_content": {"plan_markdown": "cached"},
        },
    )
    events = []
    result = await generate_course_v3(
        project_name="test", knode_id=0,
        progress_cb=lambda e, d: events.append((e, d)),
        regenerate=False,
    )
    assert result["status"] == "ready"
    assert result["course_content"]["plan_markdown"] == "cached"
    assert events == [(EV_DONE, {"status": "ready", "from_cache": True})]
