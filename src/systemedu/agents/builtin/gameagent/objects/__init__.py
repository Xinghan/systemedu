"""ObjectRegistry: deterministic RenderSpec generation from object_key.

Usage:
    from systemedu.agents.builtin.gameagent.objects import ObjectRegistry

    render_spec = ObjectRegistry.build("rocket.basic", view="side")
    supported = ObjectRegistry.supported_keys()
"""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import RenderSpec

from .rocket import build as _build_rocket, META as _rocket_meta
from .human_body import build as _build_human_body, META as _human_body_meta
from .human_senses import build as _build_human_senses, META as _human_senses_meta
from .cell import build as _build_cell, META as _cell_meta
from .atom import build as _build_atom, META as _atom_meta
from .plant import build as _build_plant, META as _plant_meta
from .earth import build as _build_earth, META as _earth_meta

_REGISTRY: dict[str, dict] = {
    "rocket.basic": {"builder": _build_rocket, "meta": _rocket_meta},
    "human_body.external": {"builder": _build_human_body, "meta": _human_body_meta},
    "human_body.senses": {"builder": _build_human_senses, "meta": _human_senses_meta},
    "cell.animal": {"builder": _build_cell, "meta": _cell_meta},
    "atom.bohr": {"builder": _build_atom, "meta": _atom_meta},
    "plant.basic": {"builder": _build_plant, "meta": _plant_meta},
    "earth.basic": {"builder": _build_earth, "meta": _earth_meta},
}


class ObjectRegistry:
    @staticmethod
    def supported_keys() -> list[str]:
        return list(_REGISTRY.keys())

    @staticmethod
    def get_meta(object_key: str) -> dict:
        """Returns semantic metadata (parts, must_have, labels) for a key."""
        entry = _REGISTRY.get(object_key)
        if not entry:
            raise KeyError(f"Unknown object_key: {object_key!r}. Supported: {list(_REGISTRY)}")
        return entry["meta"]

    @staticmethod
    def build(object_key: str, view: str = "side", variant: str | None = None) -> RenderSpec:
        """Build a deterministic RenderSpec for the given object."""
        entry = _REGISTRY.get(object_key)
        if not entry:
            raise KeyError(f"Unknown object_key: {object_key!r}. Supported: {list(_REGISTRY)}")
        return entry["builder"](view=view, variant=variant)
