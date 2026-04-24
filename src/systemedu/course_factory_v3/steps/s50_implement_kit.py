"""Step 5 — hands_on_kit: detail_plan 已经是完整套件描述, 直接传 factory。"""

from __future__ import annotations

from ..progress import EV_AGENT_LOG, Emitter


async def implement(idea: dict, ctx: dict, *, em: Emitter) -> dict | None:
    detail_plan = idea.get("detail_plan") or {}
    if not detail_plan.get("components") or not detail_plan.get("steps"):
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementKit", "phase": "incomplete",
            "input": "", "output": "detail_plan missing components or steps",
        })
        return None

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementKit", "phase": "output",
        "input": "",
        "output": (
            f"components={len(detail_plan.get('components', []))}, "
            f"steps={len(detail_plan.get('steps', []))}, "
            f"total_cost_cny={detail_plan.get('total_cost_cny', 0)}"
        ),
    })
    # detail_plan 本身就是 factory.make_course_content hands_on_kits 项的完整结构
    return detail_plan
