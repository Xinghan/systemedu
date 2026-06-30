"""kg-builder 闸门测试 (spec 041)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "kg-builder"))
from kg_builder.wikidata import qid_exists


def test_qid_exists_true(monkeypatch):
    # mock urllib 返回有效实体
    def fake_fetch(qid):
        return {"entities": {qid: {"id": qid, "labels": {"en": {"value": "linear algebra"}}}}}
    monkeypatch.setattr("kg_builder.wikidata._fetch_entity", fake_fetch)
    monkeypatch.setattr("kg_builder.wikidata._cache", {})
    ok, label = qid_exists("Q190524")
    assert ok is True
    assert label == "linear algebra"


def test_qid_exists_false(monkeypatch):
    # mock urllib 返回空 (不存在的 QID)
    def fake_fetch(qid):
        return {"entities": {qid: {"missing": ""}}}
    monkeypatch.setattr("kg_builder.wikidata._fetch_entity", fake_fetch)
    monkeypatch.setattr("kg_builder.wikidata._cache", {})
    ok, label = qid_exists("Q999999999")
    assert ok is False
    assert label is None


def test_search_qid_retries_on_failure(monkeypatch):
    from kg_builder import wikidata
    wikidata._search_cache.clear()
    calls = {"n": 0}
    def flaky(term, limit):
        calls["n"] += 1
        if calls["n"] < 3:
            raise OSError("rate limited")
        return [{"id": "Q178947", "label": "operational amplifier", "description": "x"}]
    monkeypatch.setattr("kg_builder.wikidata._search_entities", flaky)
    monkeypatch.setattr("kg_builder.wikidata._RETRY_SLEEP", 0)  # 测试不真等
    hits = wikidata.search_qid("operational amplifier")
    assert hits[0]["id"] == "Q178947"
    assert calls["n"] == 3  # 重试到第3次成功


def test_search_qid_caches_result(monkeypatch):
    from kg_builder import wikidata
    wikidata._search_cache.clear()
    calls = {"n": 0}
    def counting(term, limit):
        calls["n"] += 1
        return [{"id": "Q1", "label": "x", "description": ""}]
    monkeypatch.setattr("kg_builder.wikidata._search_entities", counting)
    wikidata.search_qid("foo")
    wikidata.search_qid("foo")  # 第二次应命中缓存
    assert calls["n"] == 1


def test_search_qid_returns_top_match(monkeypatch):
    from kg_builder.wikidata import search_qid
    def fake_search(term, limit):
        return [{"id": "Q178947", "label": "operational amplifier",
                 "description": "high-gain voltage amplifier"}]
    monkeypatch.setattr("kg_builder.wikidata._search_entities", fake_search)
    hits = search_qid("operational amplifier")
    assert hits[0]["id"] == "Q178947"
    assert hits[0]["label"] == "operational amplifier"


def test_batch_labels_maps_ids(monkeypatch):
    from kg_builder.wikidata import batch_labels
    def fake_get(ids):
        return {"entities": {
            "Q17278": {"labels": {"en": {"value": "circle"}}},
            "Q11348": {"labels": {"en": {"value": "equation"}}},
        }}
    monkeypatch.setattr("kg_builder.wikidata._get_entities", fake_get)
    out = batch_labels(["Q17278", "Q11348"])
    assert out["Q17278"] == "circle"
    assert out["Q11348"] == "equation"


def test_fetch_relations_parses_p279_p527(monkeypatch):
    from kg_builder.wikidata import fetch_relations
    def fake_fetch(qid):
        return {"entities": {qid: {"claims": {
            "P279": [{"mainsnak": {"datavalue": {"value": {"id": "Q11348"}}}}],
            "P527": [{"mainsnak": {"datavalue": {"value": {"id": "Q17278"}}}}],
        }}}}
    monkeypatch.setattr("kg_builder.wikidata._fetch_entity", fake_fetch)
    rels = fetch_relations("Q124255")
    types = {(r["rel_type"], r["target_qid"]) for r in rels}
    assert ("subclass_of", "Q11348") in types
    assert ("has_part", "Q17278") in types


def test_fetch_relations_empty_when_no_claims(monkeypatch):
    from kg_builder.wikidata import fetch_relations
    monkeypatch.setattr("kg_builder.wikidata._fetch_entity",
                        lambda qid: {"entities": {qid: {"claims": {}}}})
    assert fetch_relations("Q1") == []


from kg_builder.gate import gate_candidate, GateResult


def test_gate_passes_valid_candidate(monkeypatch):
    monkeypatch.setattr("kg_builder.gate.qid_exists", lambda q: (True, "linear algebra"))
    cand = {"node_id": "math.algebra.new_concept", "qid": "Q190524", "std_codes": []}
    res = gate_candidate(cand, existing_ids={"math.arith.add"})
    assert res.passed is True
    assert res.verified is True


def test_gate_rejects_fake_qid_no_stdcode(monkeypatch):
    # QID 回查失败 + 无标准码 -> 拒
    monkeypatch.setattr("kg_builder.gate.qid_exists", lambda q: (False, None))
    cand = {"node_id": "math.algebra.fake", "qid": "Q999999999", "std_codes": []}
    res = gate_candidate(cand, existing_ids=set())
    assert res.passed is False
    assert "no_anchor" in res.reason


def test_gate_rejects_duplicate(monkeypatch):
    monkeypatch.setattr("kg_builder.gate.qid_exists", lambda q: (True, "linear algebra"))
    cand = {"node_id": "math.arith.add", "qid": "Q190524", "std_codes": []}
    res = gate_candidate(cand, existing_ids={"math.arith.add"})
    assert res.passed is False
    assert "duplicate" in res.reason


def test_gate_passes_stdcode_only_when_qid_fails(monkeypatch):
    # QID 回查失败但有标准码 -> 仍过 (锚点=标准码), verified=False
    monkeypatch.setattr("kg_builder.gate.qid_exists", lambda q: (False, None))
    cand = {"node_id": "math.algebra.x", "qid": "", "std_codes": ["CCSS.Math.8.EE.C.7"]}
    res = gate_candidate(cand, existing_ids=set())
    assert res.passed is True
    assert res.verified is False
