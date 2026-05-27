"""平台知识树 schema 测试 (spec 035 T1.3)."""

import json

import pytest

from course_factory.knowledge_tree.schema import (
    PlatformTree,
    Subject,
    TreeNode,
    load_platform_tree,
)


def _make_minimal_tree() -> dict:
    return {
        "schema_version": "1.0",
        "subjects": [
            {
                "id": "math",
                "name_zh": "数学",
                "name_en": "Mathematics",
                "color": "#527B95",
                "nodes": [
                    {
                        "id": "math.arith.add_sub",
                        "name_zh": "加减法",
                        "name_en": "Addition & Subtraction",
                        "depth_level": "K1",
                        "prerequisites": [],
                        "description": "正整数加减, 进位/借位",
                    },
                    {
                        "id": "math.arith.mult_div",
                        "name_zh": "乘除法",
                        "name_en": "Multiplication & Division",
                        "depth_level": "K3",
                        "prerequisites": ["math.arith.add_sub"],
                        "description": "九九乘法 + 除法",
                    },
                ],
            },
        ],
    }


def test_minimal_tree_parses():
    t = PlatformTree(**_make_minimal_tree())
    assert t.schema_version == "1.0"
    assert len(t.subjects) == 1
    assert t.total_node_count() == 2


def test_find_node():
    t = PlatformTree(**_make_minimal_tree())
    n = t.find_node("math.arith.add_sub")
    assert n is not None
    assert n.depth_level == "K1"


def test_get_subject():
    t = PlatformTree(**_make_minimal_tree())
    s = t.get_subject("math")
    assert s is not None
    assert s.id == "math"


def test_invalid_node_id_prefix():
    data = _make_minimal_tree()
    data["subjects"][0]["nodes"][0]["id"] = "wrong.arith.add_sub"
    with pytest.raises(ValueError, match=r"must start with 'math\.'"):
        PlatformTree(**data)


def test_cross_subject_prereq_forbidden():
    data = _make_minimal_tree()
    data["subjects"][0]["nodes"][0]["prerequisites"] = ["phys.kinematics.velocity"]
    with pytest.raises(ValueError, match=r"跨学科, 禁止"):
        PlatformTree(**data)


def test_missing_prereq():
    data = _make_minimal_tree()
    data["subjects"][0]["nodes"][1]["prerequisites"] = ["math.arith.missing"]
    with pytest.raises(ValueError, match=r"不存在于学科 math"):
        PlatformTree(**data)


def test_cycle_detected():
    data = _make_minimal_tree()
    # 给 add_sub 加 mult_div 作为 prereq, 形成环
    data["subjects"][0]["nodes"][0]["prerequisites"] = ["math.arith.mult_div"]
    with pytest.raises(ValueError, match=r"prereq 成环"):
        PlatformTree(**data)


def test_duplicate_subject_id():
    data = _make_minimal_tree()
    data["subjects"].append(data["subjects"][0])
    with pytest.raises(ValueError, match=r"subject id 重复"):
        PlatformTree(**data)


def test_invalid_color():
    data = _make_minimal_tree()
    data["subjects"][0]["color"] = "blue"
    with pytest.raises(ValueError):
        PlatformTree(**data)


def test_invalid_depth_level():
    data = _make_minimal_tree()
    data["subjects"][0]["nodes"][0]["depth_level"] = "K2"
    with pytest.raises(ValueError):
        PlatformTree(**data)


# 真实 platform_tree.json 完工后 enable:
@pytest.mark.skipif(
    not __import__("pathlib").Path(
        "/Users/xinghan/Dev/systemedu/course_factory/knowledge_tree/platform_tree.json"
    ).exists(),
    reason="platform_tree.json not yet written",
)
def test_real_platform_tree_loads():
    t = load_platform_tree()
    assert t.schema_version == "1.0"
    # 11 学科 (spec 035 plan)
    assert len(t.subjects) == 11
    # ~425 节点
    n = t.total_node_count()
    assert 300 <= n <= 600, f"expected 300-600 nodes, got {n}"
    # 学科 ID 全在白名单
    valid_ids = {"math", "phys", "chem", "bio", "cs", "elec", "env", "astro", "med", "eng", "geo"}
    for s in t.subjects:
        assert s.id in valid_ids
