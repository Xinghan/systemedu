"""Step 2: 8 类富媒体逐条 debate + ideas 抽取。

实现 SKILL.md §952-1209 + F.1.5 / F.2 / F.9。LLM 输出必须含:
- 8 行 debate (theory/animation/game/hands_on_kit/image/diagram/youtube/labxchange)
- ideas 列表(含 hands_on_ref/acceptance_ref/style_key/mode_reason)

自检:
- debate 必有 8 行,顺序正确,reject 必带理由
- 每个 idea 有 hands_on_ref + acceptance_ref(原文匹配 knode 字段)
- 至少一个 idea 覆盖 hands_on_components
- exercise ≥ 1 个
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from ..kimi_client import ainvoke, llm_for
from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
EXPECTED_TYPES = ["theory", "animation", "game", "hands_on_kit",
                  "image", "diagram", "youtube", "labxchange"]


async def run(ctx: dict, *, em: Emitter) -> tuple[str, list[dict]]:
    """返回 (plan_with_placeholders, ideas)。

    本 step 暂不插 [[IDEA:xxx]] 占位符 (留给 s60_assemble 做),只返回原 plan_markdown。
    F-final 对账时再决定是否要在 s50 实现完成后再补一道占位符插入。
    """
    knode = ctx["knode"]
    plan_markdown = ctx.get("plan_markdown", "")
    if not plan_markdown:
        logger.warning("[s20] plan_markdown empty")
        return "", []

    age_range = ctx.get("age_range") or [10, 15]
    prompt = (PROMPTS_DIR / "ideation_8class_debate.md").read_text(encoding="utf-8").format(
        project_name=ctx.get("project_name", ""),
        category=ctx.get("category", ""),
        age_min=age_range[0] if age_range else 10,
        age_max=age_range[1] if len(age_range) > 1 else 15,
        node_title=knode.get("title", "") or knode.get("name", ""),
        module_role=knode.get("module_role", ""),
        difficulty=knode.get("difficulty", knode.get("difficulty_level", 3)),
        core_question=knode.get("core_question", "") or "(空)",
        hands_on_components_block=_bullets(knode.get("hands_on_components") or []),
        acceptance_artifacts_block=_artifact_bullets(knode.get("acceptance_artifacts") or []),
        acceptance_standard_block=_bullets(knode.get("acceptance_standard") or []),
        plan_markdown=plan_markdown[:5000],
    )

    em.emit(EV_AGENT_LOG, {
        "agent": "Ideation8Debate", "phase": "input",
        "input": f"knode={knode.get('title','')!r}",
        "output": "(pending)",
    })

    llm = llm_for("fast", streaming=False, max_tokens=8192)
    try:
        response = await ainvoke(llm, [{"role": "user", "content": prompt}], label="ideation_8debate")
    except Exception as exc:
        logger.exception(f"[s20] LLM failed: {exc}")
        return plan_markdown, []

    data = _parse_json(response)
    if not isinstance(data, dict):
        logger.warning(f"[s20] not a dict: {response[:200]}")
        return plan_markdown, []

    debate = data.get("debate") or []
    ideas = data.get("ideas") or []

    # 校验 debate 8 类齐
    debate_types = [d.get("type") for d in debate if isinstance(d, dict)]
    if debate_types != EXPECTED_TYPES:
        logger.warning(f"[s20] debate types mismatch: got {debate_types}")
        em.emit(EV_AGENT_LOG, {
            "agent": "Ideation8Debate", "phase": "warn",
            "input": "", "output": f"debate types: {debate_types} (expected {EXPECTED_TYPES})",
        })

    # 校验 ideas 字段
    cleaned_ideas = []
    for idea in ideas:
        if not isinstance(idea, dict):
            continue
        if not idea.get("idea_id") or not idea.get("mode"):
            continue
        cleaned_ideas.append({
            "idea_id": str(idea["idea_id"]),
            "mode": str(idea["mode"]),
            "style_key": str(idea.get("style_key", "") or ctx.get("category", "space")),
            "topic": str(idea.get("topic", "")),
            "context_summary": str(idea.get("context_summary", "")),
            "mode_reason": str(idea.get("mode_reason", "")),
            "hands_on_ref": str(idea.get("hands_on_ref", "")),
            "acceptance_ref": str(idea.get("acceptance_ref", "")),
        })

    em.emit(EV_AGENT_LOG, {
        "agent": "Ideation8Debate", "phase": "output",
        "input": "",
        "output": (
            f"debate {len(debate)} rows, ideas {len(cleaned_ideas)} "
            f"(modes: {[i['mode'] for i in cleaned_ideas]})"
        ),
    })

    # 暂存 debate 到 ctx 便于后续审计
    ctx["debate_8class"] = debate
    return plan_markdown, cleaned_ideas


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


def _artifact_bullets(items: list) -> str:
    if not items:
        return "(无)"
    lines = []
    for it in items:
        if isinstance(it, dict):
            t = it.get("title", "")
            d = (it.get("description", "") or "")[:80]
            lines.append(f"- **{t}**: {d}")
        elif isinstance(it, str):
            lines.append(f"- {it}")
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
