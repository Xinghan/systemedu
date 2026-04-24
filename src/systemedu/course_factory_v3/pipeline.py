"""Course Factory v3 主编排器 — 12 步状态机。

执行顺序严格遵循 course_factory/SKILL.md:
    0 → 0.5 → 0.7 → 1 → 1.5 → 2 → 2.5 → 2.6 → 3 → 4 → 5 → 5.5 → 6 → 6.5 → 6.6

每一步对应 steps/ 下一个文件,每个闸门对应 gates/ 下一个文件。
本文件只负责调度、SSE 推送、闸门 revise loop;不实现具体 step 逻辑。
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from .progress import (
    ALL_STEPS, EV_BOOT, Emitter, ProgressCallback,
    STEP_BOOT, STEP_RESEARCH, STEP_LABXCHANGE,
    STEP_PLAN, STEP_THEORY,
    STEP_IDEATION, STEP_DIVERGENCE, STEP_CREATIVITY,
    STEP_DETAIL, STEP_DEBATE, STEP_IMPLEMENT,
    STEP_ASSEMBLE, STEP_ASSIGNMENT, STEP_AUDIO,
)

logger = logging.getLogger(__name__)


class StepSkipError(Exception):
    """pipeline 检测到跳步时抛出(顺序铁律违反)。F.1.1 单元测试用。"""


async def generate_course_v3(
    project_name: str,
    knode_id: int,
    *,
    user_id: str = "default",
    progress_cb: ProgressCallback | None = None,
    regenerate: bool = False,
    overrides: dict | None = None,
) -> dict:
    """v3 主入口。

    Args:
        project_name: 项目英文 slug
        knode_id: knode global index(从 0 起)
        progress_cb: SSE 推送回调,签名 (event_name, data_dict) -> None
        regenerate: 已 ready 时是否强制重生(False 直接返回 cached)
        overrides: 用户开工声明的 overrides,如 {"skip_research": True, ...}

    Returns:
        {project_name, knode_id, status: "ready"|"failed", course_content: dict}
    """
    overrides = overrides or {}
    em = Emitter(progress_cb)

    # ---- cache check ----
    if not regenerate:
        cached = _load_cached(project_name, knode_id)
        if cached:
            em.done("ready", from_cache=True)
            return cached

    # ---- DB row 占位 generating ----
    _mark_generating(project_name, knode_id)

    # ---- 12 步骨架 ----
    # 每个 step 在阶段 B/C/D 实现,这里先占位让 SSE 流跑起来
    try:
        # Step 0 — boot 内部会 emit 开工声明事件(必须是第一个事件,SKILL 启动协议)
        # 然后我们再 emit step_start/step_done 包裹它(对齐其它 step 的事件模式)
        from .steps import s00_boot
        ctx = await s00_boot.run(project_name, knode_id, user_id=user_id, overrides=overrides, em=em)
        em.step_start(STEP_BOOT)
        em.step_done(STEP_BOOT, role=ctx.get("module_role", ""))

        # Step 0.5 Tavily
        em.step_start(STEP_RESEARCH)
        if overrides.get("skip_research"):
            ctx["research"] = None
        else:
            from .steps import s05_research
            ctx["research"] = await s05_research.run(ctx, em=em)
        em.step_done(STEP_RESEARCH, has_research=bool(ctx.get("research")))

        # Step 0.7 LabXchange
        em.step_start(STEP_LABXCHANGE)
        if overrides.get("skip_labxchange"):
            ctx["labxchange"] = []
        else:
            from .steps import s07_labxchange
            ctx["labxchange"] = await s07_labxchange.run(ctx, em=em)
        em.step_done(STEP_LABXCHANGE, count=len(ctx.get("labxchange", [])))

        # Step 1 plan_markdown
        em.step_start(STEP_PLAN)
        from .steps import s10_plan
        ctx["plan_markdown"] = await s10_plan.run(ctx, em=em)
        em.step_done(STEP_PLAN, length=len(ctx["plan_markdown"]))

        # Step 1.5 theories
        em.step_start(STEP_THEORY)
        from .steps import s15_theory
        ctx["theories"] = await s15_theory.run(ctx, em=em)
        em.step_done(STEP_THEORY, count=len(ctx["theories"]))

        # Step 2 ideation (8 类逐条 debate)
        em.step_start(STEP_IDEATION)
        from .steps import s20_ideation
        ctx["plan_with_placeholders"], ctx["ideas"] = await s20_ideation.run(ctx, em=em)
        em.step_done(STEP_IDEATION, idea_count=len(ctx["ideas"]))

        # Step 2.5 divergence (anim/game only)
        em.step_start(STEP_DIVERGENCE)
        from .steps import s25_divergence
        ctx["ideas"] = await s25_divergence.run(ctx, em=em)
        em.step_done(STEP_DIVERGENCE)

        # Step 2.6 creativity gate
        em.step_start(STEP_CREATIVITY)
        from .steps import s26_creativity_gate
        ctx["ideas"] = await s26_creativity_gate.run(ctx, em=em)
        em.step_done(STEP_CREATIVITY)

        # Step 3 detail (并行)
        em.step_start(STEP_DETAIL)
        from .steps import s30_detail
        ctx["ideas"] = await s30_detail.run(ctx, em=em)
        em.step_done(STEP_DETAIL)

        # Step 4 debate (决策 reject/approve)
        em.step_start(STEP_DEBATE)
        from .steps import s40_debate
        ctx["ideas"] = await s40_debate.run(ctx, em=em)
        em.step_done(STEP_DEBATE, approved=sum(1 for i in ctx["ideas"] if i.get("decision") == "approve"))

        # Step 5 implement + 5.5 闸门链 (并行,内部带 revise loop)
        em.step_start(STEP_IMPLEMENT)
        from .steps import s50_implement
        ctx["ideas"] = await s50_implement.run(ctx, em=em)
        em.step_done(STEP_IMPLEMENT, ready=sum(1 for i in ctx["ideas"] if i.get("status") == "ready"))

        # Step 6 assemble + preflight + upsert_lesson
        em.step_start(STEP_ASSEMBLE)
        from .steps import s60_assemble
        ctx["course_content"] = await s60_assemble.run(ctx, em=em)
        em.step_done(STEP_ASSEMBLE)

        # Step 6.5 assignment
        em.step_start(STEP_ASSIGNMENT)
        from .steps import s65_assignment
        ctx["assignment"] = await s65_assignment.run(ctx, em=em)
        em.step_done(STEP_ASSIGNMENT)

        # Step 6.6 audio scripts
        em.step_start(STEP_AUDIO)
        from .steps import s66_audio
        ctx["sections"] = await s66_audio.run(ctx, em=em)
        em.step_done(STEP_AUDIO, sections=len(ctx.get("sections") or []))

        em.done("ready")
        return {
            "project_name": project_name,
            "knode_id": knode_id,
            "status": "ready",
            "course_content": ctx["course_content"],
        }

    except Exception as exc:
        logger.exception(f"[v3] generate_course_v3 failed for {project_name}/{knode_id}")
        _mark_failed(project_name, knode_id)
        em.error("pipeline", str(exc))
        raise


# ---------------------------------------------------------------------------
# DB helpers — 阶段 D 接 gateway 时复用
# ---------------------------------------------------------------------------

def _load_cached(project_name: str, knode_id: int) -> dict | None:
    from systemedu.storage.db import LessonContent, get_session
    db = get_session()
    try:
        lesson = db.query(LessonContent).filter_by(
            project_name=project_name, knode_id=knode_id,
        ).first()
        if lesson and lesson.status == "ready" and lesson.course_content:
            return {
                "project_name": project_name,
                "knode_id": knode_id,
                "status": "ready",
                "course_content": json.loads(lesson.course_content),
            }
        return None
    finally:
        db.close()


def _mark_generating(project_name: str, knode_id: int) -> None:
    from systemedu.storage.db import LessonContent, get_session
    db = get_session()
    try:
        lesson = db.query(LessonContent).filter_by(
            project_name=project_name, knode_id=knode_id,
        ).first()
        if lesson is None:
            lesson = LessonContent(
                project_name=project_name,
                knode_id=knode_id,
                status="generating",
                content_type="cf",
                course_content="",
            )
            db.add(lesson)
        else:
            lesson.status = "generating"
        db.commit()
    finally:
        db.close()


def _mark_failed(project_name: str, knode_id: int) -> None:
    from systemedu.storage.db import LessonContent, get_session
    db = get_session()
    try:
        lesson = db.query(LessonContent).filter_by(
            project_name=project_name, knode_id=knode_id,
        ).first()
        if lesson:
            lesson.status = "failed"
            db.commit()
    finally:
        db.close()
