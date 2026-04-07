"""Bidirectional adapter between v5 (stages/modules/edges) and legacy milestones format.

v5 is the canonical internal format. The milestones view is derived for API/frontend
compatibility. Legacy milestones-format trees can be upgraded to v5 for import.
"""

from __future__ import annotations

from .models import (
    Edge,
    KnowledgeNode,
    KnowledgeTree,
    Milestone,
    Module,
    Stage,
    SubProject,
    V5KnowledgeTree,
)

_K_LEVEL_MAP = {
    "K1": 1, "K2": 3, "K3": 5, "K4": 6, "K5": 8, "K6": 9,
}


def _parse_duration_months(dur: str | int | float) -> float:
    """Parse estimated_duration_months like '1-1.5' into average months."""
    if isinstance(dur, (int, float)):
        return float(dur)
    dur = str(dur).strip()
    if "-" in dur:
        parts = dur.split("-")
        try:
            return (float(parts[0]) + float(parts[1])) / 2
        except (ValueError, IndexError):
            return 1.0
    try:
        return float(dur)
    except ValueError:
        return 1.0


def sorted_modules(v5_tree: V5KnowledgeTree) -> list[Module]:
    """Return modules sorted by stage order then sequence_order.

    This ordering defines the global index mapping and must be stable.
    """
    stage_order = [s.stage_id for s in v5_tree.stages]
    stage_rank = {sid: i for i, sid in enumerate(stage_order)}

    return sorted(
        v5_tree.modules,
        key=lambda m: (stage_rank.get(m.stage_id, 999), m.sequence_order),
    )


def build_module_index_map(v5_tree: V5KnowledgeTree) -> dict[str, int]:
    """Map module_id -> global_index (sequential, matching legacy iteration order)."""
    return {
        mod.module_id: idx
        for idx, mod in enumerate(sorted_modules(v5_tree))
    }


def v5_to_milestones_view(v5_tree: V5KnowledgeTree) -> KnowledgeTree:
    """Derive legacy milestones/knodes/sub_projects view from native v5 tree.

    This is a lossless read-only projection used for API serialization,
    progress tracking, and frontend compatibility.
    """
    stage_order = [s.stage_id for s in v5_tree.stages]

    # Group modules by stage_id, sorted by sequence_order
    stage_modules: dict[str, list[Module]] = {}
    for mod in v5_tree.modules:
        stage_modules.setdefault(mod.stage_id, []).append(mod)
    for sid in stage_modules:
        stage_modules[sid].sort(key=lambda m: m.sequence_order)

    # Build module_id -> global_index
    module_id_to_index: dict[str, int] = {}
    global_idx = 0
    for sid in stage_order:
        for mod in stage_modules.get(sid, []):
            module_id_to_index[mod.module_id] = global_idx
            global_idx += 1

    # Convert stages -> milestones, modules -> knodes
    milestones: list[Milestone] = []
    for sid in stage_order:
        stage = next((s for s in v5_tree.stages if s.stage_id == sid), None)
        if stage is None:
            continue
        mods = stage_modules.get(sid, [])

        knodes: list[KnowledgeNode] = []
        for mod in mods:
            difficulty = _K_LEVEL_MAP.get(mod.knowledge_level, 1)

            prereq_indices = [
                module_id_to_index[dep_id]
                for dep_id in mod.depends_on
                if dep_id in module_id_to_index
            ]

            dur_months = _parse_duration_months(mod.estimated_duration_months)
            estimated_minutes = max(15, round(dur_months * 360))

            summary_parts = []
            if mod.summary:
                summary_parts.append(mod.summary)
            if mod.detailed_description:
                summary_parts.append(mod.detailed_description)
            summary = "\n\n".join(summary_parts)

            knodes.append(KnowledgeNode(
                title=mod.title,
                summary=summary,
                difficulty_level=difficulty,
                estimated_minutes=estimated_minutes,
                prerequisite_indices=prereq_indices,
                module_id=mod.module_id,
                module_role=mod.module_role,
                core_question=mod.core_question,
                acceptance_artifacts=mod.acceptance_artifacts,
                acceptance_standard=mod.acceptance_standard,
                hands_on_components=mod.hands_on_components,
                outputs_produced=mod.outputs_produced,
            ))

        milestones.append(Milestone(
            title=stage.title,
            description=stage.stage_description,
            knodes=knodes,
        ))

    # Build sub_projects from stages
    sub_projects: list[SubProject] = []
    for idx, stage in enumerate(v5_tree.stages):
        sub_projects.append(SubProject(
            id=stage.stage_id,
            title=stage.title,
            description=stage.stage_description,
            stage_id=stage.stage_id,
            milestone_indices=[idx],
            prerequisite_sub_project_ids=[],
            difficulty=1,
            estimated_hours=0,
            deliverables=[stage.stage_output] if stage.stage_output else [],
            brief=stage.stage_goal,
            task=stage.stage_goal,
            core_problem=stage.why_this_stage_exists,
        ))

    return KnowledgeTree(
        milestones=milestones,
        sub_projects=sub_projects,
        special_nodes=v5_tree.special_nodes,
    )


