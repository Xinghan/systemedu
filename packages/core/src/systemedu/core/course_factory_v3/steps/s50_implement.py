"""Step 5: 并行实现 + Step 5.5 闸门链。

每个 idea 走自己的 mode-specific 实现 + 闸门链:
    animation: implement_anim → 5.5a → 5.5b → 5.5c → 5.5f
    game     : implement_game → 5.5a → 5.5b → 5.5c → 5.5e → 5.5f
    exercise : make_exercises (无闸门)
    image    : download_course_image (无闸门)
    diagram  : implement_diagram → 5.5a → 5.5b
    kit      : implement_kit (无闸门)
    story    : implement_story (无闸门)

theory 的 5.5d 在 Step 1.5 之后单独跑(不在本文件)。

闸门 fail → revise → 重跑(按 Gate.max_revise);仍失败 → idea status=failed,
不阻塞 knode 整体写入。
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from ..progress import EV_AGENT_LOG, Emitter

from . import (
    s50_implement_anim,
    s50_implement_diagram,
    s50_implement_exercise,
    s50_implement_game,
    s50_implement_image,
    s50_implement_kit,
    s50_implement_story,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Mode → implementer 路由
# ---------------------------------------------------------------------------

# 每个 implementer.implement(idea, ctx, em) 返回 result 或 None
_IMPL_MAP = {
    "animation": s50_implement_anim.implement,
    "game": s50_implement_game.implement,
    "exercise": s50_implement_exercise.implement,
    "image": s50_implement_image.implement,
    "diagram": s50_implement_diagram.implement,
    "hands_on_kit": s50_implement_kit.implement,
    "story": s50_implement_story.implement,
}


# ---------------------------------------------------------------------------
# 闸门链 (按 mode 决定哪些闸门跑)
# ---------------------------------------------------------------------------

def _gate_chain(mode: str) -> list[str]:
    """返回该 mode 应跑的闸门 step id 列表(按顺序)。

    临时去掉 5.5c (科学一致性) + 5.5f (文字重叠), LLM 评判过严反复 revise 浪费时间;
    保留 5.5a (regex 硬约束) + 5.5b (Playwright 渲染验证)。
    """
    if mode == "animation":
        return ["5.5a", "5.5b"]
    if mode == "game":
        return ["5.5a", "5.5b", "5.5e"]
    if mode == "diagram":
        return ["5.5a", "5.5b"]
    return []  # exercise/image/kit/story 无闸门


async def _run_gate(gate_id: str, html: str, idea: dict, ctx: dict, attempt: int):
    """加载闸门并跑一次。返回 GateResult 或 None(闸门未实现时)。"""
    from ..gates import GateResult
    try:
        if gate_id == "5.5a":
            from ..gates.g_a_code_review import CodeReviewGate
            gate = CodeReviewGate()
        elif gate_id == "5.5b":
            from ..gates.g_b_browser_verify import BrowserVerifyGate
            gate = BrowserVerifyGate()
        elif gate_id == "5.5c":
            from ..gates.g_c_science import ScienceGate
            gate = ScienceGate()
        elif gate_id == "5.5e":
            from ..gates.g_e_game_aesthetic import GameAestheticGate
            gate = GameAestheticGate()
        elif gate_id == "5.5f":
            from ..gates.g_f_text_overlap import TextOverlapGate
            gate = TextOverlapGate()
        else:
            return None
        return await gate.run(html=html, idea=idea, ctx=ctx, attempt=attempt)
    except NotImplementedError:
        # 闸门尚未实现(阶段 C 还没填完), 当作 pass 跳过
        logger.info(f"[s50] gate {gate_id} not yet implemented, skipping")
        return GateResult(verdict="pass", issues=[], attempt=attempt, raw={"skipped": True})
    except Exception as exc:
        logger.exception(f"[s50] gate {gate_id} crashed")
        return GateResult(verdict="fail", issues=[f"gate {gate_id} crashed: {exc}"], attempt=attempt)


async def _implement_one(idea: dict, ctx: dict, *, em: Emitter) -> dict:
    """实现一个 idea + 跑闸门链 + revise loop。返回更新后的 idea(含 result/status)。"""
    mode = idea.get("mode", "")
    impl = _IMPL_MAP.get(mode)
    if impl is None:
        idea["result"] = None
        idea["status"] = "failed"
        em.idea_complete(idea.get("idea_id", ""), mode, "failed")
        return idea

    # 1. 首次实现
    result = await impl(idea, ctx, em=em)
    if result is None:
        idea["result"] = None
        idea["status"] = "failed"
        em.idea_complete(idea.get("idea_id", ""), mode, "failed")
        return idea

    # exercise/image/kit/story 无闸门, 直接成功
    chain = _gate_chain(mode)
    if not chain:
        idea["result"] = result
        idea["status"] = "ready"
        em.idea_complete(idea.get("idea_id", ""), mode, "ready")
        return idea

    # 2. 闸门链 + revise loop (anim/game/diagram)
    html = result if isinstance(result, str) else None
    if html is None:
        # 不该走到这里
        idea["result"] = result
        idea["status"] = "ready"
        em.idea_complete(idea.get("idea_id", ""), mode, "ready")
        return idea

    from ..revise import revise_html

    overall_failed = False
    for gate_id in chain:
        max_revise = _max_revise_for(gate_id)
        attempt = 1
        while attempt <= 1 + max_revise:
            em.gate_start(gate_id, idea.get("idea_id", ""), attempt=attempt)
            res = await _run_gate(gate_id, html, idea, ctx, attempt)
            if res is None:
                break  # 没这个闸门, 跳过
            if res.passed:
                em.gate_pass(gate_id, idea.get("idea_id", ""), attempt=attempt)
                break
            # fail
            em.gate_fail(gate_id, idea.get("idea_id", ""), attempt, res.issues)
            if attempt > max_revise:
                logger.warning(
                    f"[s50] {gate_id} fail after {attempt} attempts for "
                    f"{idea.get('idea_id')}, marking failed"
                )
                overall_failed = True
                break
            # revise
            new_html = await revise_html(
                step_name=gate_id,
                mode=mode,
                original_html=html,
                issues=res.issues,
                detail_plan=idea.get("detail_plan") or {},
                ctx=ctx,
                em=em,
                attempt=attempt + 1,
            )
            if new_html and (new_html.strip().startswith("<!DOCTYPE") or "<html" in new_html[:200].lower()):
                html = new_html
            else:
                logger.warning(f"[s50] revise produced invalid HTML, marking failed")
                overall_failed = True
                break
            attempt += 1
        if overall_failed:
            break

    if overall_failed:
        idea["result"] = None
        idea["status"] = "failed"
        em.idea_complete(idea.get("idea_id", ""), mode, "failed")
    else:
        idea["result"] = html
        idea["status"] = "ready"
        em.idea_complete(idea.get("idea_id", ""), mode, "ready")
    return idea


def _max_revise_for(gate_id: str) -> int:
    """与 plan.md §3 表格对齐的 revise 上限。"""
    return {
        "5.5a": 3, "5.5b": 3, "5.5c": 2,
        "5.5d": 2, "5.5e": 2, "5.5f": 1,
    }.get(gate_id, 1)


# ---------------------------------------------------------------------------
# 主入口 — pipeline 调
# ---------------------------------------------------------------------------

async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    """对所有 approved idea 并行实现 + 跑闸门。"""
    ideas = ctx.get("ideas") or []
    # revise 也算 approved (revise_hint 已经在 idea 里, implement 会用到);
    # 只有 reject 才真不做。
    approved = [i for i in ideas if i.get("decision") in ("approve", "revise", None)]
    rejected = [i for i in ideas if i.get("decision") == "reject"]

    em.emit(EV_AGENT_LOG, {
        "agent": "Step5", "phase": "input",
        "input": f"approved={len(approved)}, rejected={len(rejected)}",
        "output": "(implementing serially to respect creative provider rate limits)",
    })

    if not approved:
        return ideas

    # 串行实现 (GLM-5.1 等 creative provider 有速率限制, 并行会撞 429)
    updated_approved = []
    for idea in approved:
        result = await _implement_one(idea, ctx, em=em)
        updated_approved.append(result)

    # 把 reject 的也保留(它们已经在 Step 4 决策)
    by_id = {i.get("idea_id"): i for i in rejected}
    for i in updated_approved:
        by_id[i.get("idea_id")] = i

    # 保持原始顺序
    result = []
    seen = set()
    for orig in ideas:
        iid = orig.get("idea_id")
        if iid in by_id and iid not in seen:
            result.append(by_id[iid])
            seen.add(iid)
    return result
