"""Knowledge tree validation and import/export services.

Migrated from backend/apps/projects/services.py, removing Django ORM dependency.
"""

from collections import deque

from .models import AcceptanceType, ContentType, KnowledgeTree

_CONTENT_TYPES = {e.value for e in ContentType}
_ACCEPTANCE_TYPES = {e.value for e in AcceptanceType}


class KnowledgeTreeValidationError(Exception):
    """Raised when tree_data fails validation."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__(f"Validation failed: {errors}")


def validate_knowledge_tree(tree_data: dict) -> list[str]:
    """Validate a knowledge tree JSON structure.

    Checks:
    - Required fields and types
    - Enum values (content_type, acceptance_type)
    - difficulty_level range (1-10)
    - prerequisite_indices bounds and self-reference
    - DAG cycle detection (Kahn's algorithm)

    Returns a list of error strings (empty = valid).
    """
    errors: list[str] = []

    if not isinstance(tree_data, dict):
        return ["tree_data must be a dict"]

    milestones = tree_data.get("milestones")
    if not isinstance(milestones, list) or len(milestones) == 0:
        return ["'milestones' must be a non-empty list"]

    total_nodes = 0
    for ms_idx, ms in enumerate(milestones):
        if not isinstance(ms, dict):
            errors.append(f"milestones[{ms_idx}] must be a dict")
            continue
        knodes = ms.get("knodes")
        if not isinstance(knodes, list) or len(knodes) == 0:
            errors.append(f"milestones[{ms_idx}].knodes must be a non-empty list")
            continue
        total_nodes += len(knodes)

    if errors:
        return errors

    adjacency: dict[int, list[int]] = {}
    in_degree: dict[int, int] = {}
    global_index = 0

    for ms_idx, ms in enumerate(milestones):
        if "title" not in ms or not isinstance(ms.get("title"), str):
            errors.append(f"milestones[{ms_idx}].title is required and must be a string")

        for kn_idx, kn in enumerate(ms["knodes"]):
            node_label = f"milestones[{ms_idx}].knodes[{kn_idx}]"
            if not isinstance(kn, dict):
                errors.append(f"{node_label} must be a dict")
                global_index += 1
                continue

            if "title" not in kn or not isinstance(kn.get("title"), str):
                errors.append(f"{node_label}.title is required and must be a string")

            ct = kn.get("content_type", "text")
            if ct not in _CONTENT_TYPES:
                errors.append(
                    f"{node_label}.content_type '{ct}' is invalid. "
                    f"Must be one of: {sorted(_CONTENT_TYPES)}"
                )

            at = kn.get("acceptance_type", "quiz")
            if at not in _ACCEPTANCE_TYPES:
                errors.append(
                    f"{node_label}.acceptance_type '{at}' is invalid. "
                    f"Must be one of: {sorted(_ACCEPTANCE_TYPES)}"
                )

            dl = kn.get("difficulty_level", 1)
            if not isinstance(dl, int) or dl < 1 or dl > 10:
                errors.append(
                    f"{node_label}.difficulty_level must be an integer 1-10, got {dl}"
                )

            prereqs = kn.get("prerequisite_indices", [])
            if not isinstance(prereqs, list):
                errors.append(f"{node_label}.prerequisite_indices must be a list")
                prereqs = []

            adjacency[global_index] = []
            in_degree.setdefault(global_index, 0)

            for pi in prereqs:
                if not isinstance(pi, int):
                    errors.append(f"{node_label}.prerequisite_indices contains non-integer: {pi}")
                elif pi == global_index:
                    errors.append(f"{node_label}.prerequisite_indices contains self-reference: {pi}")
                elif pi < 0 or pi >= total_nodes:
                    errors.append(
                        f"{node_label}.prerequisite_indices[{pi}] is out of bounds "
                        f"(valid: 0-{total_nodes - 1})"
                    )
                else:
                    adjacency.setdefault(pi, []).append(global_index)
                    in_degree[global_index] = in_degree.get(global_index, 0) + 1

            global_index += 1

    if errors:
        return errors

    # Kahn's algorithm for cycle detection
    queue = deque([node for node in range(total_nodes) if in_degree.get(node, 0) == 0])
    visited_count = 0

    while queue:
        node = queue.popleft()
        visited_count += 1
        for neighbor in adjacency.get(node, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if visited_count < total_nodes:
        errors.append("Knowledge tree contains a cycle in prerequisite dependencies")

    return errors


def parse_knowledge_tree(tree_data: dict, *, validate: bool = True) -> KnowledgeTree:
    """Parse and validate a knowledge tree dict into a KnowledgeTree model.

    Raises KnowledgeTreeValidationError if validation fails.
    """
    if validate:
        errors = validate_knowledge_tree(tree_data)
        if errors:
            raise KnowledgeTreeValidationError(errors)

    return KnowledgeTree.model_validate(tree_data)
