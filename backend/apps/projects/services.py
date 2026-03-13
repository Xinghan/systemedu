"""Knowledge tree import/validation services.

Shared by both the backend API (agents/planner.py) and the admin service.
"""

from collections import deque

from django.db import transaction

from apps.projects.models import KnowledgeNode, Milestone, Project


# Valid choices extracted from model definitions
_CONTENT_TYPES = {c[0] for c in KnowledgeNode.CONTENT_TYPE_CHOICES}
_ACCEPTANCE_TYPES = {c[0] for c in KnowledgeNode.ACCEPTANCE_TYPE_CHOICES}


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

    global_index = 0
    total_nodes = 0
    # First pass: count total nodes
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

    # Second pass: validate fields
    adjacency: dict[int, list[int]] = {}  # for cycle detection
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

            # Required field: title
            if "title" not in kn or not isinstance(kn.get("title"), str):
                errors.append(f"{node_label}.title is required and must be a string")

            # content_type enum
            ct = kn.get("content_type", "text")
            if ct not in _CONTENT_TYPES:
                errors.append(
                    f"{node_label}.content_type '{ct}' is invalid. "
                    f"Must be one of: {sorted(_CONTENT_TYPES)}"
                )

            # acceptance_type enum
            at = kn.get("acceptance_type", "quiz")
            if at not in _ACCEPTANCE_TYPES:
                errors.append(
                    f"{node_label}.acceptance_type '{at}' is invalid. "
                    f"Must be one of: {sorted(_ACCEPTANCE_TYPES)}"
                )

            # difficulty_level range
            dl = kn.get("difficulty_level", 1)
            if not isinstance(dl, int) or dl < 1 or dl > 10:
                errors.append(
                    f"{node_label}.difficulty_level must be an integer 1-10, got {dl}"
                )

            # prerequisite_indices validation
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
                    # Edge: pi -> global_index (pi must come before current)
                    adjacency.setdefault(pi, []).append(global_index)
                    in_degree[global_index] = in_degree.get(global_index, 0) + 1

            global_index += 1

    # If there are already field-level errors, skip cycle detection
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


def save_knowledge_tree(
    project: Project,
    tree_data: dict,
    *,
    replace: bool = False,
    validate: bool = True,
) -> dict:
    """Save a knowledge tree to the database.

    Args:
        project: Project model instance
        tree_data: Parsed JSON with "milestones" -> "knodes" structure
        replace: If True, delete existing milestones/knodes before importing
        validate: If True, run validate_knowledge_tree first

    Returns:
        dict with milestones_created and knodes_created counts

    Raises:
        KnowledgeTreeValidationError: If validation fails
    """
    if validate:
        errors = validate_knowledge_tree(tree_data)
        if errors:
            raise KnowledgeTreeValidationError(errors)

    with transaction.atomic():
        if replace:
            # Delete existing tree for this project
            KnowledgeNode.objects.filter(project=project).delete()
            Milestone.objects.filter(project=project).delete()

        milestones_created = []
        all_knodes = []
        knode_prereq_map: list[list[int]] = []  # parallel to all_knodes

        for ms_data in tree_data["milestones"]:
            milestone = Milestone.objects.create(
                project=project,
                title=ms_data["title"],
                description=ms_data.get("description", ""),
                order=ms_data["order"],
                xp_reward=sum(k.get("xp_reward", 20) for k in ms_data["knodes"]),
            )
            milestones_created.append(milestone)

            # Prepare knodes for bulk_create
            knodes_batch = []
            for kn_data in ms_data["knodes"]:
                knodes_batch.append(
                    KnowledgeNode(
                        project=project,
                        milestone=milestone,
                        title=kn_data["title"],
                        summary=kn_data.get("summary", ""),
                        difficulty_level=kn_data.get("difficulty_level", 1),
                        content_type=kn_data.get("content_type", "text"),
                        acceptance_type=kn_data.get("acceptance_type", "quiz"),
                        estimated_minutes=kn_data.get("estimated_minutes", 15),
                        xp_reward=kn_data.get("xp_reward", 20),
                        order=kn_data.get("order", 0),
                    )
                )
                knode_prereq_map.append(kn_data.get("prerequisite_indices", []))

            created = KnowledgeNode.objects.bulk_create(knodes_batch)
            all_knodes.extend(created)

        # Set prerequisites using global indices (bulk M2M)
        through_model = KnowledgeNode.prerequisites.through
        m2m_relations = []
        for idx, prereq_indices in enumerate(knode_prereq_map):
            for pi in prereq_indices:
                if 0 <= pi < len(all_knodes) and pi != idx:
                    m2m_relations.append(
                        through_model(
                            from_knowledgenode_id=all_knodes[idx].pk,
                            to_knowledgenode_id=all_knodes[pi].pk,
                        )
                    )

        if m2m_relations:
            through_model.objects.bulk_create(m2m_relations, ignore_conflicts=True)

    return {
        "milestones_created": len(milestones_created),
        "knodes_created": len(all_knodes),
    }


