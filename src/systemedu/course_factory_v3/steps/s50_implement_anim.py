"""Step 5 — Animation HTML 生成 (fogsight 风格 + 教学骨架)。

不再注入 skeleton + 19 条约束, 而是用精简 prompt + Tailwind/SVG/CSS 自由发挥,
但保留 sidebar 教学骨架 + i18n + acceptance_ref 对齐 (与 fogsight 不同)。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from ..kimi_client import ainvoke, kimi
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
    )

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementAnim", "phase": "input",
        "input": f"idea={idea.get('idea_id')}, theme={theme.id}, prompt_len={len(prompt)}",
        "output": "(generating HTML, fogsight style with sidebar)...",
    })

    llm = kimi(streaming=False, max_tokens=32768)
    try:
        html = await ainvoke(
            llm, [{"role": "user", "content": prompt}],
            label=f"impl_anim[{idea.get('idea_id')}]",
        )
    except Exception as exc:
        logger.exception(f"[s50_anim] LLM failed for {idea.get('idea_id')}")
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementAnim", "phase": "fail",
            "input": "", "output": f"ERROR: {exc}",
        })
        return None

    html = _strip_codeblock(html)
    if not html.strip().startswith("<!DOCTYPE") and "<html" not in html[:200].lower():
        logger.warning(f"[s50_anim] LLM did not return HTML: {html[:200]}")
        em.emit(EV_AGENT_LOG, {
            "agent": "ImplementAnim", "phase": "invalid",
            "input": "", "output": f"got: {html[:200]}",
        })
        return None

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementAnim", "phase": "output",
        "input": "", "output": f"HTML length={len(html)} chars",
    })
    return html


def _strip_codeblock(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text