def milestones_to_v5(tree_data: dict) -> dict:
    """Upgrade legacy milestones-format dict to v5 format dict.

    Used for importing old-format trees. Fields that don't exist in the
    legacy format are filled with sensible defaults.
    """
    milestones = tree_data.get("milestones", [])
    sub_projects = tree_data.get("sub_projects", [])
    special_nodes = tree_data.get("special_nodes", [])

    # Build global_index -> module_id mapping
    # We need this to convert prerequisite_indices -> depends_on
    index_to_module_id: dict[int, str] = {}
    global_idx = 0
    for ms_idx, ms in enumerate(milestones):
        for kn_idx, kn in enumerate(ms.get("knodes", [])):
            mid = kn.get("module_id", "")
            if not mid:
                mid = f"S{ms_idx + 1}-M{kn_idx + 1:02d}"
            index_to_module_id[global_idx] = mid
            global_idx += 1

    # Convert milestones -> stages + modules
    stages = []
    modules = []
    global_idx = 0

    for ms_idx, ms in enumerate(milestones):
        stage_id = f"S{ms_idx + 1}"

        # Try to find matching sub_project for richer metadata
        sp = next(
            (sp for sp in sub_projects if ms_idx in sp.get("milestone_indices", [])),
            None,
        )

        stages.append({
            "stage_id": sp.get("stage_id", stage_id) if sp else stage_id,
            "title": ms.get("title", stage_id),
            "stage_goal": sp.get("brief", "") if sp else "",
            "stage_description": ms.get("description", ""),
            "why_this_stage_exists": sp.get("core_problem", "") if sp else "",
            "stage_output": (sp.get("deliverables", [""])[0] if sp and sp.get("deliverables") else ""),
        })

        actual_stage_id = stages[-1]["stage_id"]

        for kn_idx, kn in enumerate(ms.get("knodes", [])):
            mid = kn.get("module_id", "")
            if not mid:
                mid = index_to_module_id[global_idx]

            # Convert prerequisite_indices -> depends_on
            depends_on = [
                index_to_module_id[pi]
                for pi in kn.get("prerequisite_indices", [])
                if pi in index_to_module_id
            ]

            modules.append({
                "module_id": mid,
                "title": kn.get("title", ""),
                "stage_id": actual_stage_id,
                "sequence_order": kn_idx + 1,
                "module_role": kn.get("module_role", ""),
                "summary": kn.get("summary", ""),
                "core_question": kn.get("core_question", ""),
                "acceptance_artifacts": kn.get("acceptance_artifacts", []),
                "acceptance_standard": kn.get("acceptance_standard", []),
                "hands_on_components": kn.get("hands_on_components", []),
                "outputs_produced": kn.get("outputs_produced", []),
                "depends_on": depends_on,
            })
            global_idx += 1

    # Build edges from depends_on
    edges = []
    edge_idx = 0
    for mod in modules:
        for dep_id in mod.get("depends_on", []):
            edge_idx += 1
            edges.append({
                "edge_id": f"E{edge_idx:03d}",
                "from_module_id": dep_id,
                "to_module_id": mod["module_id"],
                "relation_type": "prerequisite",
            })

    result = {
        "schema_version": "5.0",
        "stages": stages,
        "modules": modules,
        "edges": edges,
    }
    if special_nodes:
        result["special_nodes"] = special_nodes
    return result
