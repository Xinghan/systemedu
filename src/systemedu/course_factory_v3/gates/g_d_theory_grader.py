"""5.5d Theory 等级评审 — 每个 theory 跨 level 一次 LLM agent。阶段 C 实现。"""

from __future__ import annotations

from .base import Gate, GateResult
from ..progress import STEP_GATE_D


class TheoryGraderGate(Gate):
    name = STEP_GATE_D
    max_revise = 2

    async def run(self, *, html, idea, ctx, attempt=1) -> GateResult:
        # TODO C5: 每 theory 一次 kimi 调用,跨 level 对比判断
        # idea 在这里实际是 theory dict, 不是 anim/game idea
        # 返回结构: {verdict, per_level: {K1:..., K4:...}, animation_review: {...}}
        raise NotImplementedError("g_d_theory_grader: 阶段 C 实现")
