"""5.5c 科学一致性 — LLM agent 检查物理数值/方向/比例/单位。阶段 C 实现。"""

from __future__ import annotations

from .base import Gate, GateResult
from ..progress import STEP_GATE_C


class ScienceGate(Gate):
    name = STEP_GATE_C
    max_revise = 2

    async def run(self, *, html, idea, ctx, attempt=1) -> GateResult:
        # TODO C4: kimi prompt = HTML 关键片段 + knode 描述 + SKILL §1865-1884 检查清单
        raise NotImplementedError("g_c_science: 阶段 C 实现")
