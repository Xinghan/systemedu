"""kg-builder 主入口: 逐学科扩建知识图谱 (spec 041 里程碑3).

固化 math 跑通的5步流程为一条命令。人工审是硬停点 (spec要求), 故分阶段:

  python -m kg_builder <subject>                  # 1. 列候选→闸门→产待审清单CSV (停,等人审)
  python -m kg_builder <subject> --merge <csv>    # 2. 把审核过的清单合入新节点
  python -m kg_builder <subject> --relations      # 3. 拉Wikidata本体论关系落盘
  python -m kg_builder <subject> --prereq         # 4. LLM补prerequisites学习顺序落盘
  python -m kg_builder --status                   # 各学科覆盖进度

CSV 待审清单默认放 tools/kg-builder/_review/<subject>_review.csv。
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
TREE_PATH = REPO / "course_factory" / "knowledge_tree" / "platform_tree.json"
REVIEW_DIR = REPO / "tools" / "kg-builder" / "_review"

from course_factory.knowledge_tree.schema import PlatformTree, load_platform_tree
from kg_builder.candidates import list_candidates
from kg_builder.emit import enrich_and_gate, write_review_csv
from kg_builder.merge import merge_nodes
from kg_builder.prerequisites import suggest_prerequisites
from kg_builder.relations import enrich_relations

SUBJECT_ZH = {
    "math": "数学", "phys": "物理", "chem": "化学", "bio": "生物",
    "cs": "计算机科学", "elec": "电子/电气工程", "env": "环境科学",
    "astro": "天文/空间科学", "med": "医学/生理", "eng": "工程/机械",
    "geo": "地球科学/地质",
}


def cmd_candidates(subject: str) -> None:
    """步骤1: LLM列候选 → search_qid配QID → 三道闸门 → 产待审清单CSV."""
    t = load_platform_tree()
    subj = t.get_subject(subject)
    if subj is None:
        sys.exit(f"学科 {subject} 不存在")
    existing_ids = {n.id for s in t.subjects for n in s.nodes}

    print(f"[{subject}] LLM 列缺失候选 ...", flush=True)
    cands = list_candidates(subject, SUBJECT_ZH.get(subject, subject), subj.nodes)
    print(f"[{subject}] {len(cands)} 候选, search_qid配QID + 三道闸门 ...", flush=True)
    passed, rejected = enrich_and_gate(cands, existing_ids, sleep=1.0)

    out = REVIEW_DIR / f"{subject}_review.csv"
    write_review_csv(passed + rejected, out)
    print(f"[{subject}] PASS {len(passed)} / REJECT {len(rejected)}")
    print(f"  待审清单 -> {out}")
    print(f"  人工审核后: python -m kg_builder {subject} --merge {out}")
    print(f"  注意核对歧义词QID (search_qid top1 可能被同名游戏/姓氏抢)")


def cmd_merge(subject: str, csv_path: str) -> None:
    """步骤2: 把审核过的待审清单(PASS行)合入图谱新节点."""
    rows = [r for r in csv.DictReader(open(csv_path, encoding="utf-8"))
            if r.get("gate_status") == "PASS"]
    nodes = []
    for r in rows:
        node = {
            "id": r["proposed_id"], "name_zh": r["name_zh"], "name_en": r["name_en"],
            "depth_level": r["depth_level"], "prerequisites": [],
            "description": r.get("name_zh", ""), "provenance": "kg-builder-v1",
            "verified": r.get("verified") == "True",
        }
        if r.get("qid"):
            node["wikidata_qid"] = r["qid"]
            node["mapping_type"] = r.get("mapping_type") or "broader"
        if r.get("std_code"):
            node["std_codes"] = [r["std_code"]]
        nodes.append(node)
    merge_nodes(TREE_PATH, subject, nodes)
    t = load_platform_tree()
    print(f"[{subject}] 合入 {len(nodes)} 新节点. 学科现 {len(t.get_subject(subject).nodes)} 节点, 总 {t.total_node_count()}")
    print(f"  下一步关系: python -m kg_builder {subject} --relations")


def cmd_relations(subject: str) -> None:
    """步骤3: 拉Wikidata本体论关系(P279/P361/P527)落盘."""
    data = json.loads(TREE_PATH.read_text(encoding="utf-8"))
    print(f"[{subject}] 拉 Wikidata 关系 (限速, 视节点数几分钟) ...", flush=True)
    stats = enrich_relations(data, only_subjects={subject})
    PlatformTree(**data)
    TREE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{subject}] {stats}")
    print(f"  下一步学习顺序: python -m kg_builder {subject} --prereq")


def cmd_prereq(subject: str) -> None:
    """步骤4: LLM补新节点prerequisites学习顺序落盘."""
    t = load_platform_tree()
    subj = t.get_subject(subject)
    new = [n for n in subj.nodes if n.provenance == "kg-builder-v1" and not n.prerequisites]
    if not new:
        print(f"[{subject}] 无待补prereq的新节点")
        return
    print(f"[{subject}] LLM 为 {len(new)} 新节点推断前置 ...", flush=True)
    result = suggest_prerequisites(subject, new, subj.nodes)

    data = json.loads(TREE_PATH.read_text(encoding="utf-8"))
    for s in data["subjects"]:
        if s["id"] == subject:
            for n in s["nodes"]:
                if n["id"] in result and result[n["id"]]:
                    n["prerequisites"] = result[n["id"]]
    PlatformTree(**data)  # 校验同学科+无环
    TREE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    filled = sum(1 for v in result.values() if v)
    print(f"[{subject}] {filled}/{len(new)} 新节点补出前置, 校验通过落盘")


def cmd_status() -> None:
    """各学科覆盖进度 + 关系统计."""
    t = load_platform_tree()
    print(f"{'学科':<6} {'节点':>4} {'有QID':>6} {'verified':>9} {'有prereq':>9} {'有related':>10}")
    print("-" * 50)
    for s in t.subjects:
        ns = s.nodes
        print(f"{s.id:<6} {len(ns):>4} {sum(1 for n in ns if n.wikidata_qid):>6} "
              f"{sum(1 for n in ns if n.verified):>9} {sum(1 for n in ns if n.prerequisites):>9} "
              f"{sum(1 for n in ns if n.related):>10}")
    print("-" * 50)
    print(f"{'总':<6} {t.total_node_count():>4}")


def main() -> int:
    ap = argparse.ArgumentParser(description="kg-builder 逐学科扩建知识图谱 (spec 041)")
    ap.add_argument("subject", nargs="?", help="学科 id (math/phys/...)")
    ap.add_argument("--merge", metavar="CSV", help="把审核过的待审清单合入")
    ap.add_argument("--relations", action="store_true", help="拉Wikidata关系")
    ap.add_argument("--prereq", action="store_true", help="LLM补prerequisites")
    ap.add_argument("--status", action="store_true", help="各学科覆盖进度")
    args = ap.parse_args()

    if args.status:
        cmd_status(); return 0
    if not args.subject:
        ap.error("需要学科 id (或 --status)")
    if args.merge:
        cmd_merge(args.subject, args.merge)
    elif args.relations:
        cmd_relations(args.subject)
    elif args.prereq:
        cmd_prereq(args.subject)
    else:
        cmd_candidates(args.subject)
    return 0


if __name__ == "__main__":
    sys.exit(main())
