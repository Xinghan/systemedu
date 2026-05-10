"""闸门通用接口。

所有闸门继承 Gate ABC,实现 async run(html, idea, ctx) -> GateResult。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal

GateVerdict = Literal["pass", "fail"]


@dataclass
class GateResult:
    verdict: GateVerdict
    issues: list[str] = field(default_factory=list)
    attempt: int = 1
    raw: dict | None = None  # 闸门返回的结构化数据(如 LLM JSON)

    @property
    def passed(self) -> bool:
        return self.verdict == "pass"


class Gate(ABC):
    """所有闸门的基类。

    name 必须与 progress.py 中的 STEP_GATE_X 常量对齐。
    max_revise 是该闸门失败后允许的最大 revise 次数。
    """

    name: str = ""
    max_revise: int = 1

    @abstractmethod
    async def run(
        self,
        *,
        html: str | None,
        idea: dict | None,
        ctx: dict,
        attempt: int = 1,
    ) -> GateResult:
        ...
