"""GameSpecValidator - pure Python validation, no LLM."""

from systemedu.agents.builtin.gameagent.spec import GameSpec

ALLOWED_MECHANICS = {"drag_sort", "match_pairs", "simulation", "label_map", "timeline_order", "boss_quiz", "free_simulation"}


class GameSpecValidator:
    """Validates a GameSpec for required fields and mechanic-specific constraints."""

    def validate(self, spec: GameSpec) -> tuple[bool, list[str]]:
        errors: list[str] = []

        if spec.mechanic not in ALLOWED_MECHANICS:
            errors.append(f"Unknown mechanic: {spec.mechanic}")
            return False, errors

        if not spec.levels:
            errors.append("levels must be non-empty")

        # mechanic-specific checks
        if spec.mechanic == "drag_sort":
            if len(spec.entities) < 3:
                errors.append(f"drag_sort entities must have at least 3 items, got {len(spec.entities)}")
            if not spec.categories:
                errors.append("drag_sort requires 'categories' field")
            for i, e in enumerate(spec.entities):
                for field in ("id", "label", "category"):
                    if field not in e:
                        errors.append(f"drag_sort entity[{i}] missing field '{field}'")

        elif spec.mechanic == "match_pairs":
            if len(spec.entities) < 3:
                errors.append(f"match_pairs entities must have at least 3 items, got {len(spec.entities)}")
            for i, e in enumerate(spec.entities):
                for field in ("id", "term", "definition"):
                    if field not in e:
                        errors.append(f"match_pairs entity[{i}] missing field '{field}'")

        elif spec.mechanic == "simulation":
            if len(spec.entities) < 2:
                errors.append(f"simulation entities must have at least 2 items, got {len(spec.entities)}")
            for i, e in enumerate(spec.entities):
                for field in ("id", "param_name", "min", "max"):
                    if field not in e:
                        errors.append(f"simulation entity[{i}] missing field '{field}'")

        elif spec.mechanic == "label_map":
            if spec.object_spec is not None:
                # object_spec mode: Registry provides the visual; entities must be empty
                if spec.entities:
                    errors.append("label_map with object_spec must have empty entities list")
                # Reject object_keys whose family has no fallback in Registry
                # (known families like rocket.cutaway can fall back to rocket.basic,
                #  but entirely unknown families like triangle → no visual at all)
                from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
                key = spec.object_spec.object_key
                family = key.split(".")[0]
                supported = ObjectRegistry.supported_keys()
                if key not in supported and not any(k.startswith(f"{family}.") for k in supported):
                    errors.append(
                        f"label_map object_key '{key}' has no matching family in ObjectRegistry "
                        f"(family='{family}' unknown); use drag_sort or match_pairs instead"
                    )
            else:
                # Legacy manual-coordinate mode
                if len(spec.entities) < 3:
                    errors.append(f"label_map entities must have at least 3 items, got {len(spec.entities)}")
                for i, e in enumerate(spec.entities):
                    for field in ("id", "name", "x", "y"):
                        if field not in e:
                            errors.append(f"label_map entity[{i}] missing field '{field}'")

        elif spec.mechanic == "timeline_order":
            items = spec.ordered_items or spec.entities
            if len(items) < 3:
                errors.append(f"timeline_order needs at least 3 items, got {len(items)}")
            for i, e in enumerate(items):
                for field in ("id", "label"):
                    if field not in e:
                        errors.append(f"timeline_order item[{i}] missing field '{field}'")

        elif spec.mechanic == "boss_quiz":
            questions = spec.questions or spec.entities
            if len(questions) < 3:
                errors.append(f"boss_quiz needs at least 3 questions, got {len(questions)}")
            for i, q in enumerate(questions):
                for field in ("id", "question", "options", "correct"):
                    if field not in q:
                        errors.append(f"boss_quiz question[{i}] missing field '{field}'")

        elif spec.mechanic == "free_simulation":
            if not spec.free_html or not spec.free_html.html:
                errors.append("free_simulation requires non-empty free_html.html")
            elif len(spec.free_html.html) < 500:
                errors.append(
                    f"free_simulation html too short ({len(spec.free_html.html)} chars, min 500)"
                )

        return len(errors) == 0, errors
