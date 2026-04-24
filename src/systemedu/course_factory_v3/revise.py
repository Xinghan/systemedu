"""统一 revise 入口。闸门失败时拿 issues 反馈,重生成对应 step 产物。

接口:
    revised = await revise(step_name, original, issues, ctx)

step_name 决定加载哪个 prompts/revise_*.md。
"""

from __future__ import annotations


async def revise(step_name: str, original: str | dict, issues: list[str], ctx: dict) -> str | dict:
    # TODO C8: 阶段 C 实现
    raise NotImplementedError("revise: 阶段 C 实现")
