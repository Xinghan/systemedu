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


_LEVEL_MAP = {
    "L0-启蒙": 1,
    "L0": 1,
    "L1-入门": 2,
    "L1": 2,
    "L2-基础": 3,
    "L2": 3,
    "L3-进阶": 5,
    "L3": 5,
    "L4-高级": 7,
    "L4": 7,
    "L5-专家": 9,
    "L5": 9,
}


def convert_uploaded_tree(raw_data: dict) -> dict:
    """Convert uploaded knowledge tree to internal milestones format.

    Auto-detects format:
    - If `raw_data` has "milestones" key → already internal format, return as-is.
    - If `raw_data` has "知识树节点" key → tree_leaf format, convert.

    Raises ValueError if format is unrecognized.
    """
    if "milestones" in raw_data:
        return raw_data

    if "知识树节点" not in raw_data:
        raise ValueError(
            "Unrecognized format: must contain 'milestones' or '知识树节点' key"
        )

    nodes = raw_data["知识树节点"]
    module_graph = raw_data.get("模块依赖图", [])

    # Build module order from dependency graph
    module_order = [m["模块id"] for m in module_graph] if module_graph else []

    # Group nodes by module id
    modules: dict[str, list[dict]] = {}
    for node in nodes:
        mid = node.get("模块id", "M00")
        modules.setdefault(mid, []).append(node)

    # Sort modules: use dependency graph order, then fallback to key sort
    if module_order:
        sorted_module_ids = [mid for mid in module_order if mid in modules]
        # Add any modules not in graph
        for mid in sorted(modules.keys()):
            if mid not in sorted_module_ids:
                sorted_module_ids.append(mid)
    else:
        sorted_module_ids = sorted(modules.keys())

    # Build module title lookup from dependency graph
    module_titles = {}
    for m in module_graph:
        module_titles[m["模块id"]] = m.get("模块标题", m["模块id"])

    # Build global node id → index mapping
    node_id_to_index: dict[str, int] = {}
    global_idx = 0
    for mid in sorted_module_ids:
        for node in modules[mid]:
            node_id_to_index[node["id"]] = global_idx
            global_idx += 1

    # Convert to milestones format
    milestones = []
    for mid in sorted_module_ids:
        module_nodes = modules[mid]
        knodes = []
        for node in module_nodes:
            # Convert level
            level_str = node.get("知识等级", "L0")
            difficulty = _LEVEL_MAP.get(level_str, 1)

            # Convert prerequisites
            prereq_ids = node.get("先修节点", [])
            prereq_indices = []
            for pid in prereq_ids:
                if pid in node_id_to_index:
                    prereq_indices.append(node_id_to_index[pid])

            knodes.append(
                {
                    "title": node.get("标题", ""),
                    "summary": node.get("详细描述", ""),
                    "difficulty_level": difficulty,
                    "estimated_minutes": node.get("预估学习时长_分钟", 15),
                    "prerequisite_indices": prereq_indices,
                }
            )

        milestones.append(
            {
                "title": module_titles.get(mid, mid),
                "knodes": knodes,
            }
        )

    return {"milestones": milestones}


def extract_project_meta(raw_data: dict) -> dict:
    """Extract project metadata from uploaded tree_leaf format.

    Returns a dict suitable for project.yaml fields.
    """
    meta: dict = {}

    if "项目名称" in raw_data:
        meta["title"] = raw_data["项目名称"]
    if "项目简介" in raw_data:
        meta["description"] = raw_data["项目简介"]

    target = raw_data.get("适用对象", {})
    if isinstance(target, dict):
        age = target.get("年龄", "")
        if isinstance(age, str) and "-" in age:
            parts = age.replace("岁", "").split("-")
            try:
                meta["age_range"] = [int(parts[0]), int(parts[1])]
            except (ValueError, IndexError):
                pass

    # Estimate total hours from node minutes
    nodes = raw_data.get("知识树节点", [])
    total_minutes = sum(n.get("预估学习时长_分钟", 15) for n in nodes)
    meta["estimated_hours"] = max(1, round(total_minutes / 60))

    return meta


def parse_knowledge_tree(tree_data: dict, *, validate: bool = True) -> KnowledgeTree:
    """Parse and validate a knowledge tree dict into a KnowledgeTree model.

    Raises KnowledgeTreeValidationError if validation fails.
    """
    if validate:
        errors = validate_knowledge_tree(tree_data)
        if errors:
            raise KnowledgeTreeValidationError(errors)

    return KnowledgeTree.model_validate(tree_data)
