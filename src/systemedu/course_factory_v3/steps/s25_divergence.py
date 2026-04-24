"""Step 2.5: Ideation Divergence (3 方案发散)。

实现 SKILL.md §1110-1123 + F.11。仅对 anim/game idea 跑;exercise/story/image/diagram/kit 跳过。

每个 anim/game idea 出 3 个跨不同 Pattern/呈现模式的候选,选 1 个,把选择写到 idea["divergence"]。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path

from ..kimi_client import ainvoke, kimi
from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    """对每个 anim/game idea 并行跑 divergence。返回更新后的 ideas。"""
    ideas = ctx.get("ideas") or []
    targets = [i for i in ideas if i.get("mode") in ("animation", "game")]
    if not targets:
        return ideas

    em.emit(EV_AGENT_LOG, {
        "agent": "Divergence", "phase": "input",
        "input": f"target_count={len(targets)} ideas (anim/game)",
        "output": "(pending parallel)",
    })

    updated = await asyncio.gather(*[_diverge_one(i, ctx, em=em) for i in targets])
    by_id = {i.get("idea_id"): i for i in updated}

    result = []
    for orig in ideas:
        iid = orig.get("idea_id")
        if iid in by_id:
            result.append(by_id[iid])
        else:
            result.append(orig)
    return result


async def _diverge_one(idea: dict, ctx: dict, *, em: Emitter) -> dict:
    knode = ctx["knode"]
    prompt = (PROMPTS_DIR / "divergence_3pattern.md").read_text(encoding="utf-8").format(
        mode=idea.get("mode", ""),
        topic=idea.get("topic", ""),
        context_summary=idea.get("context_summary", ""),
        category=ctx.get("category", ""),
        style_key=idea.get("style_key", ""),
        core_question=knode.get("core_question", ""),
        hands_on_ref=idea.get("hands_on_ref", ""),
        acceptance_ref=idea.get("acceptance_ref", ""),
    )

    llm = kimi(streaming=False, max_tokens=4096)
    try:
        response = await ainvoke(llm, [{"role": "user", "content": prompt}],
                                  label=f"divergence[{idea.get('idea_id')}]")
    except Exception as exc:
        logger.exception(f"[s25] LLM failed for {idea.get('idea_id')}: {exc}")
        return idea

    data = _parse_json(response)
    if not isinstance(data, dict):
        logger.warning(f"[s25] not a dict for {idea.get('idea_id')}: {response[:200]}")
        return idea

    candidates = data.get("candidates") or []
    chosen_index = data.get("chosen_index", 0)
    if not isinstance(chosen_index, int) or chosen_index < 0 or chosen_index >= len(candidates):
        chosen_index = 0
    chosen = candidates[chosen_index] if candidates else {}

    idea["divergence"] = {
        "candidates": candidates,
        "chosen_index": chosen_index,
        "chosen_pattern": chosen.get("pattern", ""),
        "chosen_pitch": chosen.get("pitch", ""),
        "chosen_rationale": data.get("chosen_rationale", ""),
    }
    em.emit(EV_AGENT_LOG, {
        "agent": "Divergence", "phase": f"done[{idea.get('idea_id')}]",
        "input": "",
        "output": f"chose: {chosen.get('pattern', '')[:60]}",
    })
    return idea


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json(response: str):
    if not response:
        return None
    s = response.strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    try:
        return json.loads(s)
    except Exception:
        m = _JSON_RE.search(s)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return None
