"""5.5e 游戏性 + 美观 — LLM agent 判 Pattern 真实性 + 视觉。阶段 C 实现。"""

from __future__ import annotations

from .base import Gate, GateResult
from ..progress import STEP_GATE_E


class GameAestheticGate(Gate):
    name = STEP_GATE_E
    max_revise = 2

    async def run(self, *, html, idea, ctx, attempt=1) -> GateResult:
        # TODO C6: 是否真的操纵动态系统 / Pattern X 变装识别 / 美观 / theme palette 一致性
        raise NotImplementedError("g_e_game_aesthetic: 阶段 C 实现")
