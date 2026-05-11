"""README.md → V5 knowledge_tree.json 骨架编译.

蓝图 README 的 ## Syllabus 段落形如:

    **Phase 1 — Background & Colony(背景 + 蚁群,第 1-5 周)**
    - W1:成果 — ...
    - W2:成果 — ...
    ...

抽出 Phase + Week 配对, 生成最小可用的 V5 KnowledgeTree:
- 每个 Phase → 1 个 Stage
- 每个 W<N> → 1 个 Module (module_id="M<NN>", week=N, stage=<phase stage_id>)

注意: 这里只生成骨架 (sequence_order / week / title); 详细字段
(hands_on_components / acceptance_artifacts 等) 留空, 由 Claude Code +
SKILL.md 后续逐个 knode 补全, 或者另开 spec 用 thinking LLM 批量生成。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .blueprint import BlueprintFrontmatter, ParsedBlueprint, load_blueprint
from .workspace import project_blueprint_dir, project_generated_dir


# ---------------------------------------------------------------------------
# parser
# ---------------------------------------------------------------------------

# 中英文 "Phase N — Title (...第 a-b 周)" / "Phase N — Title (W1-W5)"
_PHASE_RE = re.compile(
    r"\*\*\s*Phase\s+(\d+)\s*[—\-–:]\s*(.+?)\s*\*\*",
    re.IGNORECASE,
)

# 中英文 "- W12: ..." / "- W12 — ..."
_WEEK_RE = re.compile(r"^\s*[-\*]\s*W(\d+)\s*[:：—\-–]\s*(.+)$", re.MULTILINE)


@dataclass
class ParsedWeek:
    week: int
    raw_title: str


@dataclass
class ParsedPhase:
    phase_num: int
    title_raw: str               # 含可能的括号副标题
    title_short: str             # 主标题 (不含括号)
    weeks: list[ParsedWeek] = field(default_factory=list)


def parse_syllabus(body_markdown: str) -> list[ParsedPhase]:
    """从 README 正文里解析 Phase/Week 结构.

    扫描方式: 逐行扫, 遇到 Phase 行开新 phase, 遇到 W 行加到当前 phase。
    """
    phases: list[ParsedPhase] = []
    current: ParsedPhase | None = None

    for line in body_markdown.splitlines():
        m_phase = _PHASE_RE.search(line)
        if m_phase:
            phase_num = int(m_phase.group(1))
            title_raw = m_phase.group(2).strip()
            # 去掉末尾括号 ("Background & Colony(背景 + 蚁群,第 1-5 周)" → "Background & Colony")
            title_short = re.sub(r"[\(（].*?[\)）]\s*$", "", title_raw).strip()
            current = ParsedPhase(
                phase_num=phase_num,
                title_raw=title_raw,
                title_short=title_short,
            )
            phases.append(current)
            continue

        m_week = _WEEK_RE.match(line)
        if m_week and current is not None:
            week = int(m_week.group(1))
            raw = m_week.group(2).strip()
            current.weeks.append(ParsedWeek(week=week, raw_title=raw))

    return phases


# ---------------------------------------------------------------------------
# V5 skeleton builder
# ---------------------------------------------------------------------------

def _week_short_title(raw: str) -> str:
    """从 'W12 成果 — 设计 PI agent 提示...' 里抽简短标题用作 module.title.

    截到第一个标点 (中英文句号/逗号/分号), 限长 ~40 字符。
    """
    text = raw
    # 去掉 "成果 —" / "Outcome —" 前缀
    text = re.sub(r"^\s*(成果|outcome|deliverable)\s*[—\-–:：]\s*", "", text, flags=re.IGNORECASE)
    # 截到第一个标点
    cut = re.split(r"[。.;；,，:：(（]", text, maxsplit=1)
    short = cut[0].strip()
    if len(short) > 60:
        short = short[:60] + "..."
    return short or text[:40]


def _build_tree_skeleton(blueprint: ParsedBlueprint, slug: str) -> dict:
    """构造 V5 KnowledgeTree dict (JSON-ready)."""
    fm: BlueprintFrontmatter = blueprint.frontmatter
    phases = parse_syllabus(blueprint.body_markdown)

    stages: list[dict] = []
    modules: list[dict] = []
    module_idx = 0

    for ph in phases:
        stage_id = f"S{ph.phase_num}"
        stages.append({
            "stage_id": stage_id,
            "title": ph.title_short,
            "stage_goal": "",
            "stage_description": ph.title_raw,
            "why_this_stage_exists": "",
            "concept_density_class": "",
            "new_concept_count_estimate": "",
            "module_count_reason": f"derived from blueprint Phase {ph.phase_num} ({len(ph.weeks)} weeks)",
            "stage_output": "",
            "closing_capstone_module_id": "",
            "capstone_scope": "",
            "capstone_reuses_outputs_from_stages": [],
            "capstone_hands_on_expectation": "",
            "capstone_integration_reason": "",
            "expansion_priority": "",
        })
        for w in ph.weeks:
            module_idx += 1
            modules.append({
                "module_id": f"M{module_idx:02d}",
                "title": _week_short_title(w.raw_title),
                "stage_id": stage_id,
                "sequence_order": module_idx,
                "module_role": "",
                "is_acceptance_unit": True,
                "summary": w.raw_title,
                "detailed_description": "",
                "mission_role": "",
                "core_question": "",
                "why_non_skippable": "",
                "rough_learning_topics": [],
                "what_it_inherits": "",
                "outputs_produced": [],
                "what_it_passes_forward": "",
                "real_world_anchor": "",
                "capstone_scope": None,
                "integrates_previous_stage_outputs": [],
                "hands_on_components": [],
                "engineering_practice_evidence": "",
                "acceptance_artifacts": [],
                "acceptance_standard": [],
                "depends_on": [f"M{module_idx - 1:02d}"] if module_idx > 1 else [],
                "dependency_reason": "sequential weekly progression (skeleton)",
                "estimated_duration_months": "0.25",
                "knowledge_level": "K1",
                "expansion_priority": "",
                # 自定义扩展字段 (skeleton-only, 用于 manifest):
                "week": w.week,
                "raw_blueprint_title": w.raw_title,
            })

    title = fm.title or blueprint.title_zh or blueprint.title_en or slug
    tree = {
        "schema_version": "5.0",
        "tree_type": "project",
        "title": title,
        "description": "",
        "stages": stages,
        "modules": modules,
        "edges": [],
        "special_nodes": [],
        "project_identity": {
            "slug": slug,
            "title_en": blueprint.title_en,
            "title_zh": blueprint.title_zh,
            "age_band": fm.age_band,
            "domain": fm.domain,
            "duration_weeks": fm.duration_weeks,
            "weekly_hours": fm.weekly_hours,
            "budget_usd": fm.budget_usd,
            "difficulty": fm.difficulty,
        },
        "target_learner": {},
        "project_positioning": {},
        "decomposition_strategy": {
            "method": "phase-week from blueprint syllabus (auto-compiled skeleton)",
            "stage_count": len(stages),
            "module_count": len(modules),
        },
        "safety_boundaries": {},
        "knowledge_levels": [],
        "stage_relationship_rule": "",
        "global_integration_rule": "",
    }
    return tree


def knode_dir_name(module: dict) -> str:
    """生成 knode 目录名: 'M01-w1-<slug>'.

    slug 取 title_short 简单 ascii-lower + 连字符。
    """
    mod_id = module["module_id"]
    week = module.get("week", 0)
    title = module.get("title", "")
    # 简单 slugify: 取前 30 字符, 非 [a-z0-9] → -
    text = title.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if not text:
        text = "module"
    return f"{mod_id}-w{week}-{text[:30].rstrip('-')}"


@dataclass
class CompileResult:
    slug: str
    stage_count: int
    module_count: int
    tree_path: Path
    manifest_path: Path
    knode_dirs_created: list[Path]


def compile_project(slug: str) -> CompileResult:
    """从 blueprint 编译出 V5 骨架 + manifest skeleton + 空 knode 目录.

    输入: content-workspace/blueprints/<slug>/README*.md
    输出: content-workspace/generated/<slug>/
            ├── tree/knowledge_tree.json
            ├── manifest.json (skeleton, files=[] 待生成完后补)
            └── knodes/M01-w1-xxx/  (空目录, 占位)
                ...
    """
    blueprint_dir = project_blueprint_dir(slug)
    if not blueprint_dir.is_dir():
        raise FileNotFoundError(
            f"blueprint not synced: {blueprint_dir} (run `systemedu-content blueprint sync` first)"
        )
    bp = load_blueprint(blueprint_dir)

    generated = project_generated_dir(slug)
    generated.mkdir(parents=True, exist_ok=True)
    (generated / "tree").mkdir(exist_ok=True)
    (generated / "knodes").mkdir(exist_ok=True)
    (generated / "blueprint").mkdir(exist_ok=True)

    # 拷贝 blueprint 进 generated (export 时一并打包)
    for fname in ("README.md", "README.zh.md"):
        src = blueprint_dir / fname
        if src.is_file():
            (generated / "blueprint" / fname).write_text(
                src.read_text(encoding="utf-8"), encoding="utf-8"
            )

    tree = _build_tree_skeleton(bp, slug)
    tree_path = generated / "tree" / "knowledge_tree.json"
    tree_path.write_text(
        json.dumps(tree, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 建空 knode 目录
    knode_dirs: list[Path] = []
    knode_entries: list[dict] = []
    for module in tree["modules"]:
        dir_name = knode_dir_name(module)
        knode_path = generated / "knodes" / dir_name
        knode_path.mkdir(exist_ok=True)
        knode_dirs.append(knode_path)
        knode_entries.append({
            "module_id": module["module_id"],
            "title": module["title"],
            "week": module.get("week"),
            "stage": module["stage_id"],
            "duration_minutes": None,
            "knode_dir": f"knodes/{dir_name}",
        })

    fm = bp.frontmatter
    manifest = {
        "schema_version": "1.0",
        "slug": slug,
        "title": tree["title"],
        "title_zh": bp.title_zh or tree["title"],
        "description": "",
        "version": "0.1.0",
        "version_tag": "skeleton",
        "frontmatter": {
            "age_band": fm.age_band,
            "domain": fm.domain,
            "duration_weeks": fm.duration_weeks,
            "weekly_hours": fm.weekly_hours,
            "budget_usd": fm.budget_usd,
            "difficulty": fm.difficulty,
        },
        "knode_count": len(tree["modules"]),
        "stage_count": len(tree["stages"]),
        "languages": ["zh-CN", "en"],
        "total_size_bytes": 0,        # publish/export 前重算
        "files": [],                  # publish/export 前重算
        "knodes": knode_entries,
        "cover_image_path": None,
        "tags": [],
        "created_at": None,
        "updated_at": None,
    }
    manifest_path = generated / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return CompileResult(
        slug=slug,
        stage_count=len(tree["stages"]),
        module_count=len(tree["modules"]),
        tree_path=tree_path,
        manifest_path=manifest_path,
        knode_dirs_created=knode_dirs,
    )
