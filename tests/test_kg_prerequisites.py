"""LLM 补 prerequisites 的过滤逻辑测试 (spec 041 里程碑3)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "kg-builder"))
from course_factory.knowledge_tree.schema import TreeNode


class _FakeResp:
    def __init__(self, content):
        self.content = content


class _FakeLLM:
    def __init__(self, payload):
        self.payload = payload

    def invoke(self, _msgs):
        return _FakeResp(self.payload)


def _nodes():
    return [
        TreeNode(id="math.arith.add", name_zh="加法", name_en="add", depth_level="K1", description="x"),
        TreeNode(id="math.geom.circle", name_zh="圆", name_en="circle", depth_level="K9", description="x"),
        TreeNode(id="math.geom.conic", name_zh="圆锥曲线", name_en="conic", depth_level="K11", description="x"),
        TreeNode(id="phys.x.y", name_zh="物理", name_en="p", depth_level="K7", description="x"),
    ]


def test_prereq_filters_invalid(monkeypatch):
    from kg_builder import prerequisites
    # LLM 给 conic 4个前置: circle(合法) / add(合法,depth低) / phys.x.y(跨学科,剔) / nonexist(不存在,剔)
    payload = ('{"prerequisites": {"math.geom.conic": '
               '["math.geom.circle", "math.arith.add", "phys.x.y", "math.geom.nonexist"]}}')
    monkeypatch.setattr(prerequisites, "get_llm", lambda **k: _FakeLLM(payload))

    nodes = _nodes()
    conic = nodes[2]
    result = prerequisites.suggest_prerequisites("math", [conic], nodes)
    prereqs = result["math.geom.conic"]
    assert "math.geom.circle" in prereqs       # 合法
    assert "math.arith.add" in prereqs         # 合法(depth更低)
    assert "phys.x.y" not in prereqs           # 跨学科剔除
    assert "math.geom.nonexist" not in prereqs # 不存在剔除


def test_prereq_filters_higher_depth(monkeypatch):
    from kg_builder import prerequisites
    # 给 add(K1) 一个 depth 更高的前置 circle(K9) -> 应剔除 (前置不能比目标深)
    payload = '{"prerequisites": {"math.arith.add": ["math.geom.circle"]}}'
    monkeypatch.setattr(prerequisites, "get_llm", lambda **k: _FakeLLM(payload))
    nodes = _nodes()
    result = prerequisites.suggest_prerequisites("math", [nodes[0]], nodes)
    assert result["math.arith.add"] == []  # circle(K9) > add(K1), 剔除
