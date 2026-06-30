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


def _search_entities(term: str, limit: int) -> list[dict]:
    """真实网络: Wikidata wbsearchentities 按名搜实体。"""
    import urllib.parse
    q = urllib.parse.quote(term)
    url = (f"https://www.wikidata.org/w/api.php?action=wbsearchentities"
           f"&search={q}&language=en&format=json&limit={limit}")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    time.sleep(0.2)
    return data.get("search", [])


# spec 041 里程碑3: search_qid 重试退避 + 进程内缓存 (防 Wikidata 限流丢结果)
# spec 041 第1步优化: 11 agent 并行打 Wikidata 必触发限流, 原 3s*线性*4 = 最坏 18s/词,
# 20 词候选生成步超 10min 工具超时被杀。降退避 + 加单词总预算上限, 保单步不超时。
_search_cache: dict[str, list[dict]] = {}
_RETRY_SLEEP = 1.5   # 被限流时退避基数 (秒); 测试 monkeypatch 为 0
_MAX_RETRY = 3       # 最坏退避 1.5+3 = 4.5s/词 (原 18s)
_WORD_BUDGET = 8.0   # 单个词累计退避超此预算就放弃 (返回空走 broader), 不无限拖


def search_qid(term: str, limit: int = 5) -> list[dict]:
    """按英文概念名搜 Wikidata, 返回候选 [{id,label,description}, ...] 按相关度排序。

    比凭记忆给 QID 号可靠: LLM 和人都常记错号 (spec 041 实测), 但按名搜
    第一条通常正确。调用方仍需核对 label 语义匹配。
    带重试退避(被限流时等待重试而非丢结果) + 进程内缓存(重复词不重打网络)。
    单词退避有总预算 (_WORD_BUDGET): 超预算放弃返回空, 让调用方走 broader,
    避免单步候选生成因累计退避超 10min 工具超时被杀 (spec 041 第1步实测)。
    """
    if not term:
        return []
    if term in _search_cache:
        return _search_cache[term]
    hits = []
    spent = 0.0
    for attempt in range(_MAX_RETRY):
        try:
            raw = _search_entities(term, limit)
            hits = [{"id": h.get("id"), "label": h.get("label"),
                     "description": h.get("description", "")} for h in raw]
            break
        except Exception:
            if attempt < _MAX_RETRY - 1:
                wait = _RETRY_SLEEP * (attempt + 1)  # 线性退避
                if spent + wait > _WORD_BUDGET:
                    break  # 超总预算, 放弃 (返回空, 走 broader)
                time.sleep(wait)
                spent += wait
    _search_cache[term] = hits
    return hits


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


def _get_entities(ids: list[str]) -> dict:
    """真实网络: wbgetentities 一次批量取多个实体的 labels (最多50)."""
    url = ("https://www.wikidata.org/w/api.php?action=wbgetentities"
           f"&ids={'|'.join(ids)}&props=labels&languages=en&format=json")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = json.loads(r.read().decode("utf-8"))
    time.sleep(0.2)
    return data


def batch_labels(qids: list[str]) -> dict[str, str]:
    """批量取一组 QID 的英文 label, 返回 {qid: label}. 比逐个 qid_exists 快 ~50x.

    自动分批 50 个/请求 (Wikidata wbgetentities 上限)。
    """
    out: dict[str, str] = {}
    uniq = [q for q in dict.fromkeys(qids) if q and q.startswith("Q")]
    for i in range(0, len(uniq), 50):
        batch = uniq[i:i + 50]
        try:
            data = _get_entities(batch)
        except Exception:
            continue
        for qid, ent in data.get("entities", {}).items():
            out[qid] = ent.get("labels", {}).get("en", {}).get("value", "")
    return out


# Wikidata 本体论关系属性 -> 我们的 rel_type (spec 041 里程碑3)
_REL_PROPS = {
    "P279": "subclass_of",
    "P361": "part_of",
    "P527": "has_part",
}


def fetch_relations(qid: str) -> list[dict]:
    """拉 QID 的本体论关系 (P279/P361/P527), 返回 [{rel_type, target_qid, source}, ...].

    target_label/target_node_id 由调用方批处理时用 qid->node 索引补 (避免逐边再打网络)。
    """
    if not qid or not qid.startswith("Q"):
        return []
    try:
        data = _fetch_entity(qid)
    except Exception:
        return []
    claims = data.get("entities", {}).get(qid, {}).get("claims", {})
    out = []
    for prop, rel_type in _REL_PROPS.items():
        for v in claims.get(prop, []):
            try:
                tgt = v["mainsnak"]["datavalue"]["value"]["id"]
            except (KeyError, TypeError):
                continue
            out.append({"rel_type": rel_type, "target_qid": tgt, "source": f"wikidata:{prop}"})
    return out
