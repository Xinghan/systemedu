"""审批后清单合入 platform_tree.json (spec 041 Step5).

- id 已存在 -> 只回填锚点字段 (不改 name/depth/prereq)
- id 不存在 -> 追加为新节点
合入后用 PlatformTree 校验 (不过则抛, 不落盘), 保证整树始终合法。
"""
from __future__ import annotations

import json
from pathlib import Path

from course_factory.knowledge_tree.schema import PlatformTree

ANCHOR_FIELDS = ("wikidata_qid", "std_codes", "mapping_type", "provenance", "verified")


def merge_nodes(tree_path: Path, subject_id: str, nodes: list[dict]) -> None:
    """把审批过的 nodes 合入 subject_id 学科。校验通过才落盘。"""
    data = json.loads(tree_path.read_text(encoding="utf-8"))
    subj = next((s for s in data["subjects"] if s["id"] == subject_id), None)
    if subj is None:
        raise ValueError(f"subject {subject_id} 不存在")

    existing = {n["id"]: n for n in subj["nodes"]}
    for nd in nodes:
        nid = nd["id"]
        if nid in existing:
            for f in ANCHOR_FIELDS:
                if f in nd:
                    existing[nid][f] = nd[f]
        else:
            subj["nodes"].append(nd)

    # 校验 (不过抛异常, 不落盘)
    PlatformTree(**data)
    tree_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
