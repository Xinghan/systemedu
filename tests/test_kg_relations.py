"""kg-builder 关系批处理测试 (spec 041 里程碑3)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "kg-builder"))
from kg_builder.relations import enrich_relations


def _tree():
    return {
        "schema_version": "1.0",
        "subjects": [{
            "id": "math", "name_zh": "数学", "name_en": "Mathematics", "color": "#527B95",
            "nodes": [
                {"id": "math.geom.conic", "name_zh": "圆锥曲线", "name_en": "conic section",
                 "depth_level": "K11", "prerequisites": [], "description": "x",
                 "wikidata_qid": "Q124255"},
                {"id": "math.geom.circle", "name_zh": "圆", "name_en": "circle",
                 "depth_level": "K9", "prerequisites": [], "description": "x",
                 "wikidata_qid": "Q17278"},
                {"id": "math.geom.no_qid", "name_zh": "无", "name_en": "no",
                 "depth_level": "K9", "prerequisites": [], "description": "x"},
            ],
        }],
    }


def test_enrich_relations_maps_internal_and_dangling():
    # conic has_part circle(图谱内) + subclass_of Q999(图谱外悬空)
    def fake_fetch(qid):
        if qid == "Q124255":
            return [
                {"rel_type": "has_part", "target_qid": "Q17278", "source": "wikidata:P527"},
                {"rel_type": "subclass_of", "target_qid": "Q999", "source": "wikidata:P279"},
            ]
        return []
    def fake_batch(qids):
        m = {"Q17278": "circle", "Q999": "external thing"}
        return {q: m.get(q, "") for q in qids}

    tree = _tree()
    stats = enrich_relations(tree, fetch_fn=fake_fetch, label_batch_fn=fake_batch)

    conic = tree["subjects"][0]["nodes"][0]
    rels = conic["related"]
    assert len(rels) == 2
    internal = [r for r in rels if r["target_node_id"]]
    dangling = [r for r in rels if r["target_node_id"] is None]
    assert internal[0]["target_node_id"] == "math.geom.circle"   # 图谱内边
    assert internal[0]["target_label"] == "circle"
    assert dangling[0]["target_qid"] == "Q999"                   # 悬空边
    assert stats["internal_edges"] == 1
    assert stats["dangling_edges"] == 1


def test_enrich_skips_nodes_without_qid():
    tree = _tree()
    stats = enrich_relations(tree, fetch_fn=lambda q: [], label_batch_fn=lambda qs: {})
    # 无 qid 的节点不拉关系, 不报错
    assert tree["subjects"][0]["nodes"][2].get("related", []) == []
    assert stats["nodes_processed"] == 2  # 只处理有qid的2个
