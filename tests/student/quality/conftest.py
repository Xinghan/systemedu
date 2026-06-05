"""L3 质量层 — artifact 落盘。"""
from __future__ import annotations
import json
from pathlib import Path
import pytest

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "_artifacts" / "quality"


@pytest.fixture
def dump_artifact():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    def _dump(scenario, turns, injected_context, recalled_facts):
        payload = {
            "scenario": scenario,
            "turns": turns,
            "injected_context": injected_context,
            "recalled_facts": recalled_facts,
        }
        out = ARTIFACT_DIR / f"{scenario}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return out

    return _dump
