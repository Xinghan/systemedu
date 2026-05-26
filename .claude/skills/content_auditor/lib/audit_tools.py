"""content_auditor — core audit tools.

D3 (proportionality) is computed mechanically here.
D1/D2/D4 use these tools to collect data, then sub-agents do qualitative judgment.

Usage:
    from audit_tools import load_project_corpus, proportionality_report
    corpus = load_project_corpus("eeg-minecraft-bci")
    report = proportionality_report(corpus, tree, complexity_plan_path)
"""

from __future__ import annotations

import json
import re
import statistics
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

WORKSPACE = Path("/Users/xinghan/Dev/systemedu/content-workspace/generated")
REVIEW = Path("/Users/xinghan/Dev/systemedu/content-workspace/_review")


# ============================================================
# Data loading
# ============================================================


@dataclass
class KnodeCorpus:
    """All metrics for one knode."""

    module_id: str
    stage_id: str
    title: str
    sequence_order: int

    # raw sizes (UTF-8 byte counts approximate Chinese ~3 bytes/char)
    plan_chars: int = 0
    theories_chars: int = 0
    sections_chars: int = 0
    slides_chars: int = 0
    assignment_chars: int = 0
    audio_chars: int = 0
    anim_chars: int = 0
    game_chars: int = 0

    # theory breakdown
    n_theories: int = 0
    k1_chars_total: int = 0
    k3_chars_total: int = 0
    n_exercises: int = 0

    # tree metadata (best-effort from tree.json)
    mission_role: Optional[str] = None  # foundation/core/deepening/synthesis/capstone
    knowledge_level: Optional[str] = None  # K1/K3
    is_wow_moment: bool = False
    rough_topics: list[str] = field(default_factory=list)
    hands_on: list[str] = field(default_factory=list)
    depends_on: list[str] = field(default_factory=list)

    # generation_guide (if tree had it — preferred source of truth)
    # see course_factory/GENERATION_GUIDE.md
    generation_guide: Optional[dict] = None

    # totals
    @property
    def total_chars(self) -> int:
        return (
            self.plan_chars
            + self.theories_chars
            + self.assignment_chars
            + self.audio_chars
            + self.anim_chars
            + self.game_chars
            + self.slides_chars
        )

    @property
    def textual_chars(self) -> int:
        """Chars that count as 'pedagogical text' (no HTML/JS noise)."""
        return self.plan_chars + self.assignment_chars + self.k3_chars_total + self.k1_chars_total


def _count_chars(p: Path) -> int:
    if not p.exists():
        return 0
    try:
        return len(p.read_text(encoding="utf-8"))
    except Exception:
        return 0


def _theory_breakdown(theories_path: Path) -> tuple[int, int, int, int]:
    """Return (n_theories, k1_chars_total, k3_chars_total, n_exercises)."""
    if not theories_path.exists():
        return (0, 0, 0, 0)
    try:
        data = json.loads(theories_path.read_text(encoding="utf-8"))
    except Exception:
        return (0, 0, 0, 0)
    if not isinstance(data, list):
        return (0, 0, 0, 0)
    k1_total = 0
    k3_total = 0
    exercises = 0
    for t in data:
        for lb in t.get("level_bodies", []) or []:
            level = (lb.get("level") or "").upper()
            body = lb.get("body_markdown") or ""
            if level == "K1":
                k1_total += len(body)
            elif level == "K3":
                k3_total += len(body)
        exercises += len(t.get("exercises", []) or [])
    return (len(data), k1_total, k3_total, exercises)


def _find_media(media_dir: Path, kind: str) -> int:
    """Find first media file matching `kind` (animation/game) and return size."""
    if not media_dir.exists():
        return 0
    pat = re.compile(rf"^{kind}-.*\.html$", re.IGNORECASE)
    for f in sorted(media_dir.iterdir()):
        if pat.match(f.name):
            return _count_chars(f)
    return 0


