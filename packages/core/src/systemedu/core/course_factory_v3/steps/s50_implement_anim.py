"""Step 5 — Animation HTML 生成 (fogsight 风格 + streaming)。

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
    """生成 animation HTML, 失败返 None。"""
    detail_plan = idea.get("detail_plan") or {}
    style_key = idea.get("style_key") or detail_plan.get("style_key") or ctx.get("category") or "space"
    theme = pick_theme(style_key)

    template = (PROMPTS_DIR / "implement_anim.md").read_text(encoding="utf-8")
    # 用直接替换避免 JS/CSS object literal 中的 `{` 误触发 .format() KeyError
    prompt = (
        template
        .replace("{detail_plan_json}", json.dumps(detail_plan, ensure_ascii=False, indent=2))
        .replace("{core_question}", ctx["knode"].get("core_question", ""))
        .replace("{hands_on_ref}", idea.get("hands_on_ref", ""))
        .replace("{acceptance_ref}", idea.get("acceptance_ref", ""))
        .replace("{style_key}", theme.id)
        .replace("{theme_block}", theme.as_prompt_block())
    )

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementAnim", "phase": "input",
        "input": f"idea={idea.get('idea_id')}, theme={theme.id}, prompt_len={len(prompt)}",
        "output": "(streaming HTML, fogsight style)...",
    })

    def _emit_progress(elapsed_s, n_chunks, total_len, last_60):
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementAnim", "phase": f"streaming-{int(elapsed_s)}s",
            "input": f"chunks={n_chunks}",
            "output": f"len={total_len}, tail: {last_60[:60]!r}",
        })

    try:
        html = await astream_html(
            role="creative",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=32768,
            timeout_s=1800.0,
            label=f"impl_anim[{idea.get('idea_id')}]",
            progress_cb=_emit_progress,
        )
    except Exception as exc:
        logger.exception(f"[s50_anim] streaming failed for {idea.get('idea_id')}")
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementAnim", "phase": "fail",
            "input": "", "output": f"ERROR: {exc}",
        })
        return None

    if not html.strip().startswith("<!DOCTYPE") and "<html" not in html[:200].lower():
        # Dump 完整响应到磁盘以便诊断 (GLM 偶发返回空/非 HTML 内容)
        from datetime import datetime
        dump_path = Path(f"/tmp/anim_invalid_{idea.get('idea_id', 'unknown')}_{datetime.now().strftime('%H%M%S')}.txt")
        try:
            dump_path.write_text(
                f"=== prompt (last 2000 chars) ===\n{prompt[-2000:]}\n\n=== response (full, len={len(html)}) ===\n{html}",
                encoding="utf-8"
            )
        except Exception:
            pass
        logger.warning(f"[s50_anim] LLM did not return HTML (len={len(html)}), dumped to {dump_path}")
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementAnim", "phase": "invalid",
            "input": "", "output": f"got len={len(html)}, dumped to {dump_path}, head: {html[:200]!r}",
        })
        return None

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementAnim", "phase": "output",
        "input": "", "output": f"HTML length={len(html)} chars",
    })
    return html
