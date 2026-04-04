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


def _convert_v41_tree(raw_data: dict) -> dict:
    """Convert v4.1 knowledge tree (stages + modules) to internal milestones format."""
    stages = raw_data["stages"]
    modules = raw_data["modules"]

    # Build stage_id -> stage info lookup
    stage_map = {s["stage_id"]: s for s in stages}
    stage_order = [s["stage_id"] for s in stages]

    # Group modules by stage_id, sorted by sequence_order
    stage_modules: dict[str, list[dict]] = {}
    for mod in modules:
        sid = mod.get("stage_id", "")
        stage_modules.setdefault(sid, []).append(mod)
    for sid in stage_modules:
        stage_modules[sid].sort(key=lambda m: m.get("sequence_order", 0))

    # Build module_id -> global_index mapping (ordered by stage then sequence)
    module_id_to_index: dict[str, int] = {}
    global_idx = 0
    for sid in stage_order:
        for mod in stage_modules.get(sid, []):
            module_id_to_index[mod["module_id"]] = global_idx
            global_idx += 1

    # Convert stages -> milestones, modules -> knodes
    milestones = []
    for sid in stage_order:
        stage = stage_map[sid]
        mods = stage_modules.get(sid, [])

        knodes = []
        for mod in mods:
            # difficulty from knowledge_level
            kl = mod.get("knowledge_level", "K1")
            difficulty = _K_LEVEL_MAP.get(kl, 1)

            # prerequisite_indices from depends_on
            depends_on = mod.get("depends_on", [])
            prereq_indices = []
            for dep_id in depends_on:
                if dep_id in module_id_to_index:
                    prereq_indices.append(module_id_to_index[dep_id])

            # estimated_minutes from duration_months
            dur_months = _parse_duration_months(
                mod.get("estimated_duration_months", "1")
            )
            estimated_minutes = max(15, round(dur_months * 360))

            # Build summary from summary + detailed_description
            summary_parts = []
            if mod.get("summary"):
                summary_parts.append(mod["summary"])
            if mod.get("detailed_description"):
                summary_parts.append(mod["detailed_description"])
            summary = "\n\n".join(summary_parts)

            knodes.append({
                "title": mod.get("title", ""),
                "summary": summary,
                "difficulty_level": difficulty,
                "estimated_minutes": estimated_minutes,
                "prerequisite_indices": prereq_indices,
                "module_id": mod.get("module_id", ""),
                "module_role": mod.get("module_role", ""),
                "core_question": mod.get("core_question", ""),
                "acceptance_artifacts": mod.get("acceptance_artifacts", []),
                "acceptance_standard": mod.get("acceptance_standard", []),
                "hands_on_components": mod.get("hands_on_components", []),
                "outputs_produced": mod.get("outputs_produced", []),
            })

        milestones.append({
            "title": stage.get("title", sid),
            "description": stage.get("stage_description", ""),
            "knodes": knodes,
        })

    # Build sub_projects from stages
    sub_projects = []
    # Build stage_id -> milestone index
    stage_id_to_ms_idx = {sid: idx for idx, sid in enumerate(stage_order)}

    for stage in stages:
        sid = stage["stage_id"]
        ms_idx = stage_id_to_ms_idx.get(sid, 0)

        # Get module indices for this stage
        mods = stage_modules.get(sid, [])
        milestone_indices = [ms_idx]

        sub_projects.append({
            "id": sid,
            "title": stage.get("title", ""),
            "description": stage.get("stage_description", ""),
            "stage_id": sid,
            "milestone_indices": milestone_indices,
            "prerequisite_sub_project_ids": [],
            "difficulty": 1,
            "estimated_hours": 0,
            "deliverables": [stage.get("stage_output", "")],
            "brief": stage.get("stage_goal", ""),
            "task": stage.get("stage_goal", ""),
            "core_problem": stage.get("why_this_stage_exists", ""),
            "acceptance_criteria": [],
        })

    result: dict = {"milestones": milestones}
    if sub_projects:
        result["sub_projects"] = sub_projects
    return result


_LEVEL_MAP = {
    "L0-启蒙": 1,
    "L0": 1,
    "L1-入门": 2,
    "L1-认识": 2,
    "L1": 2,
    "L2-基础": 3,
    "L2-操作": 3,
    "L2": 3,
    "L3-进阶": 5,
    "L3-应用": 5,
    "L3": 5,
    "L4-高级": 7,
    "L4-解释": 7,
    "L4": 7,
    "L5-专家": 9,
    "L5-迁移": 9,
    "L5": 9,
}


