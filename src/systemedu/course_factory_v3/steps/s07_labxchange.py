"""Step 0.7: LabXchange 本地 pathway 匹配。

实现 SKILL.md §384-548。无 LLM,直接调 factory.search_labxchange_for_knode,
该函数从 knode 自动提取英文关键词在本地 1467 pathway 索引中搜索。
"""

from __future__ import annotations

import asyncio
import logging

from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)


async def run(ctx: dict, *, em: Emitter, top_k: int = 3) -> list[dict]:
    """返回 LabXchange pathway 列表(允许空)。"""
    from course_factory.factory import search_labxchange_for_knode

    knode = ctx["knode"]
    em.emit(EV_AGENT_LOG, {
        "agent": "LabXchange", "phase": "input",
        "input": f"knode={knode.get('title', '')!r}, top_k={top_k}",
        "output": "(pending)",
    })

    try:
        results = await asyncio.to_thread(search_labxchange_for_knode, knode, top_k=top_k)
    except Exception as exc:
        logger.warning(f"[s07] labxchange search failed: {exc}")
        em.emit(EV_AGENT_LOG, {
            "agent": "LabXchange", "phase": "output",
            "input": "", "output": f"ERROR: {exc}",
        })
        return []

    em.emit(EV_AGENT_LOG, {
        "agent": "LabXchange", "phase": "output",
        "input": f"knode={knode.get('title','')!r}",
        "output": (
            f"matched {len(results)} pathway(s); "
            f"top: {[r.get('title','')[:60] for r in results[:3]]}"
        ),
    })

    return results
