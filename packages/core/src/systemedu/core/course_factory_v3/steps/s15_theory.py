"""Step 1.5: 标注基础理论 theories + 在 plan_markdown 中插入 [[THEORY:xxx]] 占位符。

实现 SKILL.md §722-949。
- 1.5a: LLM 选 2-5 个 theory_id (capstone 节点跳过)
- 1.5b: 并行为每个 theory 生成 level_bodies + exercises (LLM)
- 占位符插入: 在 related_paragraph 对应段落末尾插 [[THEORY:xxx]]
- 副作用: 修改 ctx["plan_markdown"] (插完占位符)

注意 theory_tags 归一化由 factory.make_course_content 在 Step 6 自动跑,
本 step 只生成原始 tags 列表。
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


async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    """生成 theories 列表。capstone 节点直接返回 []。

    副作用: 修改 ctx["plan_markdown"],插入 [[THEORY:xxx]] 占位符。
    """
    knode = ctx["knode"]
    if knode.get("module_role") == "capstone":
        em.emit(EV_AGENT_LOG, {
            "agent": "TheoryPick", "phase": "skip",
            "input": "module_role=capstone",
            "output": "capstone 节点不引入新理论, theories=[]",
        })
        return []

    plan_markdown = ctx.get("plan_markdown", "")
    if not plan_markdown:
        logger.warning("[s15] plan_markdown empty, theories=[]")
        return []

    # 1.5a: 选 theory
    picks = await _pick_theories(ctx, plan_markdown, em=em)
    if not picks:
        em.emit(EV_AGENT_LOG, {
            "agent": "TheoryPick", "phase": "empty",
            "input": "", "output": "LLM returned 0 theories (可能纯方法论节点)",
        })
        return []

    # 1.5b: 并行写每个 theory 的 body
    em.emit(EV_AGENT_LOG, {
        "agent": "TheoryBody", "phase": "input",
        "input": f"picks={[p['theory_id'] for p in picks]}",
        "output": f"(generating {len(picks)} theories in parallel)",
    })
    theories = await asyncio.gather(*[_write_theory_body(p, ctx, em=em) for p in picks])
    theories = [t for t in theories if t]  # 去掉失败的

    # 占位符插入
    new_plan = _insert_placeholders(plan_markdown, theories)
    ctx["plan_markdown"] = new_plan

    em.emit(EV_AGENT_LOG, {
        "agent": "TheoryDone", "phase": "output",
        "input": "",
        "output": f"theories={len(theories)}, plan length: {len(plan_markdown)} → {len(new_plan)}",
    })
    return theories


# ---------------------------------------------------------------------------
# 1.5a — pick
# ---------------------------------------------------------------------------

async def _pick_theories(ctx: dict, plan_markdown: str, *, em: Emitter) -> list[dict]:
    knode = ctx["knode"]
    prompt = (PROMPTS_DIR / "theory_pick.md").read_text(encoding="utf-8").format(
        project_name=ctx.get("project_name", ""),
        category=ctx.get("category", ""),
        node_title=knode.get("title", "") or knode.get("name", ""),
        module_role=knode.get("module_role", ""),
        knowledge_level=ctx.get("knowledge_level", "K3"),
        core_question=knode.get("core_question", "") or "(空)",
        plan_markdown=plan_markdown[:5000],  # 截断防 prompt 太长
    )

    llm = llm_for("fast", streaming=False)
    response = await ainvoke(llm, [{"role": "user", "content": prompt}], label="theory_pick")
    data = _parse_json(response)
    if not isinstance(data, dict):
        logger.warning(f"[s15] theory_pick returned non-dict: {response[:200]}")
        return []

    raw_theories = data.get("theories", [])
    if not isinstance(raw_theories, list):
        return []

    # 验证 + 清洗
    cleaned: list[dict] = []
    for t in raw_theories:
        if not isinstance(t, dict):
            continue
        if not t.get("theory_id") or not t.get("title") or not t.get("subject"):
            continue
        cleaned.append({
            "theory_id": str(t["theory_id"]),
            "title": str(t["title"]),
            "subject": str(t["subject"]),
            "tags": t.get("tags") or [],
            "related_paragraph": str(t.get("related_paragraph") or ""),
        })

    return cleaned[:5]  # 硬上限 5


# ---------------------------------------------------------------------------
# 1.5b — write body for one theory
# ---------------------------------------------------------------------------

async def _write_theory_body(pick: dict, ctx: dict, *, em: Emitter) -> dict | None:
    knode = ctx["knode"]
    prompt = (PROMPTS_DIR / "theory_body.md").read_text(encoding="utf-8").format(
        theory_id=pick["theory_id"],
        title=pick["title"],
        subject=pick["subject"],
        tags_json=json.dumps(pick["tags"], ensure_ascii=False),
        related_paragraph=pick.get("related_paragraph", ""),
        project_name=ctx.get("project_name", ""),
        node_title=knode.get("title", "") or knode.get("name", ""),
        knowledge_level=ctx.get("knowledge_level", "K3"),
    )

    llm = llm_for("fast", streaming=False)
    try:
        response = await ainvoke(llm, [{"role": "user", "content": prompt}], label=f"theory_body[{pick['theory_id']}]")
        data = _parse_json(response)
    except Exception as exc:
        logger.exception(f"[s15] theory body failed for {pick['theory_id']}")
        em.emit(EV_AGENT_LOG, {
            "agent": "TheoryBody", "phase": f"fail[{pick['theory_id']}]",
            "input": "", "output": f"ERROR: {exc}",
        })
        return None

    if not isinstance(data, dict):
        logger.warning(f"[s15] theory body for {pick['theory_id']}: not a dict")
        return None

    # 字段验证
    body = data.get("body_markdown") or ""
    level_bodies = data.get("level_bodies") or []
    exercises = data.get("exercises") or []
    if not body or not level_bodies:
        logger.warning(f"[s15] theory body for {pick['theory_id']}: missing body or level_bodies")
        return None

    # 等级过滤兜底: 即使 LLM 违规生成 > 节点等级, 也强制裁剪掉
    target_level = ctx.get("knowledge_level", "K3")
    level_bodies = _clamp_levels(level_bodies, target_level)

    # 确保 K1 在 level_bodies 中 (clamp 后再验证)
    levels = [lb.get("level") for lb in level_bodies if isinstance(lb, dict)]
    if "K1" not in levels:
        logger.warning(f"[s15] theory {pick['theory_id']} missing K1 level_body after clamp")
        return None

    # 标准化输出
    return {
        "theory_id": pick["theory_id"],
        "title": pick["title"],
        "subject": pick["subject"],
        "tags": pick.get("tags") or [],
        "related_paragraph": pick.get("related_paragraph", ""),
        "body_markdown": body,
        "level_bodies": level_bodies,
        "exercises": _validate_exercises(exercises),
    }


def _clamp_levels(level_bodies: list, target_level: str) -> list:
    """裁剪 level_bodies 只保留 ≤ target_level 的等级。

    LLM 违规生成 K5 但节点是 K1 时, 强制丢掉超出等级。
    K1 永远保留。
    """
    def _level_num(lv) -> int:
        if not isinstance(lv, str) or not lv.startswith("K") or not lv[1:].isdigit():
            return 99
        return int(lv[1:])

    target_n = _level_num(target_level)
    out = []
    for lb in level_bodies:
        if not isinstance(lb, dict):
            continue
        n = _level_num(lb.get("level"))
        if n <= target_n:
            out.append(lb)
        else:
            logger.warning(f"[s15] dropped over-level body {lb.get('level')} > {target_level}")
    return out


def _validate_exercises(raw: list) -> list[dict]:
    out: list[dict] = []
    for ex in raw:
        if not isinstance(ex, dict):
            continue
        q = ex.get("question") or ""
        opts = ex.get("options") or []
        correct = ex.get("correct")
        expl = ex.get("explanation") or ""
        if not q or not isinstance(opts, list) or len(opts) != 4 or not isinstance(correct, int):
            continue
        if correct < 0 or correct > 3:
            continue
        out.append({
            "question": str(q),
            "type": "choice",
            "options": [str(o) for o in opts],
            "correct": correct,
            "explanation": str(expl),
        })
    return out[:3]  # 硬上限 3


# ---------------------------------------------------------------------------
# 占位符插入 — F.8.14
# ---------------------------------------------------------------------------

def _insert_placeholders(plan_markdown: str, theories: list[dict]) -> str:
    """在每个 theory 的 related_paragraph 对应段落末尾插 [[THEORY:xxx]]。

    SKILL §943-948 / F.8.14: 第一次出现相关概念的段落末尾,不重复。
    """
    if not theories:
        return plan_markdown

    lines = plan_markdown.split("\n")
    inserted_ids: set[str] = set()

    for theory in theories:
        tid = theory["theory_id"]
        if tid in inserted_ids:
            continue
        related = (theory.get("related_paragraph") or "").strip()
        target_idx = _find_section_end_idx(lines, related, theory["title"])
        if target_idx is None:
            # fallback: 找下一个空段落,或追加到 plan 末尾前
            target_idx = _find_first_section_after_heading(lines, "## 核心概念")
        if target_idx is None:
            # 仍未找到: 加到 ## 应用与拓展 之前
            target_idx = _find_index_of_heading(lines, "## 应用与拓展")
        if target_idx is None:
            # 实在不行, 插到 plan 末尾
            target_idx = len(lines)

        lines.insert(target_idx, f"[[THEORY:{tid}]]")
        inserted_ids.add(tid)
        # 后续插入的 idx 仍然找 next section 重新算,所以不需要 +1 调整

    return "\n".join(lines)


def _find_section_end_idx(lines: list[str], related: str, title: str) -> int | None:
    """找 related_paragraph 对应段落的结尾位置(下一段开始前的空行处)。"""
    if not related and not title:
        return None
    needles = [n for n in [related, title] if n]
    section_start = None
    for i, line in enumerate(lines):
        for needle in needles:
            if needle and (needle in line or line.strip().endswith(needle)):
                section_start = i
                break
        if section_start is not None:
            break
    if section_start is None:
        return None
    # 从 section_start+1 找下一个 ## 或 ### 标题,在它之前插入
    for j in range(section_start + 1, len(lines)):
        s = lines[j].lstrip()
        if s.startswith("##"):
            return j  # 在下一段开头之前
    return len(lines)


def _find_first_section_after_heading(lines: list[str], heading_prefix: str) -> int | None:
    for i, line in enumerate(lines):
        if line.lstrip().startswith(heading_prefix):
            for j in range(i + 1, len(lines)):
                if lines[j].lstrip().startswith("##"):
                    return j
            return len(lines)
    return None


def _find_index_of_heading(lines: list[str], heading: str) -> int | None:
    for i, line in enumerate(lines):
        if line.lstrip().startswith(heading):
            return i
    return None


# ---------------------------------------------------------------------------
# JSON 解析
# ---------------------------------------------------------------------------

_JSON_OBJ_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json(response: str):
    """宽松 JSON 解析: 支持 ```json...``` 包裹、尾随文本。"""
    if not response:
        return None
    s = response.strip()
    # 剥离 ```json ... ``` 或 ``` ... ```
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
        # 尝试找最外层 {...}
        m = _JSON_OBJ_RE.search(s)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return None
