"""Step 6.6: generate_audio_scripts。

实现 SKILL.md §2246-2309。直接调 factory.generate_audio_scripts,该函数会:
1. 从 DB 读 course_content.plan_markdown
2. 按 ##/### 分段(纯 Python, 保留占位符)
3. 对每段 LLM 生成 150-300 字口语化讲课稿
4. 写回 course_content.sections[] 并保存 DB
"""

from __future__ import annotations

import asyncio
import logging

from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)


async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    """生成 sections 数组(每段含 audio_script)并写回 DB。返回 sections。"""
    from course_factory.factory import generate_audio_scripts

    knode = ctx["knode"]
    milestone = ctx.get("milestone") or {}

    em.emit(EV_AGENT_LOG, {
        "agent": "AudioScripts", "phase": "input",
        "input": f"knode={knode.get('title','')!r}",
        "output": "(generating per-section scripts...)",
    })

    try:
        sections = await asyncio.to_thread(
            generate_audio_scripts,
            ctx["project_name"],
            ctx["knode_id"],
            knode,
            milestone,
        )
    except Exception as exc:
        logger.warning(f"[s66] generate_audio_scripts failed: {exc}")
        em.emit(EV_AGENT_LOG, {
            "agent": "AudioScripts", "phase": "fail",
            "input": "", "output": f"ERROR: {exc}",
        })
        return []

    n_with_script = sum(1 for s in (sections or []) if s.get("audio_script"))
    em.emit(EV_AGENT_LOG, {
        "agent": "AudioScripts", "phase": "output",
        "input": "",
        "output": f"sections={len(sections or [])}, with audio_script={n_with_script}",
    })
    return sections or []
