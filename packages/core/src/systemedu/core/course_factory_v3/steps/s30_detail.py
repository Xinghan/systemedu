"""Step 3: detail_plan 生成 (并行)。

实现 SKILL.md §1214-1353 + F.15。每个 idea 加载对应 mode 的 detail prompt,
LLM 生成 detail_plan 写回 idea["detail_plan"]。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path

from ..kimi_client import ainvoke, llm_for
from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

_PROMPT_BY_MODE = {
    "animation": "detail_anim.md",
    "game": "detail_game.md",
    "exercise": "detail_exercise.md",
    "image": "detail_image.md",
    "diagram": "detail_diagram.md",
    "hands_on_kit": "detail_kit.md",
    "story": "detail_story.md",
}


async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    """对所有 idea 并行跑 detail_plan 生成。"""
    ideas = ctx.get("ideas") or []
    if not ideas:
        return ideas

    em.emit(EV_AGENT_LOG, {
        "agent": "Detail", "phase": "input",
        "input": f"count={len(ideas)}",
        "output": "(parallel detail generation)",
    })

    updated = await asyncio.gather(*[_detail_one(i, ctx, em=em) for i in ideas])
    return updated


async def _detail_one(idea: dict, ctx: dict, *, em: Emitter) -> dict:
    mode = idea.get("mode", "")
    prompt_file = _PROMPT_BY_MODE.get(mode)
    if not prompt_file:
        logger.warning(f"[s30] no detail prompt for mode {mode}")
        return idea

    prompt = _format_prompt(prompt_file, idea, ctx)
    llm = llm_for("fast", streaming=False, max_tokens=8192)
    try:
        response = await ainvoke(llm, [{"role": "user", "content": prompt}],
                                  label=f"detail[{idea.get('idea_id')}]")
    except Exception as exc:
        logger.exception(f"[s30] LLM failed for {idea.get('idea_id')}: {exc}")
        return idea

    data = _parse_json(response)
    if not isinstance(data, dict):
        logger.warning(f"[s30] not a dict for {idea.get('idea_id')}: {response[:200]}")
        return idea

    idea["detail_plan"] = data
    em.emit(EV_AGENT_LOG, {
        "agent": "Detail", "phase": f"done[{idea.get('idea_id')}]",
        "input": "",
        "output": f"keys={list(data.keys())[:8]}",
    })
    return idea


def _format_prompt(prompt_file: str, idea: dict, ctx: dict) -> str:
    knode = ctx["knode"]
    template = (PROMPTS_DIR / prompt_file).read_text(encoding="utf-8")
    age_range = ctx.get("age_range") or [10, 15]
    div = idea.get("divergence") or {}

    # 通用字段
    fmt = {
        "idea_id": idea.get("idea_id", ""),
        "topic": idea.get("topic", ""),
        "context_summary": idea.get("context_summary", ""),
        "style_key": idea.get("style_key", ctx.get("category", "space")),
        "category": ctx.get("category", ""),
        "core_question": knode.get("core_question", ""),
        "hands_on_ref": idea.get("hands_on_ref", ""),
        "acceptance_ref": idea.get("acceptance_ref", ""),
        "chosen_pattern": div.get("chosen_pattern", "") or idea.get("mode_reason", ""),
        "age_min": age_range[0] if age_range else 10,
        "age_max": age_range[1] if len(age_range) > 1 else 15,
        "acceptance_standard_block": _bullets(knode.get("acceptance_standard") or []),
        "hands_on_components_block": _bullets(knode.get("hands_on_components") or []),
    }
    return template.format(**fmt)


def _bullets(items: list) -> str:
    if not items:
        return "(无)"
    lines = []
    for it in items:
        if isinstance(it, str):
            lines.append(f"- {it}")
        elif isinstance(it, dict):
            lines.append(f"- {it.get('title', it.get('name', str(it)))}")
    return "\n".join(lines) or "(无)"


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
