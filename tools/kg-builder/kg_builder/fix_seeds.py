"""里程碑2 (spec 041): 把 qid_verify.csv 的种子映射回填进 platform_tree.json.

- OK/SUSPECT 行: 回填 wikidata_qid + mapping_type + verified(OK=True/SUSPECT=False)
- NOTFOUND 行: 跳过回填 (QID 是 LLM 编造的), 输出到 _notfound_todo.csv 待人工重映射
- SKIP 行 (mapping_type=none): 不回填 QID, 只标 mapping_type=none + provenance

回填后用 PlatformTree 校验, 不过不落盘。
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
VERIFY_CSV = REPO / "projects_data" / "_review" / "qid_verify.csv"
TREE = REPO / "course_factory" / "knowledge_tree" / "platform_tree.json"
TODO = REPO / "projects_data" / "_review" / "_notfound_todo.csv"


def run() -> dict:
    rows = list(csv.DictReader(open(VERIFY_CSV, encoding="utf-8")))
    by_id = {r["node_id"]: r for r in rows}
    data = json.loads(TREE.read_text(encoding="utf-8"))

    filled = notfound = skipped = 0
    notfound_rows = []
    for subj in data["subjects"]:
        for n in subj["nodes"]:
            r = by_id.get(n["id"])
            if not r:
                continue
            flag = r["verify_flag"]
            if flag == "NOTFOUND":
                notfound += 1
                notfound_rows.append(r)
                continue
            if flag == "SKIP":
                # mapping_type=none: 无 Wikidata 对应是合理的, 标记来源但不填假 QID
                n["mapping_type"] = "none"
                n["provenance"] = "seed"
                skipped += 1
                continue
            n["wikidata_qid"] = r["qid"]
            n["mapping_type"] = r["mapping_type"]
            n["provenance"] = "seed"
            n["verified"] = (flag == "OK")
            filled += 1

    # 校验后落盘
    from course_factory.knowledge_tree.schema import PlatformTree
    PlatformTree(**data)
    TREE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    if notfound_rows:
        with open(TODO, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(notfound_rows[0].keys()))
            w.writeheader()
            w.writerows(notfound_rows)

    return {"filled": filled, "notfound": notfound, "skipped": skipped, "todo_csv": str(TODO)}


if __name__ == "__main__":
    print(run())