def convert_uploaded_tree(raw_data: dict) -> dict:
    """Convert uploaded knowledge tree to internal milestones format.

    Auto-detects format:
    - If `raw_data` has "milestones" key → already internal format, return as-is.
    - If `raw_data` has "stages" + "modules" → v4.1 format, convert.
    - If `raw_data` has "知识树节点" key → tree_leaf format, convert.

    Raises ValueError if format is unrecognized.
    """
    if "milestones" in raw_data:
        return raw_data

    if "stages" in raw_data and "modules" in raw_data:
        return _convert_v41_tree(raw_data)

    if "知识树节点" not in raw_data:
        raise ValueError(
            "Unrecognized format: must contain 'milestones', "
            "'stages'+'modules', or '知识树节点' key"
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

    # Build sub_projects from stage overview if available
    sub_projects = []
    stage_overview = raw_data.get("阶段总览", [])
    if stage_overview:
        # Map module_id -> milestone index
        module_id_to_ms_idx = {mid: idx for idx, mid in enumerate(sorted_module_ids)}

        for stage in stage_overview:
            stage_modules = stage.get("包含模块", [])
            ms_indices = [
                module_id_to_ms_idx[mid]
                for mid in stage_modules
                if mid in module_id_to_ms_idx
            ]
            prereq_stages = stage.get("前置阶段_全部满足", stage.get("前置阶段", []))
            # Map stage_id -> sub_project_id via lookup
            stage_to_sp = {s.get("阶段id", ""): s.get("子项目id", "") for s in stage_overview}
            prereq_sp_ids = [
                stage_to_sp[sid] for sid in prereq_stages if sid in stage_to_sp
            ]

            handover_raw = stage.get("完成后输出给下一阶段", {})
            handover = {}
            if isinstance(handover_raw, dict):
                handover = {
                    "outputs": handover_raw.get("输出物", []),
                    "method": handover_raw.get("交接方式", ""),
                }

            sub_projects.append(
                {
                    "id": stage.get("子项目id", ""),
                    "title": stage.get("阶段名称", ""),
                    "description": stage.get("阶段目标", ""),
                    "stage_id": stage.get("阶段id", ""),
                    "milestone_indices": ms_indices,
                    "prerequisite_sub_project_ids": prereq_sp_ids,
                    "difficulty": stage.get("阶段难度评分", 1),
                    "estimated_hours": stage.get("建议学习时长_小时", 0),
                    "deliverables": stage.get("阶段交付物", []),
                    "brief": stage.get("子项目一句话说明", ""),
                    "task": stage.get("本阶段任务是什么", ""),
                    "core_problem": stage.get("本阶段核心问题", ""),
                    "inputs": stage.get("本阶段输入", []),
                    "data_usage": stage.get("本阶段使用数据", []),
                    "demo_unit": stage.get("本阶段演示_验收单元", ""),
                    "why_separate": stage.get("为什么独立成验收单元", ""),
                    "handover": handover,
                    "acceptance_criteria": stage.get("阶段验收标准", []),
                }
            )

    result: dict = {"milestones": milestones}
    if sub_projects:
        result["sub_projects"] = sub_projects
    return result


def extract_project_brief(raw_data: dict) -> dict | None:
    """Extract project brief card from uploaded knowledge tree.

    Supports v2 tree_leaf format (项目总说明卡) and v4.1 format (project_positioning).

    Returns a dict suitable for writing as project_brief.json,
    or None if no brief card is present.
    """
    # v4.1 format
    positioning = raw_data.get("project_positioning")
    if isinstance(positioning, dict):
        return {
            "one_liner": positioning.get("project_summary", ""),
            "real_problem": positioning.get("why_it_is_industrial", ""),
            "what_we_do": [positioning.get("final_system_goal", "")],
            "what_we_dont": [],
            "data_sources": [],
            "min_success": "",
            "recommended_success": "",
            "final_deliverables": [],
            "final_demo": positioning.get("real_world_scope", ""),
            "industry_relation": positioning.get("why_it_is_industrial", ""),
        }

    # v2 tree_leaf format
    brief_card = raw_data.get("项目总说明卡")
    if not isinstance(brief_card, dict):
        return None

    data_sources = []
    for ds in brief_card.get("使用什么数据", []):
        if isinstance(ds, dict):
            data_sources.append({
                "name": ds.get("数据名称", ""),
                "role": ds.get("数据角色", ""),
                "source": ds.get("数据来源", ""),
                "why": ds.get("为什么用它", ""),
                "stages": ds.get("在项目中的使用阶段", []),
            })

    return {
        "one_liner": brief_card.get("一句话项目定义", ""),
        "real_problem": brief_card.get("真实问题", ""),
        "what_we_do": brief_card.get("我们具体做什么", []),
        "what_we_dont": brief_card.get("我们不做什么", []),
        "data_sources": data_sources,
        "min_success": brief_card.get("最低成功目标", ""),
        "recommended_success": brief_card.get("推荐成功目标", ""),
        "final_deliverables": brief_card.get("最终交付物", []),
        "final_demo": brief_card.get("最后展示应该长什么样", ""),
        "industry_relation": brief_card.get("与工业版的关系", ""),
    }


def extract_project_meta(raw_data: dict) -> dict:
    """Extract project metadata from uploaded knowledge tree.

    Supports v2 tree_leaf format and v4.1 format.

    Returns a dict suitable for project.yaml fields.
    """
    meta: dict = {}

    # v4.1 format
    if "stages" in raw_data and "modules" in raw_data:
        if "title" in raw_data:
            meta["title"] = raw_data["title"]
        if "description" in raw_data:
            meta["description"] = raw_data["description"]

        # Extract domain -> category mapping
        identity = raw_data.get("project_identity", {})
        domain = identity.get("domain", "")
        domain_to_category = {
            "space_robotics": "aerospace",
            "aerospace": "aerospace",
            "biotech": "biotech",
            "ai": "ai",
            "music": "music",
            "climate": "climate",
            "robotics": "robotics",
            "chemistry": "chemistry",
            "math": "math",
            "cs": "cs",
        }
        meta["category"] = domain_to_category.get(domain, "other")

        # Extract age from target_learner
        learner = raw_data.get("target_learner", {})
        entry = learner.get("entry_profile", "")
        # Try to extract age like "10 岁" or "约 10 岁"
        import re
        age_match = re.search(r"(\d+)\s*岁", entry)
        if age_match:
            start_age = int(age_match.group(1))
            meta["age_range"] = [start_age, 18]

        # Estimate hours from module durations
        modules = raw_data.get("modules", [])
        total_months = 0.0
        for m in modules:
            dur = m.get("estimated_duration_months", "1")
            total_months += _parse_duration_months(dur)
        # Roughly 6 hours per month of study
        meta["estimated_hours"] = max(1, round(total_months * 6))

        return meta

    # v2 tree_leaf format
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
