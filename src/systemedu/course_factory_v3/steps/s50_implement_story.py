"""Step 5 — Story: detail_plan.paragraphs 直接当 result。"""

from __future__ import annotations

from ..progress import EV_AGENT_LOG, Emitter


async def implement(idea: dict, ctx: dict, *, em: Emitter) -> list[dict] | None:
    detail_plan = idea.get("detail_plan") or {}
    paragraphs = detail_plan.get("paragraphs") or []
    if not paragraphs:
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementStory", "phase": "empty",
            "input": "", "output": "detail_plan.paragraphs empty",
        })
        return None

    out = []
    for p in paragraphs:
        if isinstance(p, dict):
            out.append({
                "text": p.get("text", ""),
                "image_url": p.get("image_url", ""),
            })
        elif isinstance(p, str):
            out.append({"text": p, "image_url": ""})

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementStory", "phase": "output",
        "input": "", "output": f"paragraphs={len(out)}",
    })
    return out
