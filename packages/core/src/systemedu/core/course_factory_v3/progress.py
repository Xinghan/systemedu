"""SSE 事件协议定义。

pipeline 通过 progress_cb(event_name, data_dict) 推送事件。
事件名是字符串,data 是 JSON 可序列化 dict。
前端 web/src/lib/api/index.ts 中的 SSE 消费侧需对齐这些事件名。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal

ProgressCallback = Callable[[str, dict], None]

# 事件名常量 — 改名时 grep 全仓更新
EV_BOOT = "boot"
EV_STEP_START = "step_start"
EV_STEP_DONE = "step_done"
EV_GATE_START = "gate_start"
EV_GATE_PASS = "gate_pass"
EV_GATE_FAIL = "gate_fail"
EV_REVISE_START = "revise_start"
EV_IDEA_COMPLETE = "idea_complete"
EV_AGENT_LOG = "agent_log"  # 与 v2 兼容,前端已支持
EV_DONE = "done"
EV_ERROR = "error"

# Step ID 常量 — 必须与 SKILL.md 章节号一一对应
STEP_BOOT = "0"
STEP_RESEARCH = "0.5"
STEP_LABXCHANGE = "0.7"
STEP_PLAN = "1"
STEP_THEORY = "1.5"
STEP_IDEATION = "2"
STEP_DIVERGENCE = "2.5"
STEP_CREATIVITY = "2.6"
STEP_DETAIL = "3"
STEP_DEBATE = "4"
STEP_IMPLEMENT = "5"
STEP_GATE_A = "5.5a"  # code review (regex)
STEP_GATE_B = "5.5b"  # browser verify (subprocess)
STEP_GATE_C = "5.5c"  # science (LLM)
STEP_GATE_D = "5.5d"  # theory grader (LLM)
STEP_GATE_E = "5.5e"  # game aesthetic (LLM)
STEP_GATE_F = "5.5f"  # text overlap (LLM with screenshot)
STEP_ASSEMBLE = "6"
STEP_ASSIGNMENT = "6.5"
STEP_AUDIO = "6.6"

ALL_STEPS = [
    STEP_BOOT, STEP_RESEARCH, STEP_LABXCHANGE,
    STEP_PLAN, STEP_THEORY,
    STEP_IDEATION, STEP_DIVERGENCE, STEP_CREATIVITY,
    STEP_DETAIL, STEP_DEBATE, STEP_IMPLEMENT,
    STEP_GATE_A, STEP_GATE_B, STEP_GATE_C, STEP_GATE_D, STEP_GATE_E, STEP_GATE_F,
    STEP_ASSEMBLE, STEP_ASSIGNMENT, STEP_AUDIO,
]


@dataclass
class Emitter:
    """轻量包装,把 progress_cb 调用集中,避免散落 None 检查。"""

    cb: ProgressCallback | None = None

    def emit(self, event: str, data: dict | None = None) -> None:
        if self.cb is None:
            return
        try:
            self.cb(event, data or {})
        except Exception:
            # SSE 推送失败不应中断 pipeline
            pass

    def step_start(self, step: str, **extra) -> None:
        self.emit(EV_STEP_START, {"step": step, **extra})

    def step_done(self, step: str, **extra) -> None:
        self.emit(EV_STEP_DONE, {"step": step, **extra})

    def gate_start(self, step: str, idea_id: str, attempt: int = 1) -> None:
        self.emit(EV_GATE_START, {"step": step, "idea_id": idea_id, "attempt": attempt})

    def gate_pass(self, step: str, idea_id: str, attempt: int = 1) -> None:
        self.emit(EV_GATE_PASS, {"step": step, "idea_id": idea_id, "attempt": attempt})

    def gate_fail(self, step: str, idea_id: str, attempt: int, issues: list[str]) -> None:
        self.emit(EV_GATE_FAIL, {
            "step": step, "idea_id": idea_id, "attempt": attempt,
            "issues": issues[:20],  # 防止 issues 太多撑爆 SSE
        })

    def revise_start(self, step: str, idea_id: str, attempt: int) -> None:
        self.emit(EV_REVISE_START, {"step": step, "idea_id": idea_id, "attempt": attempt})

    def idea_complete(self, idea_id: str, mode: str, status: Literal["ready", "failed"]) -> None:
        self.emit(EV_IDEA_COMPLETE, {"idea_id": idea_id, "mode": mode, "status": status})

    def agent_log(self, agent: str, phase: str, input_summary: str, output_summary: str) -> None:
        self.emit(EV_AGENT_LOG, {
            "agent": agent, "phase": phase,
            "input": input_summary[:600],
            "output": output_summary[:1200],
        })

    def done(self, status: str = "ready", **extra) -> None:
        self.emit(EV_DONE, {"status": status, **extra})

    def error(self, step: str, message: str) -> None:
        self.emit(EV_ERROR, {"step": step, "message": message})
