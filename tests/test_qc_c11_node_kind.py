"""C11 节点性质判定 (_classify_node_kind) 回归测试。

背景: qc_gatekeeper C11 按 F4.0 关键词把节点分成 C(总览/路线图, 必须 static_infographic) /
D(纯文本) / AB(现象/机制, autoplay 多帧合法)。"doi/zenodo/阅读/论文" 是弱关键词, 只有与真正的
总览/路线图强信号同现时才按 C 类处理 — 防止 M46(申请 DOI 机制)、M47(按论文格式写报告机制)
这类 B 类机制节点被误判为 C 类而要求 static_infographic。
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "course_factory"))

from qc.qc_gatekeeper import _classify_node_kind  # noqa: E402


def test_m47_paper_format_writing_is_AB_not_C():
    """M47: '按科研论文格式写报告 (IMRaD)' 命中弱词'论文', 但无总览强信号 -> B 类机制, 非 C。"""
    blob = (
        "写一份 field report (3 页 IMRaD 格式) "
        "科学家是怎么把一个项目写成一篇正式报告的? "
        "按科研论文格式 (摘要/方法/结果/讨论, IMRaD) 写一份 3 页 field report"
    )
    kind, matched = _classify_node_kind(blob)
    assert kind == "AB", f"M47 应为 AB(机制类), 实际 {kind} matched={matched}"


def test_m46_doi_application_is_AB_not_C():
    """M46: 在 Zenodo 给数据集申请 DOI, 命中弱词'doi/zenodo' 但无总览强信号 -> B 类机制。"""
    blob = "给你的公开数据集申请一个真实的永久编号 DOI 用 Zenodo 仓库"
    kind, matched = _classify_node_kind(blob)
    assert kind == "AB", f"M46 应为 AB(机制类), 实际 {kind} matched={matched}"


def test_weak_keyword_with_overview_strong_signal_is_C():
    """弱词'论文/阅读'与总览强信号'路线图'同现 -> 仍按 C 类(真正的阅读论文路线图节点)。"""
    blob = "项目路线图: 这一周我们一起阅读一篇真实的科研论文, 看科学家怎么组织 overview"
    kind, matched = _classify_node_kind(blob)
    assert kind == "C", f"路线图+阅读论文 应为 C 类, 实际 {kind} matched={matched}"
    # 弱词应被一并记入 matched (与强信号同现时追加)
    assert "论文" in matched and "阅读" in matched


def test_pure_overview_roadmap_is_C():
    """纯总览/路线图节点 (无弱词) -> C 类。"""
    kind, matched = _classify_node_kind("项目总览与 26 周路线图: 目标墙和起点介绍")
    assert kind == "C", f"总览节点应为 C, 实际 {kind} matched={matched}"


def test_reflection_is_D():
    """反思/家访类 -> D 类纯文本。"""
    kind, matched = _classify_node_kind("写一篇项目反思感想, 聊聊这次家访的收获")
    assert kind == "D", f"反思类应为 D, 实际 {kind} matched={matched}"


def test_phenomenon_mechanism_is_AB():
    """普通现象/机制节点 (无任何关键词) -> AB 类, autoplay 合法。"""
    kind, matched = _classify_node_kind("PMS5003 激光散射如何把颗粒物变成电信号")
    assert kind == "AB", f"现象节点应为 AB, 实际 {kind} matched={matched}"
    assert matched == []


def test_d_takes_priority_over_c():
    """D 优先于 C: 反思类即使蹭到 C 强词'介绍', 仍按 D 处理。"""
    kind, matched = _classify_node_kind("介绍一下, 然后写一篇反思感想")
    assert kind == "D", f"含反思应优先判 D, 实际 {kind} matched={matched}"
