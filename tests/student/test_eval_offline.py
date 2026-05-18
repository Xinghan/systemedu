"""spec 031 P7: judge parser + dataset 完整性 unit (不调真 LLM, 可进 CI)."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from langchain_core.messages import AIMessage


DATASET_FILE = Path(__file__).resolve().parent.parent / "eval" / "dataset.yaml"


# ----------- dataset 完整性 -----------

def test_dataset_loads():
    with DATASET_FILE.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert "cases" in data
    assert len(data["cases"]) >= 10


def test_dataset_required_fields():
    cases = yaml.safe_load(DATASET_FILE.read_text(encoding="utf-8"))["cases"]
    seen_ids = set()
    for c in cases:
        for req in ("id", "page_kind", "question", "expected_facets"):
            assert req in c, f"case missing {req}: {c}"
        assert c["id"] not in seen_ids, f"dup id {c['id']}"
        seen_ids.add(c["id"])
        assert c["page_kind"] in ("global", "home", "library_detail", "learn")
        if c["page_kind"] == "learn":
            assert c.get("module_id"), f"{c['id']}: learn 需要 module_id"
            assert c.get("library_slug"), f"{c['id']}: learn 需要 library_slug"
        if c["page_kind"] == "library_detail":
            assert c.get("library_slug")


# ----------- judge parser -----------

class FakeLLM:
    def __init__(self, content):
        self.content = content

    async def ainvoke(self, msgs):
        return AIMessage(content=self.content)


async def test_judge_parses_valid_json():
    from tests.eval.judge import judge
    llm = FakeLLM(
        '{"score_relevance": 85, "score_factual": 90, "score_personalization": 70,'
        ' "hit_facets": [0,1], "miss_facets": [2], "hit_bad_facets": [],'
        ' "reason": "答得好"}'
    )
    r = await judge(llm, question="Q", answer="A",
                    expected_facets=["a", "b", "c"], bad_facets=[])
    assert r.score_relevance == 85
    assert r.score_factual == 90
    assert r.score_personalization == 70
    assert r.hit_facets == [0, 1]
    assert r.miss_facets == [2]
    assert r.overall == round((85 + 90 + 70) / 3)


async def test_judge_handles_code_fence():
    from tests.eval.judge import judge
    llm = FakeLLM('```json\n{"score_relevance":50,"score_factual":50,'
                  '"score_personalization":50,"reason":"x"}\n```')
    r = await judge(llm, question="Q", answer="A",
                    expected_facets=[], bad_facets=[])
    assert r.score_relevance == 50


async def test_judge_malformed_returns_zero():
    from tests.eval.judge import judge
    llm = FakeLLM("not json")
    r = await judge(llm, question="Q", answer="A",
                    expected_facets=["x"], bad_facets=[])
    assert r.score_relevance == 0
    assert r.miss_facets == [0]