def export_knowledge_tree(project: Project) -> dict:
    """Export a project's knowledge tree as importable JSON.

    Returns the same format accepted by save_knowledge_tree / import-tree API,
    so the output can be directly re-imported into another project.
    """
    milestones = (
        Milestone.objects.filter(project=project)
        .prefetch_related("knodes__prerequisites")
        .order_by("order")
    )

    # Build global index map: knode.pk -> global index
    all_knodes = []
    for ms in milestones:
        for knode in ms.knodes.all().order_by("order"):
            all_knodes.append(knode)

    pk_to_index = {knode.pk: idx for idx, knode in enumerate(all_knodes)}

    result_milestones = []
    for ms in milestones:
        knodes_data = []
        for knode in ms.knodes.all().order_by("order"):
            prereq_indices = sorted(
                pk_to_index[p.pk]
                for p in knode.prerequisites.all()
                if p.pk in pk_to_index
            )
            knodes_data.append({
                "title": knode.title,
                "summary": knode.summary,
                "difficulty_level": knode.difficulty_level,
                "content_type": knode.content_type,
                "acceptance_type": knode.acceptance_type,
                "estimated_minutes": knode.estimated_minutes,
                "xp_reward": knode.xp_reward,
                "order": knode.order,
                "prerequisite_indices": prereq_indices,
            })
        result_milestones.append({
            "title": ms.title,
            "description": ms.description,
            "order": ms.order,
            "knodes": knodes_data,
        })

    return {"milestones": result_milestones}


def get_tree_graph(project: Project) -> dict:
    """Return a graph representation of the knowledge tree for visualization.

    Returns:
        {
            "nodes": [{"id": <pk>, "title": ..., "milestone": ..., ...}, ...],
            "edges": [{"source": <prereq_pk>, "target": <knode_pk>}, ...],
        }
    """
    knodes = (
        KnowledgeNode.objects.filter(project=project)
        .select_related("milestone")
        .prefetch_related("prerequisites")
        .order_by("milestone__order", "order")
    )

    nodes = []
    edges = []

    for knode in knodes:
        nodes.append({
            "id": knode.pk,
            "title": knode.title,
            "milestone_id": knode.milestone_id,
            "milestone_title": knode.milestone.title,
            "difficulty_level": knode.difficulty_level,
            "content_type": knode.content_type,
            "acceptance_type": knode.acceptance_type,
            "estimated_minutes": knode.estimated_minutes,
            "xp_reward": knode.xp_reward,
            "order": knode.order,
        })
        for prereq in knode.prerequisites.all():
            edges.append({
                "source": prereq.pk,
                "target": knode.pk,
            })

    return {"nodes": nodes, "edges": edges}


def clone_project(
    source_project: Project,
    *,
    new_title: str | None = None,
    created_by=None,
) -> Project:
    """Clone a project and its full knowledge tree.

    Creates a new project with copies of all milestones, knodes, and
    prerequisite relationships. The new project is unpublished by default.

    Returns the new Project instance.
    """
    tree_data = export_knowledge_tree(source_project)

    new_project = Project.objects.create(
        title=new_title or f"{source_project.title} (Copy)",
        subtitle=source_project.subtitle,
        description=source_project.description,
        cover_image=source_project.cover_image,
        category=source_project.category,
        min_age=source_project.min_age,
        max_age=source_project.max_age,
        estimated_hours=source_project.estimated_hours,
        is_published=False,
        is_template=False,
        created_by=created_by,
    )

    if tree_data["milestones"]:
        save_knowledge_tree(new_project, tree_data, validate=False)

    return new_project
