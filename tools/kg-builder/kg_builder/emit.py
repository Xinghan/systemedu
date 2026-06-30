"""Step3-4 (spec 041): 给候选搜真实QID + 过三道闸门 + 产待审清单CSV.

输入: LLM 列的候选 (含 name_en, 无 QID)。
流程: 每个候选 search_qid 按 name_en 搜真实QID -> gate_candidate 过闸 -> 过闸的进待审清单。
"""
from __future__ import annotations

import csv
import time
from pathlib import Path

from kg_builder.gate import gate_candidate
from kg_builder.wikidata import search_qid

CSV_FIELDS = [
    "proposed_id", "name_zh", "name_en", "depth_level", "subsector",
    "qid", "qid_label", "std_code", "mapping_type", "verified",
    "gate_status", "reason",
]


def enrich_and_gate(candidates: list[dict], existing_ids: set[str],
                    sleep: float = 1.0) -> tuple[list[dict], list[dict]]:
    """对每个候选: 按 name_en 搜 QID -> 过三道闸. 返回 (过闸rows, 拒绝rows)."""
    passed, rejected = [], []
    for c in candidates:
        nid = c.get("proposed_id", "")
        name_en = c.get("name_en", "")
        std_code = c.get("std_code", "") or ""

        # 按英文名搜真实 QID (取 top 候选). search_qid 自带重试退避+缓存。
        hits = search_qid(name_en, limit=3) if name_en else []
        time.sleep(sleep)
        qid = hits[0]["id"] if hits else ""
        qid_label = hits[0]["label"] if hits else ""

        # 过三道闸. search_qid 搜到 = QID 已证存在, gate 跳过冗余回查 (限流优化, 网络减半)。
        gres = gate_candidate(
            {"node_id": nid, "qid": qid, "std_codes": [std_code] if std_code else []},
            existing_ids,
            qid_prechecked=bool(hits),
        )
        row = {
            "proposed_id": nid, "name_zh": c.get("name_zh", ""), "name_en": name_en,
            "depth_level": c.get("depth_level", ""), "subsector": c.get("subsector", ""),
            "qid": qid if gres.verified else (qid if gres.passed else ""),
            "qid_label": qid_label, "std_code": std_code,
            "mapping_type": "exact" if gres.verified else ("broader" if gres.passed else ""),
            "verified": gres.verified, "gate_status": "PASS" if gres.passed else "REJECT",
            "reason": gres.reason,
        }
        (passed if gres.passed else rejected).append(row)
    return passed, rejected


def write_review_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(rows)
