"""Step 6.5: generate_assignment + upsert_assignment。

实现 SKILL.md §2162-2244。直接调 factory.generate_assignment (内部按 module_role
切换 capstone vs normal prompt) + factory.upsert_assignment 写入 LessonContent.project_assignment。
"""

from __future__ import annotations

import asyncio
import logging

from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)


async def run(ctx: dict, *, em: Emitter) -> str:
    """生成 assignment Markdown 并写库。返回 assignment 文本(失败返空字符串,不抛)。"""
    from course_factory.factory import generate_assignment, upsert_assignment

    knode = ctx["knode"]
    milestone = ctx.get("milestone") or {}
    plan_markdown = ctx.get("plan_markdown", "")

    em.emit(EV_AGENT_LOG, {
        "agent": "Assignment", "phase": "input",
        "input": f"knode={knode.get('title','')!r}, role={knode.get('module_role','')}",
        "output": "(pending)",
    })

    try:
        assignment = await asyncio.to_thread(
            generate_assignment, knode, milestone, plan_markdown,
        )
    except Exception as exc:
        logger.warning(f"[s65] generate_assignment failed: {exc}")
        em.emit(EV_AGENT_LOG, {
            "agent": "Assignment", "phase": "fail",
            "input": "", "output": f"ERROR: {exc}",
        })
        return ""

    if not assignment:
        em.emit(EV_AGENT_LOG, {
            "agent": "Assignment", "phase": "empty",
            "input": "", "output": "LLM 返回空,不写库",
        })
        return ""

    try:
        await asyncio.to_thread(
            upsert_assignment,
            ctx["project_name"],
            ctx["knode_id"],
            assignment,
        )
    except Exception as exc:
        logger.warning(f"[s65] upsert_assignment failed: {exc}")
        em.emit(EV_AGENT_LOG, {
            "agent": "Assignment", "phase": "upsert_fail",
            "input": "", "output": f"ERROR: {exc}",
        })
        # assignment 已生成,只是写库失败,仍返回内容(后续可补写)
        return assignment

    em.emit(EV_AGENT_LOG, {
        "agent": "Assignment", "phase": "output",
        "input": "",
        "output": f"length={len(assignment)} chars, written to DB",
    })
    return assignment
