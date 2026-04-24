"""Step 2: 8 类富媒体逐条 debate + ideas 抽取。阶段 B 实现。"""

from __future__ import annotations

from ..progress import Emitter


async def run(ctx: dict, *, em: Emitter) -> tuple[str, list[dict]]:
    # TODO B6: 强制 8 类 (theory/anim/game/kit/image/diagram/youtube/labxchange) 逐行 keep/reject
    # 返回 (plan_with_placeholders, ideas)
    raise NotImplementedError("s20_ideation: 阶段 B 实现")
