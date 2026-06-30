"""节点间关系批处理 (spec 041 里程碑3).

对图谱所有有 QID 的节点拉 Wikidata 本体论关系 (P279/P361/P527), 把 target 映射到
图谱内节点 (映射不到 = 悬空边, 是"该补此节点"的扩展信号), 写进节点的 related 字段。
"""
from __future__ import annotations

import json
from pathlib import Path

from kg_builder.wikidata import batch_labels, fetch_relations


def enrich_relations(tree: dict, fetch_fn=fetch_relations, label_batch_fn=batch_labels,
                     only_subjects: set[str] | None = None) -> dict:
    """给 tree(dict) 所有有 qid 的节点填 related 字段。原地修改 tree, 返回统计。

    两阶段 (避免逐 target 打网络): 先拉所有节点的关系收集 target_qid,
    再 batch_labels 一次性取全部 label, 最后填 label 写 related。
    only_subjects: 限定只对这些学科的节点拉关系 (None=全部); 但 qid 索引始终用全图,
                   故跨学科关系也能连上。便于逐学科推进。
    fetch_fn/label_batch_fn 可注入便于测试。label_batch_fn(qids) -> {qid: label}。
    """
    # qid -> node_id 索引 (始终用全图, 跨学科 target 也能映射)
    qid_to_node = {}
    for s in tree["subjects"]:
        for n in s["nodes"]:
            if n.get("wikidata_qid"):
                qid_to_node[n["wikidata_qid"]] = n["id"]

    # 阶段1: 拉节点关系 (暂不填 label), 收集所有 target_qid
    node_edges: dict[str, list] = {}
    all_targets: set[str] = set()
    processed = 0
    for s in tree["subjects"]:
        if only_subjects is not None and s["id"] not in only_subjects:
            continue
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
                edges.append({"target_qid": tqid, "target_node_id": tnode,
                              "rel_type": rel["rel_type"], "source": rel["source"]})
                all_targets.add(tqid)
            node_edges[n["id"]] = edges

    # 阶段2: 批量取所有 target 的 label
    labels = label_batch_fn(sorted(all_targets)) if all_targets else {}

    # 阶段3: 填 label 写回节点
    internal = dangling = 0
    for s in tree["subjects"]:
        for n in s["nodes"]:
            if n["id"] not in node_edges:
                continue
            edges = node_edges[n["id"]]
            for e in edges:
                e["target_label"] = labels.get(e["target_qid"], "")
                if e["target_node_id"]:
                    internal += 1
                else:
                    dangling += 1
            # 字段顺序整理
            n["related"] = [{"target_qid": e["target_qid"], "target_label": e["target_label"],
                             "target_node_id": e["target_node_id"], "rel_type": e["rel_type"],
                             "source": e["source"]} for e in edges]

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
