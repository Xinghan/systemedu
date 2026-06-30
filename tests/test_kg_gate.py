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
