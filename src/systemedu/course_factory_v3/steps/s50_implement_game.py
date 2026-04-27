"""Step 5 — Game HTML 生成 (fogsight 风格 + streaming + 真实交互)。

streaming 是核心: kimi-k2.6 reasoning 模型在非 streaming 时长输出会被
OpenAI SDK 默认 timeout 杀掉。用 astream_html 直接消费 chunk,
httpx 1800s timeout 兜底。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from ..kimi_client import astream_html
from ..theme_loader import pick_theme
from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


async def implement(idea: dict, ctx: dict, *, em: Emitter) -> str | None:
    detail_plan = idea.get("detail_plan") or {}
    style_key = idea.get("style_key") or detail_plan.get("style_key") or ctx.get("category") or "space"
    theme = pick_theme(style_key)
    chosen_pattern = (
        (idea.get("divergence") or {}).get("chosen_pattern")
        or detail_plan.get("game_mechanic", "Pattern 1: Sandbox")
    )

    template = (PROMPTS_DIR / "implement_game.md").read_text(encoding="utf-8")
    prompt = (
        template
        .replace("{detail_plan_json}", json.dumps(detail_plan, ensure_ascii=False, indent=2))
        .replace("{core_question}", ctx["knode"].get("core_question", ""))
        .replace("{hands_on_ref}", idea.get("hands_on_ref", ""))
        .replace("{acceptance_ref}", idea.get("acceptance_ref", ""))
        .replace("{chosen_pattern}", chosen_pattern)
        .replace("{style_key}", theme.id)
        .replace("{theme_block}", theme.as_prompt_block())
    )

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementGame", "phase": "input",
        "input": f"idea={idea.get('idea_id')}, theme={theme.id}, pattern={chosen_pattern}",
        "output": "(streaming HTML, fogsight style)...",
    })

    def _emit_progress(elapsed_s, n_chunks, total_len, last_60):
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementGame", "phase": f"streaming-{int(elapsed_s)}s",
            "input": f"chunks={n_chunks}",
            "output": f"len={total_len}, tail: {last_60[:60]!r}",
        })

    try:
        html = await astream_html(
            role="creative",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=32768,
            timeout_s=1800.0,
            label=f"impl_game[{idea.get('idea_id')}]",
            progress_cb=_emit_progress,
        )
    except Exception as exc:
        logger.exception(f"[s50_game] streaming failed for {idea.get('idea_id')}")
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementGame", "phase": "fail",
            "input": "", "output": f"ERROR: {exc}",
        })
        return None

    if not html.strip().startswith("<!DOCTYPE") and "<html" not in html[:200].lower():
        logger.warning(f"[s50_game] LLM did not return HTML: {html[:200]}")
        return None

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementGame", "phase": "output",
        "input": "", "output": f"HTML length={len(html)} chars",
    })
    return html
