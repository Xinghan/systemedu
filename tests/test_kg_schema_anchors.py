"""TreeNode 锚点字段测试 (spec 041)."""
from course_factory.knowledge_tree.schema import TreeNode, load_platform_tree


def test_treenode_accepts_anchor_fields():
    n = TreeNode(
        id="math.algebra.linear_eq", name_zh="一次方程", name_en="Linear Equation",
        depth_level="K7", description="解一元一次方程",
        wikidata_qid="Q11348", std_codes=["CCSS.Math.8.EE.C.7"],
        mapping_type="exact", provenance="kg-builder-v1", verified=True,
    )
    assert n.wikidata_qid == "Q11348"
    assert n.std_codes == ["CCSS.Math.8.EE.C.7"]
    assert n.verified is True


def test_treenode_anchor_fields_optional():
    # 旧节点不带锚点字段仍能构造 (向后兼容)
    n = TreeNode(id="math.arith.add", name_zh="加法", name_en="Addition",
                 depth_level="K1", description="加法")
    assert n.wikidata_qid is None
    assert n.std_codes == []
    assert n.verified is False


def test_existing_platform_tree_still_loads():
    # 现有 425 节点 platform_tree.json 不带新字段, 必须仍能 load
    tree = load_platform_tree()
    # 图谱随 kg-builder 持续扩建增长 (spec 041 里程碑3起), 不锁死节点数;
    # 425 是种子基线, 只断言不低于基线 + 能正常 load。
    assert tree.total_node_count() >= 425
