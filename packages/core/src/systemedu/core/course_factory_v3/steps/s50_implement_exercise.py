"""Step 5 — Exercise 实现: 从 detail_plan.exercises 走 factory.make_exercises 兜底验证。"""

from __future__ import annotations

import logging

from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)


async def implement(idea: dict, ctx: dict, *, em: Emitter) -> list[dict] | None:
    detail_plan = idea.get("detail_plan") or {}
    raw = detail_plan.get("exercises") or []
    if not raw:
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementExercise", "phase": "empty",
            "input": "", "output": "detail_plan.exercises empty",
        })
        return None

    from course_factory.factory import make_exercises
    try:
        items = make_exercises(raw)
    except Exception as exc:
        logger.exception(f"[s50_ex] make_exercises failed: {exc}")
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementExercise", "phase": "fail",
            "input": "", "output": f"ERROR: {exc}",
        })
        return None

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementExercise", "phase": "output",
        "input": f"raw count={len(raw)}", "output": f"validated={len(items)}",
    })
    return items
