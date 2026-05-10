"""Step 5 — Image: 调 factory.download_course_image 下载 CC-BY/CC0 图片。

当前简化策略: detail_plan.search_keywords 不直接搜图(避免依赖图片搜索 API),
而是要求上游(B14 实现时)从已知 NASA/Wikimedia 数据集中选取 src URL。
本 step 假设 detail_plan 已含 src/alt/caption/source_url/license。
"""

from __future__ import annotations

import asyncio
import logging

from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)


async def implement(idea: dict, ctx: dict, *, em: Emitter) -> dict | None:
    detail_plan = idea.get("detail_plan") or {}
    src = detail_plan.get("src") or ""
    if not src:
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementImage", "phase": "empty",
            "input": "", "output": "detail_plan.src missing — image idea 应在 detail step 提供完整 src",
        })
        return None

    from course_factory.factory import download_course_image
    knode = ctx["knode"]
    knode_key = f"{ctx['project_name']}_k{ctx['knode_id']}"

    try:
        web_path = await asyncio.to_thread(
            download_course_image,
            src,
            knode_key,
            detail_plan.get("alt") or detail_plan.get("topic") or "",
        )
    except Exception as exc:
        logger.warning(f"[s50_img] download failed: {exc}")
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementImage", "phase": "fail",
            "input": src, "output": f"ERROR: {exc}",
        })
        return None

    result = {
        "src": src,
        "web_path": web_path,
        "alt": detail_plan.get("alt", ""),
        "caption": detail_plan.get("caption", ""),
        "source_url": detail_plan.get("source_url", ""),
        "license": detail_plan.get("license_hint") or detail_plan.get("license", ""),
        "topic": detail_plan.get("topic", "") or idea.get("topic", ""),
    }
    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementImage", "phase": "output",
        "input": "", "output": f"web_path={web_path}",
    })
    return result
