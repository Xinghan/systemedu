"""ObjectValidator: two-phase validation.

Phase 1 - Render completeness: RenderSpec must include ALL must_have parts.
Phase 2 - Label legality: ObjectSpec.label_part_ids must all be rendered AND labelable.

These are separate concerns:
  - must_have is about the DRAWING (are all required parts physically present?)
  - label_part_ids is about the GAME (are all requested labels valid for this object?)
"""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec, RenderSpec


class ObjectValidator:
    def __init__(self, meta: dict):
        """
        meta: the META dict from an object module (rocket.py, etc.)
        Contains: must_have, labelable, parts keys.
        """
        self._meta = meta

    def validate_render(self, render_spec: RenderSpec) -> tuple[bool, list[str]]:
        """Phase 1: check the RenderSpec drew all must-have parts."""
        errors: list[str] = []
        must_have = set(self._meta.get("must_have", []))
        rendered = set(render_spec.rendered_parts)
        missing = must_have - rendered
        if missing:
            errors.append(
                f"RenderSpec missing must-have parts: {sorted(missing)}. "
                f"Rendered: {sorted(rendered)}"
            )
        return len(errors) == 0, errors

    def validate_labels(self, object_spec: ObjectSpec, render_spec: RenderSpec) -> tuple[bool, list[str]]:
        """Phase 2: check requested label_part_ids are drawn AND labelable."""
        errors: list[str] = []
        rendered = set(render_spec.rendered_parts)
        labelable = set(self._meta.get("labelable", []))

        requested = set(object_spec.label_part_ids)

        # Parts requested for labeling but not rendered (can't label a part that wasn't drawn)
        not_rendered = requested - rendered
        if not_rendered:
            errors.append(
                f"label_part_ids reference parts not rendered: {sorted(not_rendered)}"
            )

        # Parts requested for labeling but not in the labelable whitelist
        not_labelable = requested - labelable
        if not_labelable:
            errors.append(
                f"label_part_ids include non-labelable parts: {sorted(not_labelable)}"
            )

        return len(errors) == 0, errors

    def validate(self, object_spec: ObjectSpec, render_spec: RenderSpec) -> tuple[bool, list[str]]:
        """Run both phases. Returns (valid, all_errors)."""
        all_errors: list[str] = []

        ok1, errs1 = self.validate_render(render_spec)
        all_errors.extend(errs1)

        ok2, errs2 = self.validate_labels(object_spec, render_spec)
        all_errors.extend(errs2)

        return len(all_errors) == 0, all_errors
