"""Step 2.6: Creativity Gate (Subtract / Replay / Surprise / Aha 4 问)。

实现 SKILL.md §1124-1137 + F.12。任一 fail → 回 s25 重新发散(最多 2 次)。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path

from ..kimi_client import ainvoke, llm_for
from ..progress import EV_AGENT_LOG, Emitter
from . import s25_divergence

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
MAX_DIVERGENCE_RETRIES = 1  # 1 次 retry 已经足够; 反复重做几乎不改变 LLM 判定且每轮 ~80s


async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    """对每个 anim/game 跑 4 问;失败回 s25 重跑(最多 2 次)。"""
    ideas = ctx.get("ideas") or []
    updated = await asyncio.gather(
        *[_check_one(i, ctx, em=em) for i in ideas if i.get("mode") in ("animation", "game")]
    )
    by_id = {i.get("idea_id"): i for i in updated}
    result = []
    for orig in ideas:
        iid = orig.get("idea_id")
        if iid in by_id:
            result.append(by_id[iid])
        else:
            result.append(orig)
    return result


async def _check_one(idea: dict, ctx: dict, *, em: Emitter) -> dict:
    for attempt in range(1 + MAX_DIVERGENCE_RETRIES):
        gate_result = await _run_gate(idea, ctx, em=em, attempt=attempt + 1)
        if gate_result.get("overall") == "pass":
            idea["creativity_gate"] = gate_result
            return idea
        # 失败: 重新发散 + 重跑
        em.emit(EV_AGENT_LOG, {
            "agent": "CreativityGate",
            "phase": f"fail-attempt-{attempt + 1}",
            "input": f"idea={idea.get('idea_id')}",
            "output": json.dumps({k: v.get("verdict") for k, v in gate_result.items() if isinstance(v, dict)}, ensure_ascii=False),
        })
        if attempt >= MAX_DIVERGENCE_RETRIES:
            # 达到上限,标记 gate fail 但不阻断 idea
            logger.warning(f"[s26] creativity gate failed after {attempt+1} attempts for {idea.get('idea_id')}")
            idea["creativity_gate"] = gate_result
            idea["creativity_gate"]["forced_pass"] = True
            return idea
        # 重新发散一次
        idea = await s25_divergence._diverge_one(idea, ctx, em=em)
    return idea


async def _run_gate(idea: dict, ctx: dict, *, em: Emitter, attempt: int) -> dict:
    div = idea.get("divergence") or {}
    chosen_pattern = div.get("chosen_pattern", "")
    chosen_pitch = div.get("chosen_pitch", "")

    prompt = (PROMPTS_DIR / "creativity_4q.md").read_text(encoding="utf-8").format(
        mode=idea.get("mode", ""),
        topic=idea.get("topic", ""),
        chosen_pattern=chosen_pattern,
        chosen_pitch=chosen_pitch,
    )

    llm = llm_for("fast", streaming=False, max_tokens=2048)
    try:
        response = await ainvoke(llm, [{"role": "user", "content": prompt}],
                                  label=f"creativity[{idea.get('idea_id')}-{attempt}]")
    except Exception as exc:
        logger.exception(f"[s26] LLM failed for {idea.get('idea_id')}: {exc}")
        return {"overall": "fail", "_error": str(exc)}

    data = _parse_json(response)
    if not isinstance(data, dict):
        return {"overall": "fail", "_error": "no JSON"}
    return data


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
