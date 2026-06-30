"""三道准入闸 (spec 041): Wikidata回查 / 有锚点 / 去重.

每个候选节点要进图谱, 必须过全部三道闸, 否则拒。防 LLM 编造 QID 和灌水野概念。
"""
from __future__ import annotations

from dataclasses import dataclass

from kg_builder.wikidata import qid_exists


@dataclass
class GateResult:
    passed: bool
    verified: bool          # QID 经回查确认存在
    reason: str             # 通过="ok"; 拒绝原因 "duplicate"/"no_anchor"
    qid_label: str | None = None


def gate_candidate(cand: dict, existing_ids: set[str],
                   qid_prechecked: bool = False) -> GateResult:
    """对一个候选节点跑三道闸. cand 需含 node_id / qid / std_codes.

    qid_prechecked=True: 调用方已确认 qid 存在 (如来自 search_qid 的返回),
    跳过 qid_exists 回查 — 避免每候选重复打网络 (spec 041 限流优化)。
    """
    nid = cand["node_id"]
    # 闸3: 去重 (放最前, 省掉对重复节点的网络回查)
    if nid in existing_ids:
        return GateResult(False, False, "duplicate")

    qid = (cand.get("qid") or "").strip()
    std_codes = cand.get("std_codes") or []

    # 闸1: QID 回查 (search_qid 已证存在则跳过)
    verified, label = (False, None)
    if qid:
        if qid_prechecked:
            verified = True
        else:
            verified, label = qid_exists(qid)

    # 闸2: 有锚点 (verified QID 或 标准码 至少其一)
    if not verified and not std_codes:
        return GateResult(False, False, "no_anchor")

    return GateResult(True, verified, "ok", label)
