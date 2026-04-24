"""Step 1.5: 标注基础理论 theories。阶段 B 实现。"""

from __future__ import annotations

from ..progress import Emitter


async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    # TODO B5: 先选 2-5 个 theory_id, 再并行为每个生成 K1+项目等级 level_bodies + 1-3 道 exercises
    # 同步在 ctx["plan_markdown"] 中插入 [[THEORY:xxx]] 占位符
    raise NotImplementedError("s15_theory: 阶段 B 实现")
