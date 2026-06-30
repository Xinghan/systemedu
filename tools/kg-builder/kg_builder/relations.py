"""节点间关系批处理 (spec 041 里程碑3).

对图谱所有有 QID 的节点拉 Wikidata 本体论关系 (P279/P361/P527), 把 target 映射到
图谱内节点 (映射不到 = 悬空边, 是"该补此节点"的扩展信号), 写进节点的 related 字段。
"""
from __future__ import annotations

import json
from pathlib import Path

from kg_builder.wikidata import fetch_relations, qid_exists


def enrich_relations(tree: dict, fetch_fn=fetch_relations, label_fn=qid_exists) -> dict:
    """给 tree(dict) 所有有 qid 的节点填 related 字段。原地修改 tree, 返回统计。

    fetch_fn/label_fn 可注入便于测试 (默认真实拉网络)。
    label_fn(qid) -> (exists, label)。
    """
    # qid -> node_id 索引 (图谱内有哪些 QID)
    qid_to_node = {}
    for s in tree["subjects"]:
        for n in s["nodes"]:
            if n.get("wikidata_qid"):
                qid_to_node[n["wikidata_qid"]] = n["id"]

    label_cache: dict[str, str | None] = {}

    def get_label(qid):
        if qid not in label_cache:
            _ok, lbl = label_fn(qid)
            label_cache[qid] = lbl
        return label_cache[qid]

    processed = internal = dangling = 0
    for s in tree["subjects"]:
        for n in s["nodes"]:
            qid = n.get("wikidata_qid")
            if not qid:
                continue
            processed += 1
            edges = []
            for rel in fetch_fn(qid):
                tqid = rel["target_qid"]
                tnode = qid_to_node.get(tqid)
                if tnode == n["id"]:
                    continue  # 自环跳过
                edges.append({
                    "target_qid": tqid,
                    "target_label": get_label(tqid) or "",
                    "target_node_id": tnode,
                    "rel_type": rel["rel_type"],
                    "source": rel["source"],
                })
                if tnode:
                    internal += 1
                else:
                    dangling += 1
            n["related"] = edges

    return {"nodes_processed": processed, "internal_edges": internal,
            "dangling_edges": dangling}


def enrich_tree_file(tree_path: Path) -> dict:
    """对 platform_tree.json 跑关系批处理, 校验后落盘。"""
    from course_factory.knowledge_tree.schema import PlatformTree
    data = json.loads(tree_path.read_text(encoding="utf-8"))
    stats = enrich_relations(data)
    PlatformTree(**data)  # 校验
    tree_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return stats
