"""GameSpecValidator - pure Python validation, no LLM."""

from systemedu.agents.builtin.gameagent.spec import GameSpec

ALLOWED_MECHANICS = {"drag_sort", "match_pairs", "simulation", "label_map"}


class GameSpecValidator:
    """Validates a GameSpec for required fields and mechanic-specific constraints."""

    def validate(self, spec: GameSpec) -> tuple[bool, list[str]]:
        errors: list[str] = []

        if spec.mechanic not in ALLOWED_MECHANICS:
            errors.append(f"Unknown mechanic: {spec.mechanic}")
            return False, errors

        if len(spec.entities) < 3:
            errors.append(f"entities must have at least 3 items, got {len(spec.entities)}")

        if not spec.levels:
            errors.append("levels must be non-empty")

        # Mechanic-specific field checks
        if spec.mechanic == "drag_sort":
            if not spec.categories:
                errors.append("drag_sort requires 'categories' field")
            for i, e in enumerate(spec.entities):
                for field in ("id", "label", "category"):
                    if field not in e:
                        errors.append(f"drag_sort entity[{i}] missing field '{field}'")

        elif spec.mechanic == "match_pairs":
            for i, e in enumerate(spec.entities):
                for field in ("id", "term", "definition"):
                    if field not in e:
                        errors.append(f"match_pairs entity[{i}] missing field '{field}'")

        elif spec.mechanic == "simulation":
            for i, e in enumerate(spec.entities):
                for field in ("id", "param_name", "min", "max"):
                    if field not in e:
                        errors.append(f"simulation entity[{i}] missing field '{field}'")

        elif spec.mechanic == "label_map":
            for i, e in enumerate(spec.entities):
                for field in ("id", "name", "x", "y"):
                    if field not in e:
                        errors.append(f"label_map entity[{i}] missing field '{field}'")

        return len(errors) == 0, errors
