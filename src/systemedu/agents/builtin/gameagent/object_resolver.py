"""ObjectResolver — B 主链路 fallback 策略。

Priority:
1. Exact hit in Production Registry
2. Same-family fallback (rocket.cutaway -> rocket.basic)
3. None (safe blank render)

On miss, emits a MissingObjectRequest for the C pipeline (MissQueue).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from systemedu.agents.builtin.gameagent.object_spec import (
    MissingObjectRequest,
    ObjectSpec,
    RenderSpec,
)

logger = logging.getLogger(__name__)

# Default fallback per family: if registry has no exact key, use this one.
# Extend this table as new objects are added to the Registry.
_FAMILY_FALLBACK: dict[str, str] = {
    "rocket": "rocket.basic",
    "human_body": "human_body.external",
    "cell": "cell.animal",
    "atom": "atom.bohr",
    "plant": "plant.basic",
    "earth": "earth.basic",
}


@dataclass
class ResolveResult:
    render_spec: RenderSpec | None
    resolved_key: str | None              # actual key used (may be fallback)
    miss_request: MissingObjectRequest | None  # None means exact hit
    resolution_type: Literal["exact", "fallback", "none"]


class ObjectResolver:
    """Resolve an ObjectSpec to a RenderSpec with graceful fallback."""

    def resolve(
        self,
        object_spec: ObjectSpec,
        game_spec_context: dict | None = None,
    ) -> ResolveResult:
        """Attempt to resolve object_spec to a RenderSpec.

        game_spec_context may contain keys:
            "topic"    — from GameSpec.topic
            "mechanic" — from GameSpec.mechanic
        """
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry

        ctx = game_spec_context or {}
        key = object_spec.object_key
        family = key.split(".")[0]

        # 1. Exact hit
        if key in ObjectRegistry.supported_keys():
            render_spec = ObjectRegistry.build(
                key,
                view=object_spec.view,
                variant=object_spec.variant,
            )
            return ResolveResult(
                render_spec=render_spec,
                resolved_key=key,
                miss_request=None,
                resolution_type="exact",
            )

        # 2. Family fallback
        fallback_key = self._find_fallback(family, ObjectRegistry.supported_keys())
        miss_request = MissingObjectRequest(
            object_key=key,
            family=family,
            view=object_spec.view,
            topic=ctx.get("topic", ""),
            required_parts=list(object_spec.label_part_ids),
            preferred_mechanic=ctx.get("mechanic", ""),
            fallback_used=fallback_key,
        )

        if fallback_key is not None:
            render_spec = ObjectRegistry.build(
                fallback_key,
                view=object_spec.view,
                variant=object_spec.variant,
            )
            return ResolveResult(
                render_spec=render_spec,
                resolved_key=fallback_key,
                miss_request=miss_request,
                resolution_type="fallback",
            )

        # 3. No fallback
        return ResolveResult(
            render_spec=None,
            resolved_key=None,
            miss_request=miss_request,
            resolution_type="none",
        )

    def _find_fallback(self, family: str, supported: list[str]) -> str | None:
        """Return the preferred fallback key for a family, or None."""
        # Check hard-coded preferred fallback first
        preferred = _FAMILY_FALLBACK.get(family)
        if preferred and preferred in supported:
            return preferred

        # Generic: pick first key with matching family prefix
        for k in supported:
            if k.startswith(f"{family}."):
                return k

        return None
