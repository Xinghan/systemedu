"""GameCompiler - injects GameSpec JSON into HTML templates.

For label_map and simulation mechanics, if the GameSpec contains an object_spec,
the compiler resolves it through ObjectRegistry (deterministic Python) and injects
both the GameSpec and the RenderSpec into the template.
"""

import json
import logging
from pathlib import Path

from systemedu.agents.builtin.gameagent.spec import GameSpec

TEMPLATES_DIR = Path(__file__).parent / "templates"
PLACEHOLDER = "__GAME_SPEC__"
RENDER_SPEC_PLACEHOLDER = "__RENDER_SPEC__"

logger = logging.getLogger(__name__)


class GameCompiler:
    """Compiles a validated GameSpec into a complete runnable HTML page."""

    def compile(self, spec: GameSpec) -> str:
        """Inject spec (and optional RenderSpec) into the matching HTML template.

        Returns the full HTML string.
        Raises FileNotFoundError if the template does not exist.
        """
        template_path = TEMPLATES_DIR / f"{spec.mechanic}.html"
        if not template_path.exists():
            raise FileNotFoundError(f"Template not found: {template_path}")

        template = template_path.read_text(encoding="utf-8")

        # Resolve ObjectSpec -> RenderSpec if present (label_map / simulation)
        render_spec_json = "null"
        if spec.object_spec is not None:
            render_spec = self._resolve_render_spec(spec)
            if render_spec is not None:
                render_spec_json = json.dumps(
                    render_spec.model_dump(), ensure_ascii=False, indent=None
                )

        # Enrich spec entities with Registry knowledge (labels/desc/hint)
        # so the template JS can read them without embedding a KB itself
        spec_dict = spec.model_dump()
        if spec.object_spec is not None and render_spec_json != "null":
            from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
            import json as _json
            render_data = _json.loads(render_spec_json)
            try:
                meta = ObjectRegistry.get_meta(spec.object_spec.object_key)
                parts_kb = meta.get("parts", {})
                enriched_entities = []
                for anchor in render_data.get("anchors", []):
                    pid = anchor["part_id"]
                    if pid in (spec.object_spec.label_part_ids or []):
                        kb = parts_kb.get(pid, {})
                        enriched_entities.append({
                            "part_id": pid,
                            "name": kb.get("label_zh", pid.replace("_", " ")),
                            "label_en": kb.get("label_en", ""),
                            "description": kb.get("desc_brief", ""),
                            "hint": kb.get("hint", ""),
                        })
                spec_dict["entities"] = enriched_entities
            except Exception:
                pass  # fall through with original entities

        spec_json = json.dumps(spec_dict, ensure_ascii=False, indent=None)

        html = template.replace(f'"{PLACEHOLDER}"', spec_json, 1)

        # Inject RenderSpec if the template has the placeholder
        if f'"{RENDER_SPEC_PLACEHOLDER}"' in html:
            html = html.replace(f'"{RENDER_SPEC_PLACEHOLDER}"', render_spec_json, 1)

        return html

    def _resolve_render_spec(self, spec: GameSpec):
        """Build a RenderSpec from spec.object_spec via ObjectRegistry.

        Also runs the ObjectValidator and logs warnings on failure.
        Returns the RenderSpec, or None on error.
        """
        from systemedu.agents.builtin.gameagent.object_validator import ObjectValidator
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry

        obj_spec = spec.object_spec
        try:
            render_spec = ObjectRegistry.build(
                obj_spec.object_key,
                view=obj_spec.view,
                variant=obj_spec.variant,
            )
        except KeyError as e:
            logger.warning(f"ObjectRegistry.build failed: {e}")
            return None

        meta = ObjectRegistry.get_meta(obj_spec.object_key)
        validator = ObjectValidator(meta)
        valid, errors = validator.validate(obj_spec, render_spec)
        if not valid:
            logger.warning(
                f"ObjectValidator errors for '{obj_spec.object_key}': {errors}"
            )
            # Still return the render_spec — partial render is better than nothing

        return render_spec
