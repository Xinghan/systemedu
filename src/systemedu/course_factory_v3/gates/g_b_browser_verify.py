"""5.5b Browser Verify — 子进程跑 course_factory/validate/verify/{animation,game}.mjs。阶段 C 实现。"""

from __future__ import annotations

from .base import Gate, GateResult
from ..progress import STEP_GATE_B


class BrowserVerifyGate(Gate):
    name = STEP_GATE_B
    max_revise = 3

    async def run(self, *, html, idea, ctx, attempt=1) -> GateResult:
        # TODO C3: asyncio.create_subprocess_exec("node", "course_factory/validate/verify/animation.mjs", html_path, "--out", tmp)
        # 捕 exit code + stdout JSON, 失败时把 issues 拍成可读的 list[str]
        raise NotImplementedError("g_b_browser_verify: 阶段 C 实现")
