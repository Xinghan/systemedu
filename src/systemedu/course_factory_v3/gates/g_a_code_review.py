"""5.5a Code Review — 静态正则检测,无 LLM。阶段 C 实现。"""

from __future__ import annotations

from .base import Gate, GateResult
from ..progress import STEP_GATE_A


class CodeReviewGate(Gate):
    name = STEP_GATE_A
    max_revise = 3

    async def run(self, *, html, idea, ctx, attempt=1) -> GateResult:
        # TODO C2: 检测 SKILL §1404-1428 的 19 条硬约束 + §1751-1769 自检清单
        raise NotImplementedError("g_a_code_review: 阶段 C 实现")
