"""Course Factory v3 主编排器 — 12 步状态机。

执行顺序严格遵循 course_factory/SKILL.md:
    0 → 0.5 → 0.7 → 1 → 1.5 → 2 → 2.5 → 2.6 → 3 → 4 → 5 → 5.5 → 6 → 6.5 → 6.6

每一步对应 steps/ 下一个文件,每个闸门对应 gates/ 下一个文件。
本文件只负责调度、SSE 推送、闸门 revise loop;不实现具体 step 逻辑。
"""

from __future__ import annotations

import logging

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
    version_label: str,
    user_id: str = "default",
    progress_cb: ProgressCallback | None = None,
    set_active: bool = True,
    overrides: dict | None = None,
) -> dict:
    """v3 主入口 (多版本)。

    Args:
        project_name: 项目英文 slug
        knode_id: knode global index(从 0 起)
        version_label: 本次生成的版本标签(必填), 如 "kimi-fogsight" / "qwen-baseline"
                       同标签重复生成会覆盖旧记录, 不同标签共存
        progress_cb: SSE 推送回调,签名 (event_name, data_dict) -> None
        set_active: 写入完成时是否自动设为 active (默认 True)
        overrides: 用户开工声明的 overrides,如 {"skip_research": True, ...}

    Returns:
        {project_name, knode_id, version_label, status: "ready"|"failed", course_content: dict}
    """
    if not version_label or not version_label.strip():
        raise ValueError("version_label 不能为空, 请明确指定版本标签 (如 'kimi-fogsight')")
    version_label = version_label.strip()
    overrides = overrides or {}
    em = Emitter(progress_cb)

    # ---- DB row 占位 generating (per-version, 不影响其他版本) ----
    _mark_generating(project_name, knode_id, version_label)

    # ---- 12 步骨架 ----
    # 每个 step 在阶段 B/C/D 实现,这里先占位让 SSE 流跑起来
    try:
        # Step 0 — boot 内部会 emit 开工声明事件(必须是第一个事件,SKILL 启动协议)
        # 然后我们再 emit step_start/step_done 包裹它(对齐其它 step 的事件模式)
        from .steps import s00_boot
        ctx = await s00_boot.run(project_name, knode_id, user_id=user_id, overrides=overrides, em=em)
        ctx["version_label"] = version_label
        ctx["set_active"] = set_active
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

        em.done("ready", version_label=version_label)
        return {
            "project_name": project_name,
            "knode_id": knode_id,
            "version_label": version_label,
            "status": "ready",
            "course_content": ctx["course_content"],
        }

    except Exception as exc:
        logger.exception(f"[v3] generate_course_v3 failed for {project_name}/{knode_id}/{version_label}")
        _mark_failed(project_name, knode_id, version_label)
        em.error("pipeline", str(exc))
        raise


# ---------------------------------------------------------------------------
# DB helpers — 阶段 D 接 gateway 时复用
# ---------------------------------------------------------------------------

def _mark_generating(project_name: str, knode_id: int, version_label: str) -> None:
    """为 (project, knode, version_label) 占位 generating 行 (per-version, 不影响其他版本)。"""
    from systemedu.core.storage.db import LessonContentV3, get_session
    db = get_session()
    try:
        lesson = db.query(LessonContentV3).filter_by(
            project_name=project_name, knode_id=knode_id, version_label=version_label,
        ).first()
        if lesson is None:
            lesson = LessonContentV3(
                project_name=project_name,
                knode_id=knode_id,
                version_label=version_label,
                is_active=False,
                status="generating",
                course_content="",
            )
            db.add(lesson)
        else:
            lesson.status = "generating"
        db.commit()
    finally:
        db.close()


def _mark_failed(project_name: str, knode_id: int, version_label: str) -> None:
    from systemedu.core.storage.db import LessonContentV3, get_session
    db = get_session()
    try:
        lesson = db.query(LessonContentV3).filter_by(
            project_name=project_name, knode_id=knode_id, version_label=version_label,
        ).first()
        if lesson:
            lesson.status = "failed"
            db.commit()
    finally:
        db.close()
