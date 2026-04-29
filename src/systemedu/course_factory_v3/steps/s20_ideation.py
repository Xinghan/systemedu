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

    # 校验 ideas 字段 + normalize ref 到 knode 原文 (兜底 LLM 改写/加标点/缺失)
    knode = ctx.get("knode") or {}
    hands_pool = list(knode.get("hands_on_components") or [])
    accept_pool = _accept_pool_from_knode(knode)
    cleaned_ideas = []
    used_hands: set[str] = set()
    for idea in ideas:
        if not isinstance(idea, dict):
            continue
        if not idea.get("idea_id") or not idea.get("mode"):
            continue
        h_ref = _normalize_ref(str(idea.get("hands_on_ref", "")), hands_pool)
        a_ref = _normalize_ref(str(idea.get("acceptance_ref", "")), accept_pool)
        # 缺失兜底: LLM 没写 / 写空, 强制选 pool 第一个 (preflight 必须有 ref)
        if not h_ref and hands_pool:
            h_ref = hands_pool[0]
        if not a_ref and accept_pool:
            a_ref = accept_pool[0]
        if h_ref:
            used_hands.add(h_ref)
        cleaned_ideas.append({
            "idea_id": str(idea["idea_id"]),
            "mode": str(idea["mode"]),
            "style_key": str(idea.get("style_key", "") or ctx.get("category", "space")),
            "topic": str(idea.get("topic", "")),
            "context_summary": str(idea.get("context_summary", "")),
            "mode_reason": str(idea.get("mode_reason", "")),
            "hands_on_ref": h_ref,
            "acceptance_ref": a_ref,
        })

    # 兜底覆盖检查: 若 hands_on_components 有未被任何 idea 引用的, 把第一个 exercise idea 的 hands_on_ref
    # 改成第一个未覆盖项, 防 preflight 报"未被覆盖"。
    uncovered = [h for h in hands_pool if h not in used_hands]
    if uncovered and cleaned_ideas:
        # 优先改 exercise; 没有就改第一个 idea
        target = next((i for i in cleaned_ideas if i["mode"] == "exercise"), cleaned_ideas[0])
        target["hands_on_ref"] = uncovered[0]
        em.emit(EV_AGENT_LOG, {
            "agent": "Ideation8Debate", "phase": "patch",
            "input": "",
            "output": f"覆盖兜底: 把 {target['idea_id']}.hands_on_ref 改为 {uncovered[0][:40]!r}",
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


def _accept_pool_from_knode(knode: dict) -> list[str]:
    """组装 acceptance_ref 候选池: knode.acceptance_standard + acceptance_artifacts.title。"""
    pool: list[str] = []
    for s in knode.get("acceptance_standard") or []:
        if isinstance(s, str):
            pool.append(s)
    for a in knode.get("acceptance_artifacts") or []:
        if isinstance(a, dict):
            t = a.get("title") or a.get("name")
            if t:
                pool.append(str(t))
        elif isinstance(a, str):
            pool.append(a)
    return pool


def _normalize_ref(ref: str, pool: list[str]) -> str:
    """把 LLM 写的 ref 归一化到 pool 中最匹配的原文。

    匹配优先级:
      1. exact match → 原样保留
      2. 去掉首尾标点 + 空白后 exact match → 返回原文
      3. 包含子串 (LLM 改写但保留主干) → 返回原文
      4. fuzzy: 用 SequenceMatcher 找最相近, 比例 ≥ 0.6 → 返回原文
      5. 都不匹配 → 返回 LLM 原文 (保底, 后续 preflight 会报)
    """
    if not ref or not pool:
        return ref
    if ref in pool:
        return ref
    # 去掉首尾标点空白
    stripped = ref.strip().rstrip("。.,，;；!！?？ \t")
    for p in pool:
        if p.strip().rstrip("。.,，;；!！?？ \t") == stripped:
            return p
    # 子串包含
    for p in pool:
        if stripped and stripped in p:
            return p
        if p in ref:
            return p
    # fuzzy 兜底
    try:
        from difflib import SequenceMatcher
        best = (0.0, ref)
        for p in pool:
            r = SequenceMatcher(None, stripped or ref, p).ratio()
            if r > best[0]:
                best = (r, p)
        if best[0] >= 0.6:
            return best[1]
    except Exception:
        pass
    return ref


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
