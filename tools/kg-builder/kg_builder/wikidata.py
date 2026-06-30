"""Wikidata QID 回查 (spec 041 准入闸门第一道).

回查 QID 是否真实存在于 Wikidata。LLM 生成 QID 时约 4.5% 是编造的
(spec 041 实测 425 节点 19 个 NOTFOUND), 这道回查负责挡掉它们。
"""
from __future__ import annotations

import json
import time
import urllib.request

UA = "SystemEdu-kg-builder/1.0 (educational knowledge graph)"
_cache: dict[str, tuple[bool, str | None]] = {}


def _fetch_entity(qid: str) -> dict:
    """真实网络请求 Wikidata 实体 JSON。限速放这里, mock 此函数即可跳过网络+sleep。"""
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    time.sleep(0.2)  # 礼貌限速 (仅真实网络路径)
    return data


def qid_exists(qid: str) -> tuple[bool, str | None]:
    """回查 QID 是否真实存在于 Wikidata, 返回 (存在?, 英文label)."""
    if not qid or not qid.startswith("Q"):
        return False, None
    if qid in _cache:
        return _cache[qid]
    try:
        data = _fetch_entity(qid)
        ent = data.get("entities", {}).get(qid, {})
        if "missing" in ent:
            result = (False, None)
        else:
            label = ent.get("labels", {}).get("en", {}).get("value")
            result = (True, label)
    except Exception:
        result = (False, None)
    _cache[qid] = result
    return result