def load_project_corpus(slug: str) -> dict[str, KnodeCorpus]:
    """Load all knodes' metrics + tree metadata.

    Returns dict { 'M01': KnodeCorpus, ... }
    """
    proj = WORKSPACE / slug
    if not proj.exists():
        raise FileNotFoundError(f"project not found: {proj}")

    # Load tree for metadata
    tree_path = proj / "tree" / "knowledge_tree.json"
    tree_modules: dict[str, dict] = {}
    if tree_path.exists():
        tree = json.loads(tree_path.read_text(encoding="utf-8"))
        for m in tree.get("modules", []):
            tree_modules[m["module_id"]] = m

    out: dict[str, KnodeCorpus] = {}
    knodes_dir = proj / "knodes"
    if not knodes_dir.exists():
        return out

    for d in sorted(knodes_dir.iterdir()):
        if not d.is_dir():
            continue
        # module_id is "Mxx" prefix
        m = re.match(r"^(M\d+)-", d.name)
        if not m:
            continue
        mid = m.group(1)

        tree_meta = tree_modules.get(mid, {})
        title = tree_meta.get("title", "(no title)")
        stage_id = tree_meta.get("stage_id", "?")
        seq = tree_meta.get("sequence_order", 0)

        n_th, k1, k3, n_ex = _theory_breakdown(d / "theories.json")

        kc = KnodeCorpus(
            module_id=mid,
            stage_id=stage_id,
            title=title,
            sequence_order=seq,
            plan_chars=_count_chars(d / "lesson.md"),
            theories_chars=_count_chars(d / "theories.json"),
            sections_chars=_count_chars(d / "sections.json"),
            slides_chars=_count_chars(d / "slides.json"),
            assignment_chars=_count_chars(d / "assignment.md"),
            audio_chars=_count_chars(d / "audio_scripts.json"),
            anim_chars=_find_media(d / "media", "animation"),
            game_chars=_find_media(d / "media", "game"),
            n_theories=n_th,
            k1_chars_total=k1,
            k3_chars_total=k3,
            n_exercises=n_ex,
            mission_role=tree_meta.get("mission_role"),
            knowledge_level=tree_meta.get("knowledge_level"),
            is_wow_moment=_detect_wow_moment(tree_meta),
            rough_topics=tree_meta.get("rough_learning_topics", []) or [],
            hands_on=tree_meta.get("hands_on_components", []) or [],
            depends_on=tree_meta.get("depends_on", []) or [],
            generation_guide=tree_meta.get("generation_guide"),
        )
        out[mid] = kc
    return out


def _detect_wow_moment(tree_meta: dict) -> bool:
    """Heuristic: title/summary contains '哇' / 'wow' / 'capstone' / '★'."""
    hay = " ".join(
        [
            tree_meta.get("title", ""),
            tree_meta.get("summary", ""),
            str(tree_meta.get("why_non_skippable", "")),
        ]
    ).lower()
    return any(k in hay for k in ["哇", "wow", "capstone", "★", "里程碑", "ship"])


# ============================================================
# Role classification (rule-based)
# ============================================================


def classify_node_role(kc: KnodeCorpus) -> str:
    """Classify node into one of:
    - wow_capstone: 哇时刻或阶段 capstone (最重)
    - core_synthesis: synthesis 节点 (重)
    - core_concept: 引入硬知识的核心节点 (重)
    - hands_on: 实战节点 (中)
    - foundation: 基础铺垫 (轻)
    - transitional: 过渡节点 (最轻)
    """
    if kc.is_wow_moment:
        return "wow_capstone"
    if kc.mission_role:
        role = kc.mission_role.lower()
        if "capstone" in role or "synthesis" in role:
            return "core_synthesis"
        if "core" in role or "deepening" in role:
            return "core_concept"
        if "foundation" in role:
            return "foundation"
    # heuristic by topics
    topics = " ".join(kc.rough_topics).lower()
    if any(k in topics for k in ["实战", "实采", "训练", "实测", "校准"]):
        return "hands_on"
    if any(k in topics for k in ["原理", "概念", "理论"]):
        return "core_concept"
    return "transitional"


# ============================================================
# Expected size model (the heart of D3)
# ============================================================

