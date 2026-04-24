"""Step 6: 组装 course_content + preflight_v41 + upsert_lesson。阶段 B 实现。"""

from __future__ import annotations

from ..progress import Emitter


async def run(ctx: dict, *, em: Emitter) -> dict:
    # TODO B18: 调 factory.make_course_content(knode=, research=, labxchange_results=, theories=, ...)
    # preflight 自动跑, 失败抛 ValueError
    # 然后 factory.upsert_lesson 写入 DB
    raise NotImplementedError("s60_assemble: 阶段 B 实现")
