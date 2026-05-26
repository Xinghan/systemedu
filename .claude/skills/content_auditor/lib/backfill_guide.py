"""backfill_guide.py — 给已有 V5 tree 回填 generation_guide.

适用场景: 老项目的 tree 里没 generation_guide, 但内容已经生成完毕.
要审计的话需要个 baseline. 这个脚本根据 tree 里现有信号 (title / role / topics / depends_on)
自动推一个**保守的** guide, 写回 tree.json. 之后 audit 会用 guide 当作 expected.

推断规则:
- 哇时刻关键词 (★ / wow / 哇 / 第一次 / capstone / 收官 / 通关 / 大功告成 / 哇时刻)
  → importance 5, narrative_role=celebration, anim=ceremonial
- module_role=core + 出现核心数学概念 (CSP/LDA/ICA/方差/协方差/傅里叶/正则化)
  → importance 4, theory_depth=deep
- "实战 / 实采 / 调试 / 训练 / 跑" + 长 hands_on
  → importance 3, handson_difficulty=high
- 默认过渡节点 importance 2, theory_depth=shallow

用法:
    python3 backfill_guide.py <slug> [--dry-run]
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

WORKSPACE = Path("/Users/xinghan/Dev/systemedu/content-workspace/generated")


WOW_KEYWORDS = ["★", "wow", "哇", "第一次", "capstone", "收官", "通关", "大功告成", "哇时刻", "庆祝"]

DEEP_THEORY_KEYWORDS = [
    "CSP", "LDA", "ICA", "Riemannian", "EEGNet", "方差", "协方差", "傅里叶",
    "正则化", "卷积", "梯度", "贝叶斯", "黎曼", "特征值",
]

HIGH_HANDSON_KEYWORDS = [
    "实采", "录满", "训练分类器", "实测", "跑通", "封装", "部署", "实战",
    "调试", "调优", "校准", "压测", "戴头环", "戴上设备", "纯靠想象",
    "实时控制", "脑控", "录屏", "上线", "demo",
]


def classify_module(m: dict) -> dict:
    """Infer generation_guide fields from existing module metadata."""
    title = m.get("title", "")
    summary = m.get("summary", "")
    role = (m.get("module_role") or "").lower()
    topics = " ".join(m.get("rough_learning_topics") or [])
    hands_on = " ".join(m.get("hands_on_components") or [])
    accept = " ".join(
        (a or {}).get("title", "") for a in (m.get("acceptance_artifacts") or [])
    )
    real_anchor = m.get("real_world_anchor", "")
    hay_full = " ".join([title, summary, topics, hands_on, accept, real_anchor]).lower()
    hay_title = title.lower()

    # === importance + wow_moment ===
    is_wow = any(k.lower() in hay_full for k in WOW_KEYWORDS)
    is_deep_theory = any(k.lower() in hay_full for k in DEEP_THEORY_KEYWORDS)
    is_high_handson = any(k.lower() in hay_full for k in HIGH_HANDSON_KEYWORDS)

    # role tier from existing role + content signals
    if is_wow:
        importance = 5
        mission_role = "capstone"
        narrative_role = "celebration"
    elif role in ("synthesis", "capstone"):
        importance = 5
        mission_role = "synthesis"
        narrative_role = "climax"
    elif is_deep_theory:
        importance = 4
        mission_role = "concept_intro"
        narrative_role = "build"
    elif is_high_handson:
        importance = 4
        mission_role = "hands_on"
        narrative_role = "build"
    elif role in ("foundation", "core"):
        importance = 3
        mission_role = role if role else "concept_intro"
        narrative_role = "build"
    else:
        importance = 2
        mission_role = "foundation"
        narrative_role = "build"

    # specific wow_moment hint by stage (project-specific heuristic)
    # eeg 实际 6 stages: S1=见 alpha, S2 滤波, S3 公开数据训, S4 自录 70%, S5 接 Minecraft, S6 分享
    # 4 大哇时刻: wow_1 = S1 末尾 alpha 升起 / wow_2 = S4 末尾冲 70% / wow_3 = S5 末尾稳定 / wow_4 = S5 实时控
    wow_moment = None
    if is_wow:
        mid = m.get("module_id", "")
        sid = m.get("stage_id", "")
        # 优先按已知里程碑 module 精确映射
        explicit = {
            "M12": "wow_1",  # 见 alpha
            "M45": "wow_2",  # S4 冲 70% capstone
            "M51": "wow_2",  # S4 反复实测 70% (实际项目 S5 capstone)
            "M55": "wow_4",  # 第一次脑控 — 终极
        }
        wow_moment = explicit.get(mid)
        # 兜底按 stage
        if not wow_moment:
            wow_map = {"S1": "wow_1", "S3": "wow_2", "S4": "wow_2", "S5": "wow_3"}
            wow_moment = wow_map.get(sid)

    # theory_depth
    if is_deep_theory:
        theory_depth = "deep"
    elif role in ("foundation", "synthesis", "capstone") and not is_wow:
        theory_depth = "medium"
    elif is_wow and not is_deep_theory:
        theory_depth = "shallow"  # wow 重体验不重新理论
    else:
        theory_depth = "medium"

    # handson_difficulty
    if is_high_handson:
        handson_difficulty = "high"
    elif "demo" in hay_full or "可视化" in hay_full or "看" in hay_title:
        handson_difficulty = "low"
    else:
        handson_difficulty = "medium"

    # === lengths (按 importance 倍率) ===
    base_plan = 800
    base_k1 = 700
    base_k3 = 500
    base_assignment = 400
    base_n_th = 2
    base_n_ex = 3

    importance_mult = {1: 0.8, 2: 1.0, 3: 1.4, 4: 1.8, 5: 2.5}[importance]
    plan_mid = int(base_plan * importance_mult)
    k1_mid = int(base_k1 * importance_mult)
    # K3 by importance, then adjusted by theory_depth multiplier (single application, not nested)
    k3_depth_mult = {"deep": 1.5, "medium": 1.0, "shallow": 0.7}[theory_depth]
    k3_mid = int(base_k3 * importance_mult * k3_depth_mult)
    asg_mid = int(base_assignment * importance_mult)

    # wow + high handson nodes need fat assignment regardless of theory
    if is_wow and handson_difficulty == "high":
        asg_mid = max(asg_mid, 1200)

    # 范围 ±25%
    def _rng(mid: int) -> list:
        return [int(mid * 0.75), int(mid * 1.25)]

    # anim/game complexity
    if is_wow:
        anim_complexity = "ceremonial"
        game_complexity = "rich"
    elif importance >= 4:
        anim_complexity = "rich"
        game_complexity = "standard"
    elif importance == 1:
        anim_complexity = "simple"
        game_complexity = "simple"
    else:
        anim_complexity = "standard"
        game_complexity = "standard"

    # narrative_role 微调
    # 第一节 (sequence_order=1 of stage) → intro
    # capstone (last of stage or wow) → climax/celebration
    # 普通中段 → build

    return {
        "importance": importance,
        "wow_moment": wow_moment,
        "mission_role": mission_role,
        "narrative_role": narrative_role,
        "theory_depth": theory_depth,
        "handson_difficulty": handson_difficulty,
        "expected_lengths": {
            "plan_chars": _rng(plan_mid),
            "k1_chars_per_theory": _rng(k1_mid),
            "k3_chars_per_theory": _rng(k3_mid),
            "n_theories": [base_n_th, base_n_th + 1],
            "assignment_chars": _rng(asg_mid),
            "n_exercises": [base_n_ex, base_n_ex + 2],
        },
        "anim_complexity": anim_complexity,
        "game_complexity": game_complexity,
        "prereq_recap_chars": 200 if m.get("depends_on") else 0,
        "next_preview_chars": 150,
        "must_reference_modules": m.get("depends_on", [])[:2],
        "_inferred_by": "backfill_guide.py — heuristic, not designer-authored",
    }


def backfill(slug: str, dry_run: bool = False) -> tuple[Path, dict]:
    tree_path = WORKSPACE / slug / "tree" / "knowledge_tree.json"
    if not tree_path.exists():
        raise FileNotFoundError(tree_path)
    tree = json.loads(tree_path.read_text(encoding="utf-8"))

    summary = {"total": 0, "added": 0, "already_had": 0}
    stage_role_count: dict = {}

    for m in tree.get("modules", []):
        summary["total"] += 1
        if "generation_guide" in m:
            summary["already_had"] += 1
            continue
        guide = classify_module(m)
        m["generation_guide"] = guide
        summary["added"] += 1
        sid = m.get("stage_id", "?")
        stage_role_count.setdefault(sid, {}).setdefault(guide["mission_role"], 0)
        stage_role_count[sid][guide["mission_role"]] += 1

    if dry_run:
        print(json.dumps(summary, indent=2))
        print("--- sample (M55) ---")
        for m in tree["modules"]:
            if m["module_id"] == "M55":
                print(json.dumps(m.get("generation_guide", {}), indent=2, ensure_ascii=False))
                break
        return tree_path, summary

    # backup before overwrite
    backup = tree_path.with_suffix(".pre_backfill.json")
    if not backup.exists():
        shutil.copy(tree_path, backup)
        print(f"backup → {backup}")
    tree_path.write_text(json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote → {tree_path}")
    print(f"summary: {summary}")
    print("stage role distribution:")
    for sid in sorted(stage_role_count):
        print(f"  {sid}: {stage_role_count[sid]}")
    return tree_path, summary


if __name__ == "__main__":
    slug = sys.argv[1] if len(sys.argv) > 1 else "eeg-minecraft-bci"
    dry = "--dry-run" in sys.argv
    backfill(slug, dry_run=dry)