# Calibration: target chars per role
# Based on 'a serious knode of this role should have at least this much'
EXPECTED = {
    "wow_capstone": {
        "plan": 1800,
        "theory_k1": 1500,
        "theory_k3": 1200,
        "assignment": 800,
        "anim": 18000,
        "game": 15000,
        "exercises_min": 4,
    },
    "core_synthesis": {
        "plan": 1500,
        "theory_k1": 1200,
        "theory_k3": 1000,
        "assignment": 600,
        "anim": 15000,
        "game": 13000,
        "exercises_min": 4,
    },
    "core_concept": {
        "plan": 1400,
        "theory_k1": 1400,
        "theory_k3": 1200,
        "assignment": 500,
        "anim": 14000,
        "game": 12000,
        "exercises_min": 4,
    },
    "hands_on": {
        "plan": 1000,
        "theory_k1": 800,
        "theory_k3": 600,
        "assignment": 700,
        "anim": 12000,
        "game": 12000,
        "exercises_min": 4,
    },
    "foundation": {
        "plan": 900,
        "theory_k1": 800,
        "theory_k3": 500,
        "assignment": 400,
        "anim": 11000,
        "game": 11000,
        "exercises_min": 3,
    },
    "transitional": {
        "plan": 600,
        "theory_k1": 500,
        "theory_k3": 400,
        "assignment": 300,
        "anim": 10000,
        "game": 10000,
        "exercises_min": 2,
    },
}


def expected_sizes(kc: KnodeCorpus) -> dict:
    """Return expected sizes for this knode.

    Priority:
    1. tree.modules[i].generation_guide.expected_lengths (best — designer specified)
    2. classify_node_role + EXPECTED table (fallback heuristic)
    """
    # Priority 1: use generation_guide if present
    if kc.generation_guide and kc.generation_guide.get("expected_lengths"):
        el = kc.generation_guide["expected_lengths"]
        role = kc.generation_guide.get("mission_role") or classify_node_role(kc)

        def _mid(field_name: str, fallback: int) -> int:
            """Return midpoint of [min,max] range or fallback."""
            v = el.get(field_name)
            if isinstance(v, list) and len(v) == 2:
                return (v[0] + v[1]) // 2
            if isinstance(v, (int, float)):
                return int(v)
            return fallback

        n_th_target = _mid("n_theories", 2) or 2
        return {
            "role": role,
            "plan": _mid("plan_chars", 1200),
            "theory_k1": _mid("k1_chars_per_theory", 1000) * n_th_target,
            "theory_k3": _mid("k3_chars_per_theory", 800) * n_th_target,
            "assignment": _mid("assignment_chars", 600),
            "anim": _expected_anim_size(kc.generation_guide.get("anim_complexity", "standard")),
            "game": _expected_game_size(kc.generation_guide.get("game_complexity", "standard")),
            "exercises_min": (el.get("n_exercises") or [3])[0],
            "n_theories": n_th_target,
            "source": "generation_guide",
        }

    # Priority 2: fallback to role heuristic
    role = classify_node_role(kc)
    exp = dict(EXPECTED[role])
    exp["role"] = role
    exp["source"] = "heuristic"
    return exp


def _expected_anim_size(complexity: str) -> int:
    return {
        "simple": 6000,
        "standard": 12000,
        "rich": 17000,
        "ceremonial": 15000,
    }.get(complexity, 12000)


def _expected_game_size(complexity: str) -> int:
    return {
        "simple": 6000,
        "standard": 12000,
        "rich": 16000,
    }.get(complexity, 12000)


def size_gap(kc: KnodeCorpus) -> dict:
    """Compute gap actual - expected for each field. Negative = under-delivered."""
    exp = expected_sizes(kc)
    return {
        "role": exp["role"],
        "plan_gap": kc.plan_chars - exp["plan"],
        "k1_gap": kc.k1_chars_total - exp["theory_k1"],
        "k3_gap": kc.k3_chars_total - exp["theory_k3"],
        "assignment_gap": kc.assignment_chars - exp["assignment"],
        "anim_gap": kc.anim_chars - exp["anim"],
        "game_gap": kc.game_chars - exp["game"],
        "exercises_gap": kc.n_exercises - exp["exercises_min"],
        # composite: a single severity score
        "severity": _compute_severity(kc, exp),
    }


