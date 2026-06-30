"""kg-builder 合入测试 (spec 041)."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "kg-builder"))
from kg_builder.merge import merge_nodes
from course_factory.knowledge_tree.schema import PlatformTree


def _minimal_tree() -> dict:
    return {
        "schema_version": "1.0",
        "subjects": [{
            "id": "math", "name_zh": "数学", "name_en": "Mathematics", "color": "#527B95",
            "nodes": [{
                "id": "math.arith.add", "name_zh": "加法", "name_en": "Addition",
                "depth_level": "K1", "prerequisites": [], "description": "加法",
            }],
        }],
    }


def test_merge_adds_new_node(tmp_path):
    p = tmp_path / "tree.json"
    p.write_text(json.dumps(_minimal_tree()), encoding="utf-8")
    new = [{
        "id": "math.algebra.linear_eq", "name_zh": "一次方程", "name_en": "Linear Equation",
        "depth_level": "K7", "prerequisites": [], "description": "解一元一次方程",
        "wikidata_qid": "Q11348", "std_codes": ["CCSS.Math.8.EE.C.7"],
        "mapping_type": "exact", "provenance": "kg-builder-v1", "verified": True,
    }]
    merge_nodes(p, "math", new)
    tree = PlatformTree(**json.loads(p.read_text(encoding="utf-8")))
    assert tree.total_node_count() == 2
    node = tree.find_node("math.algebra.linear_eq")
    assert node.wikidata_qid == "Q11348"
    assert node.verified is True


def test_merge_backfills_existing_node(tmp_path):
    # 对已存在节点: 不新增, 只回填锚点字段
    p = tmp_path / "tree.json"
    p.write_text(json.dumps(_minimal_tree()), encoding="utf-8")
    backfill = [{
        "id": "math.arith.add", "name_zh": "加法", "name_en": "Addition",
        "depth_level": "K1", "prerequisites": [], "description": "加法",
        "wikidata_qid": "Q32043", "mapping_type": "exact", "provenance": "seed", "verified": True,
    }]
    merge_nodes(p, "math", backfill)
    tree = PlatformTree(**json.loads(p.read_text(encoding="utf-8")))
    assert tree.total_node_count() == 1  # 没新增
    assert tree.find_node("math.arith.add").wikidata_qid == "Q32043"


def test_merge_result_passes_schema_validation(tmp_path):
    # 合入后整树必须仍过 schema 全部校验 (环检测/prereq同学科)
    p = tmp_path / "tree.json"
    p.write_text(json.dumps(_minimal_tree()), encoding="utf-8")
    new = [{
        "id": "math.algebra.linear_eq", "name_zh": "一次方程", "name_en": "Linear Equation",
        "depth_level": "K7", "prerequisites": ["math.arith.add"], "description": "解方程",
        "wikidata_qid": "Q11348", "mapping_type": "exact", "provenance": "kg-builder-v1", "verified": True,
    }]
    merge_nodes(p, "math", new)
    # 不抛 = 过校验
    PlatformTree(**json.loads(p.read_text(encoding="utf-8")))
