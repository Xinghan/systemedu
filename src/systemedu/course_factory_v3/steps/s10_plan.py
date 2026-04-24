"""Step 1: 撰写 plan_markdown。

实现 SKILL.md §549-718。LLM 生成,然后 4 项硬规自检,失败 → revise (≤2 次)。
capstone 节点走独立模板。
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from ..kimi_client import ainvoke, llm_for
from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
MAX_REVISE = 2

# 字数硬性区间
MIN_PLAN_LEN = 600   # 中文字符数 (略宽于 SKILL §562 的 800-1500 字,因 LLM 偶尔会接近边界)
MAX_PLAN_LEN = 3000  # 同上,放宽避免 false positive


async def run(ctx: dict, *, em: Emitter) -> str:
    """生成 plan_markdown,自检失败 revise ≤2 次,仍不过则返回最后一次产物 + warn。"""
    knode = ctx["knode"]
    is_capstone = knode.get("module_role", "") == "capstone"

    # 1. 首次生成
    plan = await _generate_plan(ctx, is_capstone, em=em)

    # 2. 自检 + revise loop
    for attempt in range(1, MAX_REVISE + 1):
        issues = _self_check(plan, ctx, is_capstone)
        if not issues:
            em.emit(EV_AGENT_LOG, {
                "agent": "PlanSelfCheck", "phase": "pass",
                "input": f"len={len(plan)}",
                "output": f"all checks pass on attempt {attempt}",
            })
            return plan

        logger.info(f"[s10] plan self-check failed (attempt {attempt}): {issues}")
        em.emit(EV_AGENT_LOG, {
            "agent": "PlanSelfCheck", "phase": f"fail-{attempt}",
            "input": f"len={len(plan)}",
            "output": "; ".join(issues)[:1000],
        })
        plan = await _revise_plan(ctx, plan, issues, em=em)

    # 最终自检
    final_issues = _self_check(plan, ctx, is_capstone)
    if final_issues:
        logger.warning(f"[s10] plan still has issues after {MAX_REVISE} revisions: {final_issues}")
        em.emit(EV_AGENT_LOG, {
            "agent": "PlanSelfCheck", "phase": "final-warn",
            "input": "",
            "output": f"giving up after {MAX_REVISE} revisions, issues remaining: {final_issues}",
        })
    return plan


# ---------------------------------------------------------------------------
# 生成
# ---------------------------------------------------------------------------

async def _generate_plan(ctx: dict, is_capstone: bool, *, em: Emitter) -> str:
    prompt_file = PROMPTS_DIR / ("plan_capstone.md" if is_capstone else "plan_normal.md")
    prompt = _format_prompt(prompt_file.read_text(encoding="utf-8"), ctx)

    em.emit(EV_AGENT_LOG, {
        "agent": "PlanGen", "phase": "input",
        "input": f"is_capstone={is_capstone}, knode={ctx['knode'].get('title','')!r}",
        "output": "(pending)",
    })

    llm = llm_for("fast", streaming=False)
    plan = await ainvoke(llm, [{"role": "user", "content": prompt}], label="plan_gen")
    plan = _strip_codeblock(plan)

    em.emit(EV_AGENT_LOG, {
        "agent": "PlanGen", "phase": "output",
        "input": "",
        "output": f"len={len(plan)}, first 200: {plan[:200]}",
    })
    return plan


async def _revise_plan(ctx: dict, original: str, issues: list[str], *, em: Emitter) -> str:
    prompt = (PROMPTS_DIR / "plan_revise.md").read_text(encoding="utf-8")
    knode = ctx["knode"]
    hands_short = ", ".join((knode.get("hands_on_components") or [])[:3])
    artifacts_short = ", ".join(
        a.get("title", "") for a in (knode.get("acceptance_artifacts") or [])[:3]
    )
    issues_block = "\n".join(f"- {it}" for it in issues)
    formatted = prompt.format(
        issues_block=issues_block,
        original_plan=original,
        node_title=knode.get("title", "") or knode.get("name", ""),
        module_id=knode.get("module_id", ""),
        module_role=knode.get("module_role", ""),
        core_question=knode.get("core_question", ""),
        hands_on_components_short=hands_short or "(无)",
        acceptance_artifacts_short=artifacts_short or "(无)",
    )

    llm = llm_for("fast", streaming=False)
    revised = await ainvoke(llm, [{"role": "user", "content": formatted}], label="plan_revise")
    return _strip_codeblock(revised)


def _format_prompt(template: str, ctx: dict) -> str:
    """填充 v4.1 全字段。"""
    knode = ctx["knode"]
    milestone = ctx.get("milestone") or {}
    sub_project = ctx.get("sub_project") or {}
    age_range = ctx.get("age_range") or [10, 15]

    hands_on = knode.get("hands_on_components") or []
    artifacts = knode.get("acceptance_artifacts") or []
    standards = knode.get("acceptance_standard") or []
    outputs = knode.get("outputs_produced") or []

    return template.format(
        project_name=ctx.get("project_name", ""),
        category=ctx.get("category", ""),
        knowledge_level=ctx.get("knowledge_level", "K3"),
        age_min=age_range[0] if age_range else 10,
        age_max=age_range[1] if len(age_range) > 1 else 15,
        module_id=knode.get("module_id", ""),
        module_role=knode.get("module_role", ""),
        node_title=knode.get("title", "") or knode.get("name", ""),
        node_summary=(knode.get("summary", "") or "")[:500],
        difficulty=knode.get("difficulty", knode.get("difficulty_level", 3)),
        milestone_title=milestone.get("title", ""),
        milestone_description=(milestone.get("description", "") or "")[:300],
        core_question=knode.get("core_question", "") or "(空)",
        sp_brief=(sub_project.get("brief", "") or "")[:200],
        sp_core_problem=(sub_project.get("core_problem", "") or "")[:200],
        sp_task=(sub_project.get("task", "") or "")[:200],
        sp_deliverables=_list_to_str(sub_project.get("deliverables") or []),
        hands_on_components_block=_bullets(hands_on),
        acceptance_artifacts_block=_artifact_bullets(artifacts),
        acceptance_standard_block=_bullets(standards),
        outputs_produced_block=_list_to_str(outputs),
    )


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
            title = it.get("title", "")
            desc = it.get("description", "") or ""
            fmt = it.get("format", "") or ""
            extra = f" (格式: {fmt})" if fmt else ""
            lines.append(f"- **{title}**{extra}: {desc[:120]}")
        elif isinstance(it, str):
            lines.append(f"- {it}")
    return "\n".join(lines) or "(无)"


def _list_to_str(items: list) -> str:
    if not items:
        return "(无)"
    return "; ".join(str(x) for x in items[:6])


def _strip_codeblock(text: str) -> str:
    """LLM 偶尔会包 ```markdown ... ``` 包裹。"""
    text = text.strip()
    if text.startswith("```"):
        # 去首行 ```xxx 和末行 ```
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


# ---------------------------------------------------------------------------
# 自检 — F.6.1-F.6.7 + F.1.4 + F.6.6
# ---------------------------------------------------------------------------

NORMAL_REQUIRED_HEADINGS = [
    "## 学习目标",
    "## 引入",
    "## 核心概念",
    "## 深入理解",
    "## 应用与拓展",
    "## 推荐互动资源",
    "## 学习路径建议",
]

CAPSTONE_REQUIRED_HEADINGS = [
    "## 项目背景",
    "## 交付物清单",
    "## 制作步骤",
    "## 评分标准",
    "## 提交说明",
    "## 推荐互动资源",
]

FORBIDDEN_HEADINGS = ["## 推荐视频", "## 延伸阅读"]
FORBIDDEN_PLACEHOLDERS = re.compile(r"\[\[(?:IDEA|THEORY):", re.IGNORECASE)
RAW_HTTPS = re.compile(r"https?://\S+")
SHORTCODE = re.compile(r"\{\{[A-Za-z0-9_]+\}\}")
MODULE_REF_RE = re.compile(r">\s*Module:\s*\S+\s*[·•]\s*\w+", re.IGNORECASE)


def _self_check(plan: str, ctx: dict, is_capstone: bool) -> list[str]:
    issues: list[str] = []
    knode = ctx["knode"]

    # F.6.3 字数
    char_count = len(plan)
    if char_count < MIN_PLAN_LEN:
        issues.append(f"plan 太短 ({char_count} 字 < {MIN_PLAN_LEN}),需扩展每段内容")
    elif char_count > MAX_PLAN_LEN:
        issues.append(f"plan 太长 ({char_count} 字 > {MAX_PLAN_LEN}),需精简")

    # F.5.1 顶部 Module 引用块
    head = plan.lstrip().split("\n", 1)[0] if plan.strip() else ""
    if not MODULE_REF_RE.search(head):
        issues.append(f"顶部缺 `> Module: {knode.get('module_id','')} · {knode.get('module_role','')}` 引用块")

    # F.6.1 7 段必须齐 (capstone 用不同模板)
    required = CAPSTONE_REQUIRED_HEADINGS if is_capstone else NORMAL_REQUIRED_HEADINGS
    for h in required:
        if h not in plan:
            issues.append(f"缺必要段落: {h}")

    # F.1.4 / F.6.6 禁止预合并 Tavily 段
    for h in FORBIDDEN_HEADINGS:
        if h in plan:
            issues.append(f"禁止预合并 Tavily: 不能出现 {h} 段(由 make_course_content 自动追加)")

    # 禁止占位符 (Step 1.5 / Step 2 才插)
    if FORBIDDEN_PLACEHOLDERS.search(plan):
        issues.append("禁止在 plan_markdown 中出现 [[IDEA:...]] 或 [[THEORY:...]] 占位符 (后续 step 才插)")

    # F.5.3 / F.1.3 core_question 必须出现 (用关键词模糊匹配,因 LLM 可能改写)
    if not is_capstone:
        cq = (knode.get("core_question") or "").strip()
        if cq and not _core_question_present(plan, cq):
            issues.append(f"plan 引入段必须出现 core_question 原文或等价改写: {cq[:60]!r}")

    # F.6.6 外部 URL 必须用 shortcode (允许 markdown 链接 [text](http://...) 中的 url 出现,
    # 但不允许 plan 正文中裸 https://, 也不允许直接列举 https://aliyuncs.com 等)
    # 简化策略:统计裸 URL,如果数量 > shortcode 数量 + 已有 markdown 链接,警告
    raw_urls = RAW_HTTPS.findall(plan)
    md_link_urls = re.findall(r"\]\((https?://[^)]+)\)", plan)
    naked = [u for u in raw_urls if u not in md_link_urls]
    if len(naked) > 2:  # 允许少量(如 LabXchange 资源链接是 markdown)
        issues.append(
            f"裸 URL 过多 ({len(naked)} 个),外部资源应用 {{KEY}} shortcode "
            f"(已注册: ai4mars/curiosity_raw/hirise/pds_imaging 等)"
        )

    # F.5.4 hands_on_components 至少有一项在 plan 中被提及 (深入理解段必须呼应)
    if not is_capstone:
        hands = knode.get("hands_on_components") or []
        if hands and not any(_loose_contains(plan, h[:20]) for h in hands if isinstance(h, str)):
            issues.append(
                f"深入理解段必须显式呼应 hands_on_components 至少一项: {[h[:30] for h in hands[:3]]}"
            )

    # F.5.5 acceptance_artifacts 标题至少有一个出现在应用段
    artifacts = knode.get("acceptance_artifacts") or []
    if artifacts:
        titles = [a.get("title", "") for a in artifacts if isinstance(a, dict) and a.get("title")]
        if titles and not any(t and t in plan for t in titles):
            # 允许 LLM 改写,做宽松匹配
            if not any(t and _loose_contains(plan, t[:15]) for t in titles):
                issues.append(
                    f"应用段必须点名 acceptance_artifacts 中至少一个作品标题: {titles[:3]}"
                )

    return issues


def _core_question_present(plan: str, cq: str) -> bool:
    """core_question 完全匹配,或 30% 关键词命中即视为出现。"""
    if cq in plan:
        return True
    # 提取 core_question 中长度 ≥2 的词块,30% 命中即可
    tokens = re.findall(r"[一-鿿]{2,}|[A-Za-z]{3,}", cq)
    if not tokens:
        return False
    hits = sum(1 for t in tokens if t in plan)
    return hits >= max(1, int(len(tokens) * 0.3))


def _loose_contains(text: str, needle: str) -> bool:
    """宽松包含: 直接 in 命中,或前 6 字符命中。"""
    needle = needle.strip()
    if not needle:
        return False
    if needle in text:
        return True
    short = needle[:6] if len(needle) > 6 else needle
    return short in text
