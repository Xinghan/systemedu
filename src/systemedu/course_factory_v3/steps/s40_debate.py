"""Step 4: Debate 决策 (approve / reject / revise)。

实现 SKILL.md §1357-1391。给所有 ideas 喂给 LLM 一次,得到每条 decision。
- decision=reject → 该 idea 不参与 Step 5 实现
- decision=revise → 该 idea 的 detail_plan 用 revise_hint 修改后再做 (本 step 简化:
  把 revise_hint 注入 idea, Step 5 实现时会读到)
- decision=approve → 直接进 Step 5
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


async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    ideas = ctx.get("ideas") or []
    if not ideas:
        return ideas

    knode = ctx["knode"]
    hands_short = ", ".join((knode.get("hands_on_components") or [])[:3]) or "(无)"
    artifacts_short = ", ".join(
        a.get("title", "") for a in (knode.get("acceptance_artifacts") or [])[:3]
    ) or "(无)"

    # 给 LLM 喂的 ideas 摘要(节省 token)
    ideas_for_prompt = [{
        "idea_id": i.get("idea_id"),
        "mode": i.get("mode"),
        "topic": i.get("topic"),
        "context_summary": i.get("context_summary"),
        "mode_reason": i.get("mode_reason"),
        "hands_on_ref": i.get("hands_on_ref"),
        "acceptance_ref": i.get("acceptance_ref"),
        "detail_plan_summary": _summarize_detail(i.get("detail_plan") or {}),
    } for i in ideas]

    prompt = (PROMPTS_DIR / "debate_decide.md").read_text(encoding="utf-8").format(
        ideas_json=json.dumps(ideas_for_prompt, ensure_ascii=False, indent=2)[:6000],
        core_question=knode.get("core_question", ""),
        hands_on_components_short=hands_short,
        acceptance_artifacts_short=artifacts_short,
        module_role=knode.get("module_role", ""),
    )

    em.emit(EV_AGENT_LOG, {
        "agent": "Debate", "phase": "input",
        "input": f"ideas_count={len(ideas)}",
        "output": "(pending)",
    })

    llm = llm_for("fast", streaming=False, max_tokens=4096)
    try:
        response = await ainvoke(llm, [{"role": "user", "content": prompt}], label="debate")
    except Exception as exc:
        logger.exception(f"[s40] LLM failed: {exc}")
        # 失败时全部 approve, 不阻塞
        for idea in ideas:
            idea.setdefault("decision", "approve")
        return ideas

    data = _parse_json(response)
    decisions = (data or {}).get("decisions") if isinstance(data, dict) else None
    if not isinstance(decisions, list):
        logger.warning(f"[s40] decisions not list: {response[:200]}")
        for idea in ideas:
            idea.setdefault("decision", "approve")
        return ideas

    # 合并到 ideas
    by_id = {d.get("idea_id"): d for d in decisions if isinstance(d, dict)}
    for idea in ideas:
        d = by_id.get(idea.get("idea_id"))
        if d:
            idea["decision"] = d.get("decision", "approve")
            idea["decision_reason"] = d.get("reason", "")
            if d.get("revise_hint"):
                idea["revise_hint"] = d["revise_hint"]
        else:
            idea["decision"] = "approve"  # LLM 漏了就默认 approve

    approved = sum(1 for i in ideas if i.get("decision") == "approve")
    rejected = sum(1 for i in ideas if i.get("decision") == "reject")
    revised = sum(1 for i in ideas if i.get("decision") == "revise")
    em.emit(EV_AGENT_LOG, {
        "agent": "Debate", "phase": "output",
        "input": "",
        "output": f"approve={approved}, reject={rejected}, revise={revised}",
    })
    return ideas


def _summarize_detail(d: dict) -> dict:
    """把 detail_plan 摘要,只留关键字段省 token。"""
    if not d:
        return {}
    keep = {}
    for k in ("title", "game_title", "game_concept", "game_mechanic",
              "frame_count", "exercise_count", "win_condition",
              "scene_description", "animation_type"):
        if k in d:
            keep[k] = d[k]
    return keep


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
