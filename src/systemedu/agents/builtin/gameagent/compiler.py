"""GameCompiler - injects GameSpec JSON into HTML templates."""

import json
from pathlib import Path

from systemedu.agents.builtin.gameagent.spec import GameSpec

TEMPLATES_DIR = Path(__file__).parent / "templates"
PLACEHOLDER = "__GAME_SPEC__"


class GameCompiler:
    """Compiles a validated GameSpec into a complete runnable HTML page."""

    def compile(self, spec: GameSpec) -> str:
        """Inject spec into the matching HTML template.

        Returns the full HTML string.
        Raises FileNotFoundError if the template does not exist.
        """
        template_path = TEMPLATES_DIR / f"{spec.mechanic}.html"
        if not template_path.exists():
            raise FileNotFoundError(f"Template not found: {template_path}")

        template = template_path.read_text(encoding="utf-8")
        spec_json = json.dumps(spec.model_dump(), ensure_ascii=False, indent=None)
        html = template.replace(f'"{PLACEHOLDER}"', spec_json, 1)
        return html
