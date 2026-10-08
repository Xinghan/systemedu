#!/usr/bin/env python3
"""Create and validate a source-grounded visual routing registry for a course.

This is intentionally conservative: it preserves working interactive surfaces
and dense SVG explanations, and flags only sparse/technical candidates for a
later human-reviewed replacement. It never fabricates chemistry, data, or a
3D asset from keywords alone.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_COURSE_ROOT = REPO_ROOT.parent / "systemeduidea/projects_data/molecule-monster-hunter"
DEFAULT_OUTPUT = REPO_ROOT / "docs/slide-image-prompts/molecule-monster-hunter-visual-registry.json"

TECHNICAL_TERMS = (
    "rdkit", "smiles", "原子", "化学键", "骨架", "官能团", "分子量", "logp", "tanimoto",
    "scaffold", "指纹", "roc", "auc", "lipinski", "描述符", "特征", "分子库", "模型",
    "训练", "测试", "xgboost", "bagging", "boosting", "排名", "阈值", "top 10",
)
EXACT_TERMS = (
    "smiles", "rdkit", "分子量", "logp", "tanimoto", "指纹", "roc", "auc", "lipinski",
    "描述符", "特征", "阈值", "排名", "scaffold",
)
# These are only *review triggers*, never automatic permission to use 3D.
# Terms such as “结合” and “空间” are deliberately excluded: in this course
# they frequently describe a concept or a feature space rather than a 3D view.
SPATIAL_TERMS = ("三维", "3d", "构象", "结合口袋")
SMILES_PATTERN = re.compile(r"(?<![A-Za-z0-9])(?:[BCNOFPSIclbrnops]|\[.+?\])(?:[A-Za-z0-9@+\-#=()\\/\.]+)(?![A-Za-z0-9])")


def compact_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return " ".join(compact_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(compact_text(item) for item in value.values())
    return ""


def terms_in(text: str, terms: tuple[str, ...]) -> list[str]:
    lowered = text.lower()
    return [term for term in terms if term in lowered]


def teaching_relationship(slide: dict[str, Any], text: str) -> str:
    technical = (slide.get("payload") or {}).get("technical_visual") or {}
    if technical.get("renderer") == "regression-evidence":
        return "source prediction/actual pairs, vertical error segments, signed/absolute/squared errors, and exact MAE/RMSE remain synchronized; the learner checks calculations before exporting evidence"
    if technical.get("renderer") == "classification-evidence":
        return "fixed sample labels, prediction counts, confusion matrix, and exact classification metrics remain synchronized; ranking requires separate score evidence"
    if technical.get("renderer") == "code-trace":
        return "code line, current variable state, and observable output advance together through a source-grounded execution trace"
    if technical.get("renderer") == "formula-sequence":
        return "named values advance through an exact source-grounded formula derivation to a checkable result"
    if technical.get("renderer") == "pipeline-contract":
        return "typed outputs advance across pipeline interfaces; feature-column alignment is compared with a source-grounded silent-order mismatch"
    if technical.get("renderer") == "rdkit-2d":
        return "validated SMILES is deterministically translated into molecular connectivity and source-named structural evidence"
    kind = slide.get("kind", "")
    if kind in {"animation", "game"}:
        return "learner interaction or timed state sequence already supplied by the lesson runtime"
    if any(token in text for token in ("→", "变成", "从", "到", "前后", "比较", "对比", "筛选")):
        return "source describes an ordered transformation, comparison, or selection relationship"
    if any(token in text for token in ("表", "矩阵", "清单", "排名", "top")):
        return "source organizes evidence into a discrete table, list, or ranking"
    return "source introduces a concept and requires a source-grounded explanatory relationship"


def classify(slide: dict[str, Any]) -> tuple[str, str, str, str]:
    """Return medium, renderer family, decision reason, and review priority."""
    payload = slide.get("payload") or {}
    kind = slide.get("kind", "")
    semantic_payload = {
        key: value for key, value in payload.items()
        if key not in {"inline_svg", "images", "technical_visual"}
    }
    text = " ".join((slide.get("title", ""), slide.get("audio_script", ""), compact_text(semantic_payload)))
    lowered = text.lower()
    svg = payload.get("inline_svg") or ""
    technical = payload.get("technical_visual")

    if kind in {"animation", "game"} and payload.get("idea_id") and not technical:
        return (
            "interactive-html",
            "existing-lesson-runtime",
            "The source already defines an interaction/state transition; preserve it rather than replacing it with a still.",
            "retain",
        )
    if technical:
        return (
            "deterministic-html",
            str(technical.get("renderer", "technical-visual")),
            "A typed technical renderer is already mapped and should be verified, not overwritten by a generic visual.",
            "retain",
        )
    if len(svg) >= 6500:
        return (
            "deterministic-html-svg",
            "existing-dense-svg",
            "The current SVG contains a substantial source-grounded teaching surface; audit it for legibility before replacing it.",
            "audit-existing",
        )
    if any(term in lowered for term in SPATIAL_TERMS):
        return (
            "manual-3d-or-hybrid-review",
            "3d-gate-required",
            "Spatial language alone is not permission for 3D: require a validated model and a source-grounded spatial question before mapping 3D.",
            "high",
        )
    if any(term in lowered for term in EXACT_TERMS):
        if "smiles" in lowered or "rdkit" in lowered:
            return (
                "deterministic-html",
                "rdkit-2d-or-dom-trace",
                "Use RDKit only when the slide has a validated SMILES/structure; otherwise show the exact code or data transformation in DOM.",
                "high",
            )
        if any(term in lowered for term in ("roc", "auc", "logp", "tanimoto", "分子量", "阈值")):
            return (
                "deterministic-html",
                "katex-dom-or-jsxgraph",
                "The claim depends on an exact quantity, equation, threshold, or axis and should not be baked into a raster image.",
                "high",
            )
        return (
            "deterministic-html",
            "dom-table-or-trace",
            "The source is a discrete calculation/data relationship; use selectable DOM values and a state trace.",
            "high",
        )
    if kind in {"intro", "outro"}:
        return (
            "deterministic-html-svg",
            "project-flow-or-artifact-evidence",
            "Keep the outcome and next-step relationship explicit; add a raster orientation layer only after it independently passes the information-density gate.",
            "medium",
        )
    return (
        "deterministic-html-svg",
        "source-grounded-process-or-comparison",
        "The current compact SVG is a replacement candidate; rebuild it as a denser process, comparison, or execution trace from source evidence.",
        "medium",
    )


def entry_for(module_id: str, slide: dict[str, Any]) -> dict[str, Any]:
    payload = slide.get("payload") or {}
    semantic_payload = {
        key: value for key, value in payload.items()
        if key not in {"inline_svg", "images", "technical_visual"}
    }
    source_text = " ".join((slide.get("title", ""), slide.get("audio_script", ""), compact_text(semantic_payload)))
    medium, renderer, reason, priority = classify(slide)
    entities = terms_in(source_text, TECHNICAL_TERMS)
    return {
        "module_id": module_id,
        "slide_id": slide.get("slide_id") or f"index-{slide.get('_index', 0)}",
        "kind": slide.get("kind", "unknown"),
        "teaching_claim": payload.get("hero_title") or slide.get("title") or payload.get("title", ""),
        "concrete_entities": entities or ["review source title, narration, and payload before visual generation"],
        "relationship_or_state_change": teaching_relationship(slide, source_text),
        "medium": medium,
        "renderer_family": renderer,
        "decision_reason": reason,
        "review_priority": priority,
        "source_evidence": {
            "title": slide.get("title") or payload.get("title") or payload.get("hero_title", ""),
            "audio_excerpt": (slide.get("audio_script", "") or "")[:360],
            "has_existing_svg": bool(payload.get("inline_svg")),
            "existing_svg_characters": len(payload.get("inline_svg") or ""),
            "has_existing_image": bool(payload.get("images")),
            "idea_id": payload.get("idea_id"),
            "technical_renderer": (payload.get("technical_visual") or {}).get("renderer"),
            "possible_smiles_tokens": SMILES_PATTERN.findall(source_text)[:6],
        },
    }


def build_registry(course_root: Path) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    for slides_path in sorted(course_root.glob("knodes/*/slides.json")):
        module_id = slides_path.parent.name
        slides = json.loads(slides_path.read_text(encoding="utf-8")).get("slides", [])
        for index, slide in enumerate(slides):
            entry = entry_for(module_id, {**slide, "_index": index})
            entries.append(entry)
    totals = Counter(entry["renderer_family"] for entry in entries)
    priorities = Counter(entry["review_priority"] for entry in entries)
    return {
        "course_slug": course_root.name,
        "modules": len({entry["module_id"] for entry in entries}),
        "slides": len(entries),
        "renderer_family_counts": dict(sorted(totals.items())),
        "review_priority_counts": dict(sorted(priorities.items())),
        "entries": entries,
    }


def validate_registry(registry: dict[str, Any]) -> None:
    required = {
        "module_id", "slide_id", "kind", "teaching_claim", "concrete_entities",
        "relationship_or_state_change", "medium", "renderer_family", "decision_reason", "review_priority", "source_evidence",
    }
    assert registry["modules"] == 47, f"expected 47 modules, got {registry['modules']}"
    assert registry["slides"] == 437, f"expected 437 slides, got {registry['slides']}"
    assert len(registry["entries"]) == 437, "registry must contain one entry per slide"
    for entry in registry["entries"]:
        missing = required - entry.keys()
        assert not missing, f"{entry.get('module_id')} {entry.get('slide_id')} missing {sorted(missing)}"
        assert entry["medium"] and entry["renderer_family"] and entry["decision_reason"]
        if entry["medium"] == "manual-3d-or-hybrid-review":
            assert entry["renderer_family"] == "3d-gate-required"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--course-root", type=Path, default=DEFAULT_COURSE_ROOT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Validate the existing output without writing it")
    args = parser.parse_args()
    if args.check:
        registry = json.loads(args.output.read_text(encoding="utf-8"))
    else:
        registry = build_registry(args.course_root)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    validate_registry(registry)
    print(json.dumps({
        "course_slug": registry["course_slug"],
        "modules": registry["modules"],
        "slides": registry["slides"],
        "renderer_family_counts": registry["renderer_family_counts"],
        "review_priority_counts": registry["review_priority_counts"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