def _compute_severity(kc: KnodeCorpus, exp: dict) -> float:
    """0 = perfectly meets expected. Negative = under, positive = over.

    Weighted: pedagogical text (plan + theory) matters more than media.
    """
    plan_def = (kc.plan_chars - exp["plan"]) / exp["plan"]
    k1_def = (kc.k1_chars_total - exp["theory_k1"]) / exp["theory_k1"]
    k3_def = (kc.k3_chars_total - exp["theory_k3"]) / exp["theory_k3"]
    asg_def = (kc.assignment_chars - exp["assignment"]) / exp["assignment"]
    # weighted average
    return round(plan_def * 0.35 + k1_def * 0.25 + k3_def * 0.25 + asg_def * 0.15, 3)


# ============================================================
# Aggregate stats (proportionality core)
# ============================================================


def compute_size_stats(corpus: dict[str, KnodeCorpus]) -> dict:
    """Return mean / std / CV (coefficient of variation) for each metric.

    CV = std / mean. **The key proportionality indicator.**

    Higher CV = more variation across nodes = good differentiation.
    Lower CV = nodes more uniform = bad template-itis.
    """
    metrics = ["plan_chars", "k1_chars_total", "k3_chars_total", "assignment_chars", "anim_chars", "game_chars", "textual_chars"]
    out = {}
    for m in metrics:
        vals = [getattr(kc, m) if hasattr(kc, m) else kc.__dict__.get(m, 0) for kc in corpus.values()]
        # textual_chars is a property
        if m == "textual_chars":
            vals = [kc.textual_chars for kc in corpus.values()]
        if not vals or len(vals) < 2:
            continue
        mean_v = statistics.mean(vals)
        std_v = statistics.stdev(vals)
        cv = std_v / mean_v if mean_v > 0 else 0
        out[m] = {
            "mean": round(mean_v, 0),
            "std": round(std_v, 0),
            "cv": round(cv, 3),
            "min": min(vals),
            "max": max(vals),
            "p25": sorted(vals)[len(vals) // 4],
            "p50": sorted(vals)[len(vals) // 2],
            "p75": sorted(vals)[len(vals) * 3 // 4],
        }
    return out


def proportionality_report(corpus: dict[str, KnodeCorpus]) -> dict:
    """Generate the D3 (核心) report data.

    Returns dict with:
        - stats: per-metric mean/std/CV/percentiles
        - per_node: per-node role + actual + expected + gap + severity
        - top_underdelivered: 10 worst (capstone/wow but short)
        - top_overdelivered: 10 worst (transitional but long)
        - inversion_pairs: pairs where (less important) > (more important)
        - cv_grade: A/B/C/D/F based on CV distribution
    """
    stats = compute_size_stats(corpus)
    per_node = []
    for mid, kc in corpus.items():
        gap = size_gap(kc)
        per_node.append(
            {
                "module_id": mid,
                "title": kc.title,
                "stage": kc.stage_id,
                "role": gap["role"],
                "plan_chars": kc.plan_chars,
                "k1_chars": kc.k1_chars_total,
                "k3_chars": kc.k3_chars_total,
                "assignment_chars": kc.assignment_chars,
                "n_exercises": kc.n_exercises,
                "is_wow": kc.is_wow_moment,
                "severity": gap["severity"],
                "plan_gap": gap["plan_gap"],
                "k1_gap": gap["k1_gap"],
                "k3_gap": gap["k3_gap"],
                "assignment_gap": gap["assignment_gap"],
            }
        )

    # role aliases — handle both legacy (heuristic) and guide-style names
    IMPORTANT_ROLES = {
        "wow_capstone", "core_synthesis", "core_concept",  # heuristic
        "capstone", "synthesis", "concept_intro",  # generation_guide
    }
    LIGHT_ROLES = {
        "transitional", "foundation",  # heuristic
        "foundation",  # guide (same)
    }

    # under-delivered: severity << 0 in important nodes (or wow)
    under = sorted(
        [n for n in per_node if (n["role"] in IMPORTANT_ROLES) or n["is_wow"]],
        key=lambda x: x["severity"],
    )[:10]

    # over-delivered: severity >> 0 in light nodes
    over = sorted(
        [n for n in per_node if n["role"] in LIGHT_ROLES],
        key=lambda x: -x["severity"],
    )[:10]

    # inversions: any pair (i, j) where role_priority[i] < role_priority[j] but textual_chars[i] > textual_chars[j]
    role_priority = {
        "transitional": 0,
        "foundation": 1,
        "hands_on": 2,
        "core_concept": 3,
        "core_synthesis": 4,
        "wow_capstone": 5,
    }
    inversions: list[dict] = []
    nodes_list = [(kc, role_priority.get(classify_node_role(kc), 2)) for kc in corpus.values()]
    for i, (kc_i, p_i) in enumerate(nodes_list):
        for kc_j, p_j in nodes_list[i + 1 :]:
            if p_i < p_j and kc_i.textual_chars > kc_j.textual_chars + 500:
                inversions.append(
                    {
                        "less_important": kc_i.module_id,
                        "less_role": classify_node_role(kc_i),
                        "less_chars": kc_i.textual_chars,
                        "more_important": kc_j.module_id,
                        "more_role": classify_node_role(kc_j),
                        "more_chars": kc_j.textual_chars,
                        "delta": kc_i.textual_chars - kc_j.textual_chars,
                    }
                )
    inversions.sort(key=lambda x: -x["delta"])

    # CV grade (the proportionality indicator)
    # Healthy projects: textual_chars CV > 0.35 (clear differentiation by role)
    # Template-itis: textual_chars CV < 0.20 (uniform regardless of role)
    cv_textual = stats.get("textual_chars", {}).get("cv", 0)
    if cv_textual >= 0.40:
        cv_grade = "A (优秀差异化)"
    elif cv_textual >= 0.30:
        cv_grade = "B (合理差异化)"
    elif cv_textual >= 0.20:
        cv_grade = "C (差异化不足, 倾向模板化)"
    elif cv_textual >= 0.10:
        cv_grade = "D (严重模板化, 节点长度被 skill 拉平)"
    else:
        cv_grade = "F (灾难性模板化, 几乎所有节点同样长度)"

    # generation_guide coverage
    n_total = len(corpus)
    n_with_guide = sum(1 for kc in corpus.values() if kc.generation_guide)
    guide_coverage = n_with_guide / n_total if n_total else 0
    if guide_coverage >= 0.95:
        guide_grade = "A (几乎全覆盖)"
    elif guide_coverage >= 0.70:
        guide_grade = "B (大部分覆盖)"
    elif guide_coverage >= 0.30:
        guide_grade = "C (部分覆盖, 多数靠启发式)"
    else:
        guide_grade = "F (无 guide, 全部靠启发式 — 设计阶段没填)"

    return {
        "stats": stats,
        "per_node": per_node,
        "top_underdelivered": under,
        "top_overdelivered": over,
        "inversions": inversions[:20],
        "cv_textual": cv_textual,
        "cv_grade": cv_grade,
        "guide_coverage": guide_coverage,
        "guide_grade": guide_grade,
        "n_with_guide": n_with_guide,
        "n_total": n_total,
    }


# ============================================================
# Report composition
# ============================================================


def compose_report(
    slug: str,
    proportionality: dict,
    science: Optional[dict] = None,
    continuity: Optional[dict] = None,
    importance: Optional[dict] = None,
    output: Optional[Path] = None,
) -> Path:
    """Write the audit report markdown."""
    out_path = output or (REVIEW / f"{slug}_audit_report.md")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    lines = []
    lines.append(f"# {slug} 内容质量审计报告\n")
    lines.append(f"自动生成 by `content_auditor` skill. 4 维度审计.\n")

    # TL;DR
    lines.append("## TL;DR\n")
    cv = proportionality["cv_textual"]
    grade = proportionality["cv_grade"]
    cov = proportionality.get("guide_coverage", 0)
    cov_grade = proportionality.get("guide_grade", "?")
    lines.append(
        f"- **generation_guide 覆盖率**: {proportionality.get('n_with_guide', 0)}/{proportionality.get('n_total', 0)} = {cov*100:.0f}% → **{cov_grade}**"
    )
    lines.append(f"- **D3 体量差异化** (核心): textual CV = {cv:.3f} → **{grade}**")
    if science:
        lines.append(f"- D1 科学性: {science.get('score', '?')}/30 — {science.get('verdict', '')}")
    if continuity:
        lines.append(f"- D2 连续性: {continuity.get('score', '?')}/30 — {continuity.get('verdict', '')}")
    if importance:
        lines.append(f"- D4 重要性差异: {importance.get('score', '?')}/30 — {importance.get('verdict', '')}")
    lines.append("")

    # === D3 (核心) ===
    lines.append("## D3 体量匹配 (核心 — 用户最关切)\n")
    lines.append(f"### 整体指标\n")
    stats = proportionality["stats"]
    lines.append("| 字段 | mean | std | CV | min | p50 | max |")
    lines.append("|---|---|---|---|---|---|---|")
    for f in ["textual_chars", "plan_chars", "k1_chars_total", "k3_chars_total", "assignment_chars"]:
        s = stats.get(f, {})
        if not s:
            continue
        lines.append(
            f"| {f} | {s['mean']:.0f} | {s['std']:.0f} | **{s['cv']:.3f}** | {s['min']} | {s['p50']} | {s['max']} |"
        )
    lines.append("")
    lines.append(f"**CV (变异系数) 解读**: \n")
    lines.append("- ≥ 0.40: A 优秀差异化 — 节点按角色合理差异\n")
    lines.append("- 0.30-0.40: B 合理\n")
    lines.append("- 0.20-0.30: C 差异化不足, 倾向模板化\n")
    lines.append("- < 0.20: D/F 严重模板化, skill 把所有节点拉平到相似长度\n")
    lines.append(f"\n**本项目 CV = {cv:.3f} → {grade}**\n")

    # ASCII distribution
    lines.append("### 字数分布 (ASCII 直方图, textual_chars)\n")
    lines.append("```")
    s = stats.get("textual_chars", {})
    if s:
        vals = sorted([n["plan_chars"] + n["k1_chars"] + n["k3_chars"] + n["assignment_chars"] for n in proportionality["per_node"]])
        if vals:
            mx = max(vals)
            for v in vals:
                bar = "█" * int(v / mx * 50)
                lines.append(f"{v:6d} | {bar}")
    lines.append("```\n")

    # Per-stage breakdown
    lines.append("### 各 stage 平均字数 + role 分布\n")
    by_stage: dict[str, list] = {}
    for n in proportionality["per_node"]:
        by_stage.setdefault(n["stage"], []).append(n)
    lines.append("| stage | 节点数 | mean textual | mean plan | role 分布 |")
    lines.append("|---|---|---|---|---|")
    for st in sorted(by_stage.keys()):
        nodes = by_stage[st]
        mean_text = statistics.mean(n["plan_chars"] + n["k1_chars"] + n["k3_chars"] + n["assignment_chars"] for n in nodes)
        mean_plan = statistics.mean(n["plan_chars"] for n in nodes)
        role_count: dict = {}
        for n in nodes:
            role_count[n["role"]] = role_count.get(n["role"], 0) + 1
        role_str = ", ".join(f"{r}:{c}" for r, c in role_count.items())
        lines.append(f"| {st} | {len(nodes)} | {mean_text:.0f} | {mean_plan:.0f} | {role_str} |")
    lines.append("")

    # under-delivered
    lines.append("### 🔴 缺料节点 top 10 (重要节点但内容不足)\n")
    lines.append("| module | title | role | wow? | plan | k1 | k3 | severity |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for n in proportionality["top_underdelivered"]:
        wow = "★" if n["is_wow"] else ""
        lines.append(
            f"| {n['module_id']} | {n['title'][:30]} | {n['role']} | {wow} | {n['plan_chars']} ({n['plan_gap']:+d}) | {n['k1_chars']} | {n['k3_chars']} | **{n['severity']:.2f}** |"
        )
    lines.append("")

    # over-delivered
    lines.append("### 🟡 过度膨胀节点 top 10 (轻量节点但内容过多)\n")
    lines.append("| module | title | role | plan | severity |")
    lines.append("|---|---|---|---|---|")
    for n in proportionality["top_overdelivered"]:
        lines.append(
            f"| {n['module_id']} | {n['title'][:30]} | {n['role']} | {n['plan_chars']} ({n['plan_gap']:+d}) | {n['severity']:+.2f} |"
        )
    lines.append("")

    # inversions
    lines.append("### ⚠️ 倒挂对 top 10 (轻 > 重)\n")
    if not proportionality["inversions"]:
        lines.append("无倒挂. \n")
    else:
        lines.append("| 轻 (实际多) | role | 字数 | vs | 重 (实际少) | role | 字数 | 差 |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for inv in proportionality["inversions"][:10]:
            lines.append(
                f"| {inv['less_important']} | {inv['less_role']} | {inv['less_chars']} | > | {inv['more_important']} | {inv['more_role']} | {inv['more_chars']} | {inv['delta']:+d} |"
            )
    lines.append("")

    # === D1 D2 D4 ===
    if science:
        lines.append("## D1 科学性\n")
        lines.append(f"**总分**: {science.get('score', '?')}/30\n")
        lines.append(f"**评价**: {science.get('verdict', '')}\n")
        for issue in science.get("issues", []):
            lines.append(f"- [{issue.get('severity', '?')}] {issue.get('module', '?')}: {issue.get('msg', '')}")
        lines.append("")

    if continuity:
        lines.append("## D2 连续性\n")
        lines.append(f"**总分**: {continuity.get('score', '?')}/30\n")
        lines.append(f"**评价**: {continuity.get('verdict', '')}\n")
        for issue in continuity.get("issues", []):
            lines.append(f"- [{issue.get('severity', '?')}] {issue.get('module', '?')}: {issue.get('msg', '')}")
        lines.append("")

    if importance:
        lines.append("## D4 重要性差异\n")
        lines.append(f"**总分**: {importance.get('score', '?')}/30\n")
        lines.append(f"**评价**: {importance.get('verdict', '')}\n")
        for issue in importance.get("issues", []):
            lines.append(f"- [{issue.get('severity', '?')}] {issue.get('module', '?')}: {issue.get('msg', '')}")
        lines.append("")

    # Fix priority
    lines.append("## 修复优先级\n")
    p0 = [n for n in proportionality["top_underdelivered"] if n["severity"] < -0.4 and n["role"] in {"wow_capstone", "core_synthesis"}]
    p1 = [n for n in proportionality["top_underdelivered"] if -0.4 <= n["severity"] < -0.2]
    p2 = proportionality["inversions"][:5]
    lines.append("### P0 必修 (重要节点严重缺料)\n")
    if p0:
        for n in p0:
            lines.append(f"- **{n['module_id']}** ({n['role']}, {'wow ★' if n['is_wow'] else ''}): plan {n['plan_chars']} (gap {n['plan_gap']:+d}), K3 {n['k3_chars']} (gap {n['k3_gap']:+d}). 应至少 +{abs(n['plan_gap'])} 字 plan + 深化 K3.")
    else:
        lines.append("- (无 P0 问题)\n")
    lines.append("\n### P1 应修 (中度问题)\n")
    if p1:
        for n in p1:
            lines.append(f"- {n['module_id']}: severity {n['severity']:.2f}, 补 plan + 完善 hands-on assignment.")
    else:
        lines.append("- (无 P1 问题)\n")
    lines.append("\n### P2 可改 (倒挂)\n")
    if p2:
        for inv in p2:
            lines.append(f"- 简化 {inv['less_important']} 或扩 {inv['more_important']}")
    else:
        lines.append("- (无 P2 倒挂)\n")

    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


# ============================================================
# CLI entrance
# ============================================================


def run_audit(slug: str, output: Optional[str] = None) -> Path:
    """Pure D3 audit (no LLM sub-agents). Use for quick check.

    For full 4-D audit, run skill via Skill tool which orchestrates sub-agents.
    """
    corpus = load_project_corpus(slug)
    print(f"loaded {len(corpus)} knodes")
    prop = proportionality_report(corpus)
    print(f"CV textual: {prop['cv_textual']:.3f} — {prop['cv_grade']}")
    print(f"top under-delivered: {len(prop['top_underdelivered'])}")
    print(f"top over-delivered: {len(prop['top_overdelivered'])}")
    print(f"inversions: {len(prop['inversions'])}")
    out = compose_report(slug, prop, output=Path(output) if output else None)
    print(f"report → {out}")
    return out


if __name__ == "__main__":
    import sys
    slug = sys.argv[1] if len(sys.argv) > 1 else "eeg-minecraft-bci"
    out = sys.argv[2] if len(sys.argv) > 2 else None
    run_audit(slug, out)
