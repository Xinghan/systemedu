"""5.5f 文字重叠 — 用 5.5b 的截图 + LLM 看图判断。阶段 C 实现。"""

from __future__ import annotations

from .base import Gate, GateResult
from ..progress import STEP_GATE_F


class TextOverlapGate(Gate):
    name = STEP_GATE_F
    max_revise = 1

    async def run(self, *, html, idea, ctx, attempt=1) -> GateResult:
        # TODO C7: 取 5.5b 的 out/screenshot, kimi vision 判断文字重叠
        raise NotImplementedError("g_f_text_overlap: 阶段 C 实现")
