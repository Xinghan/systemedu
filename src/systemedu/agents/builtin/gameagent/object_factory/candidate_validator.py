"""CandidateValidator: three-phase pure Python validation for staged object candidates.

Phase 1 - Geometry: coordinates in bounds, shape counts, must-have coverage
Phase 2 - Semantic: label IDs valid, snake_case, no forbidden words
Phase 3 - Style: path complexity, shape type distribution
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


FORBIDDEN_PART_WORDS = {"background", "decoration", "misc", "other", "filler"}
_SNAKE_CASE_RE = re.compile(r"^[a-z][a-z0-9]*(_[a-z0-9]+)*$")


@dataclass
class ValidationReport:
    passed: bool
    score: float           # 0.0 - 1.0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _parse_viewbox(viewbox: str) -> tuple[float, float, float, float]:
    parts = viewbox.split()
    return float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])


class CandidateValidator:
    """Pure Python validator for object factory candidates."""

    def validate(self, candidate: dict) -> ValidationReport:
        """Run all three validation phases.

        candidate dict must have:
          - meta: {must_have, optional, labelable, parts}
          - render_spec: {viewbox, shapes, anchors, rendered_parts}
          - object_key: str
        """
        errors: list[str] = []
        warnings: list[str] = []

        meta = candidate.get("meta", {})
        render_spec = candidate.get("render_spec", {})

        geo_errors, geo_warnings = self._check_geometry(meta, render_spec)
        sem_errors, sem_warnings = self._check_semantics(meta, render_spec)
        sty_errors, sty_warnings = self._check_style(render_spec)

        errors.extend(geo_errors)
        errors.extend(sem_errors)
        errors.extend(sty_errors)

        warnings.extend(geo_warnings)
        warnings.extend(sem_warnings)
        warnings.extend(sty_warnings)

        total_checks = 10
        failures = len(errors)
        score = max(0.0, round(1.0 - failures * 0.1, 2))
        # Warnings reduce score less
        score = max(0.0, round(score - len(warnings) * 0.02, 2))

        return ValidationReport(
            passed=len(errors) == 0,
            score=score,
            errors=errors,
            warnings=warnings,
        )

    # ------------------------------------------------------------------
    # Phase 1: Geometry
    # ------------------------------------------------------------------

    def _check_geometry(self, meta: dict, render_spec: dict) -> tuple[list[str], list[str]]:
        errors: list[str] = []
        warnings: list[str] = []

        shapes = render_spec.get("shapes", [])
        viewbox = render_spec.get("viewbox", "0 0 560 420")
        vx, vy, vw, vh = _parse_viewbox(viewbox)
        tolerance = 0.05   # 5% overflow allowed

        must_have = set(meta.get("must_have", []))
        rendered_parts = set(render_spec.get("rendered_parts", []))

        # Check must_have parts are all rendered
        missing = must_have - rendered_parts
        if missing:
            errors.append(f"Missing must-have parts in render_spec: {sorted(missing)}")

        # Check shape count
        if len(shapes) > 60:
            errors.append(f"Too many shapes: {len(shapes)} (max 60)")
        elif len(shapes) > 45:
            warnings.append(f"High shape count: {len(shapes)} (recommend <= 45)")

        # Check anchor coordinates
        anchors = render_spec.get("anchors", [])
        for anchor in anchors:
            ax = anchor.get("x", 0)
            ay = anchor.get("y", 0)
            if not (0 <= ax <= 100):
                errors.append(f"Anchor '{anchor.get('part_id', '?')}' x={ax} out of 0-100 range")
            if not (0 <= ay <= 100):
                errors.append(f"Anchor '{anchor.get('part_id', '?')}' y={ay} out of 0-100 range")

        # Check coordinate bounds for shapes (sample check, not exhaustive)
        x_min, x_max = vx - vw * tolerance, vx + vw * (1 + tolerance)
        y_min, y_max = vy - vh * tolerance, vy + vh * (1 + tolerance)

        for shape in shapes:
            sid = shape.get("id", "?")
            stype = shape.get("type", "")
            if stype == "rect":
                x, y, w, h = shape.get("x", 0), shape.get("y", 0), shape.get("w", 0), shape.get("h", 0)
                if x < x_min or x + w > x_max:
                    warnings.append(f"Shape '{sid}' x-range [{x}, {x+w}] exceeds viewbox tolerance")
                if y < y_min or y + h > y_max:
                    warnings.append(f"Shape '{sid}' y-range [{y}, {y+h}] exceeds viewbox tolerance")
            elif stype == "ellipse":
                cx, cy = shape.get("cx", 0), shape.get("cy", 0)
                if not (x_min <= cx <= x_max):
                    warnings.append(f"Shape '{sid}' cx={cx} near viewbox edge")
                if not (y_min <= cy <= y_max):
                    warnings.append(f"Shape '{sid}' cy={cy} near viewbox edge")

        return errors, warnings

    # ------------------------------------------------------------------
    # Phase 2: Semantics
    # ------------------------------------------------------------------

    def _check_semantics(self, meta: dict, render_spec: dict) -> tuple[list[str], list[str]]:
        errors: list[str] = []
        warnings: list[str] = []

        labelable = set(meta.get("labelable", []))
        anchors = render_spec.get("anchors", [])
        rendered_parts = set(render_spec.get("rendered_parts", []))

        # Check labelled part count (3-8 recommended)
        anchor_part_ids = [a.get("part_id", "") for a in anchors]
        if len(anchor_part_ids) < 3:
            errors.append(f"Too few labelable parts: {len(anchor_part_ids)} (min 3)")
        elif len(anchor_part_ids) > 8:
            warnings.append(f"Many labelable parts: {len(anchor_part_ids)} (recommend <= 8)")

        # Check all anchor part_ids reference rendered parts
        for pid in anchor_part_ids:
            if pid not in rendered_parts:
                errors.append(f"Anchor part_id '{pid}' not in rendered_parts")

        # Check part_id snake_case format
        all_part_ids = list(rendered_parts) + anchor_part_ids
        for pid in set(all_part_ids):
            if pid and not _SNAKE_CASE_RE.match(pid):
                errors.append(f"part_id '{pid}' is not valid snake_case")

        # Check forbidden keywords
        for pid in set(all_part_ids):
            for word in FORBIDDEN_PART_WORDS:
                if word in pid.lower():
                    errors.append(f"part_id '{pid}' contains forbidden word '{word}'")

        # Check anchor parts are in labelable list
        not_labelable = set(anchor_part_ids) - labelable - {""}
        if not_labelable:
            warnings.append(f"Anchor parts not in labelable list: {sorted(not_labelable)}")

        return errors, warnings

    # ------------------------------------------------------------------
    # Phase 3: Style
    # ------------------------------------------------------------------

    def _check_style(self, render_spec: dict) -> tuple[list[str], list[str]]:
        errors: list[str] = []
        warnings: list[str] = []

        shapes = render_spec.get("shapes", [])
        if not shapes:
            return errors, warnings

        path_shapes = [s for s in shapes if s.get("type") == "path"]
        path_ratio = len(path_shapes) / len(shapes)

        # Path shapes should not dominate (prefer rect/ellipse/polygon)
        if path_ratio > 0.6:
            errors.append(
                f"Too many path shapes: {len(path_shapes)}/{len(shapes)} ({path_ratio:.0%}). "
                f"Use rect/ellipse/polygon instead (path ratio must be < 60%)"
            )

        # Check path d string length
        for shape in path_shapes:
            d = shape.get("d", "")
            if len(d) > 300:
                errors.append(
                    f"Path '{shape.get('id', '?')}' d string too long: {len(d)} chars (max 300)"
                )

        # Warn if no rect/ellipse shapes at all
        simple_types = {"rect", "ellipse", "polygon"}
        simple_count = sum(1 for s in shapes if s.get("type") in simple_types)
        if simple_count == 0:
            warnings.append("No rect/ellipse/polygon shapes found — consider using simpler primitives")

        return errors, warnings
