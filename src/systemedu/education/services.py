"""Knowledge tree validation and import/export services.

Migrated from backend/apps/projects/services.py, removing Django ORM dependency.
All formats are normalized to v5 (stages/modules/edges) as the canonical internal format.
"""

from collections import deque

from .models import AcceptanceType, ContentType, V5KnowledgeTree
from .tree_adapter import milestones_to_v5

_CONTENT_TYPES = {e.value for e in ContentType}
_ACCEPTANCE_TYPES = {e.value for e in AcceptanceType}


class KnowledgeTreeValidationError(Exception):
    """Raised when tree_data fails validation."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__(f"Validation failed: {errors}")


# ---------------------------------------------------------------------------
# Validation for legacy milestones format (used by adapter output validation)
# ---------------------------------------------------------------------------

def validate_milestones_tree(tree_data: dict) -> list[str]:
    """Validate a legacy milestones-format knowledge tree dict.

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


# Keep backward-compat alias
validate_knowledge_tree = validate_milestones_tree


# ---------------------------------------------------------------------------
# v5 native validation
# ---------------------------------------------------------------------------

def validate_v5_tree(tree_data: dict) -> list[str]:
    """Validate a v5-format knowledge tree dict (stages/modules/edges).

    Returns a list of error strings (empty = valid).
    """
    errors: list[str] = []

    if not isinstance(tree_data, dict):
        return ["tree_data must be a dict"]

    stages = tree_data.get("stages")
    if not isinstance(stages, list) or len(stages) == 0:
        return ["'stages' must be a non-empty list"]

    modules = tree_data.get("modules")
    if not isinstance(modules, list) or len(modules) == 0:
        return ["'modules' must be a non-empty list"]

    # Collect valid stage_ids
    stage_ids = set()
    for s_idx, stage in enumerate(stages):
        if not isinstance(stage, dict):
            errors.append(f"stages[{s_idx}] must be a dict")
            continue
        sid = stage.get("stage_id")
        if not sid or not isinstance(sid, str):
            errors.append(f"stages[{s_idx}].stage_id is required and must be a string")
        else:
            if sid in stage_ids:
                errors.append(f"stages[{s_idx}].stage_id '{sid}' is duplicate")
            stage_ids.add(sid)
        if "title" not in stage or not isinstance(stage.get("title"), str):
            errors.append(f"stages[{s_idx}].title is required and must be a string")

    # Collect valid module_ids and check references
    module_ids = set()
    for m_idx, mod in enumerate(modules):
        if not isinstance(mod, dict):
            errors.append(f"modules[{m_idx}] must be a dict")
            continue
        mid = mod.get("module_id")
        if not mid or not isinstance(mid, str):
            errors.append(f"modules[{m_idx}].module_id is required and must be a string")
        else:
            if mid in module_ids:
                errors.append(f"modules[{m_idx}].module_id '{mid}' is duplicate")
            module_ids.add(mid)
        if "title" not in mod or not isinstance(mod.get("title"), str):
            errors.append(f"modules[{m_idx}].title is required and must be a string")
        msid = mod.get("stage_id", "")
        if msid and stage_ids and msid not in stage_ids:
            errors.append(f"modules[{m_idx}].stage_id '{msid}' not found in stages")

    if errors:
        return errors

    # Validate depends_on references and detect cycles
    adjacency: dict[str, list[str]] = {mid: [] for mid in module_ids}
    in_degree: dict[str, int] = {mid: 0 for mid in module_ids}

    for mod in modules:
        mid = mod.get("module_id", "")
        for dep_id in mod.get("depends_on", []):
            if dep_id == mid:
                errors.append(f"modules '{mid}' depends_on contains self-reference")
            elif dep_id not in module_ids:
                errors.append(f"modules '{mid}' depends_on references unknown module '{dep_id}'")
            else:
                adjacency[dep_id].append(mid)
                in_degree[mid] += 1

    if errors:
        return errors

    # Kahn's algorithm for cycle detection
    queue = deque([mid for mid in module_ids if in_degree[mid] == 0])
    visited_count = 0

    while queue:
        node = queue.popleft()
        visited_count += 1
        for neighbor in adjacency.get(node, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if visited_count < len(module_ids):
        errors.append("Knowledge tree contains a cycle in module dependencies")

    # Validate edges (optional section)
    edges = tree_data.get("edges", [])
    for e_idx, edge in enumerate(edges):
        if not isinstance(edge, dict):
            errors.append(f"edges[{e_idx}] must be a dict")
            continue
        from_id = edge.get("from_module_id", "")
        to_id = edge.get("to_module_id", "")
        if from_id and from_id not in module_ids:
            errors.append(f"edges[{e_idx}].from_module_id '{from_id}' not found in modules")
        if to_id and to_id not in module_ids:
            errors.append(f"edges[{e_idx}].to_module_id '{to_id}' not found in modules")

    return errors


# ---------------------------------------------------------------------------
# Format detection and conversion -- all paths normalize to v5
# ---------------------------------------------------------------------------

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


def _convert_chinese_to_milestones(raw_data: dict) -> dict:
    """Convert Chinese-key format to legacy milestones dict."""
    nodes = raw_data["知识树节点"]
    module_graph = raw_data.get("模块依赖图", [])

    module_order = [m["模块id"] for m in module_graph] if module_graph else []

    modules: dict[str, list[dict]] = {}
    for node in nodes:
        mid = node.get("模块id", "M00")
        modules.setdefault(mid, []).append(node)

    if module_order:
        sorted_module_ids = [mid for mid in module_order if mid in modules]
        for mid in sorted(modules.keys()):
            if mid not in sorted_module_ids:
                sorted_module_ids.append(mid)
    else:
        sorted_module_ids = sorted(modules.keys())

    module_titles = {}
    for m in module_graph:
        module_titles[m["模块id"]] = m.get("模块标题", m["模块id"])

    node_id_to_index: dict[str, int] = {}
    global_idx = 0
    for mid in sorted_module_ids:
        for node in modules[mid]:
            node_id_to_index[node["id"]] = global_idx
            global_idx += 1

    milestones = []
    for mid in sorted_module_ids:
        module_nodes = modules[mid]
        knodes = []
        for node in module_nodes:
            level_str = node.get("知识等级", "L0")
            difficulty = _LEVEL_MAP.get(level_str, 1)

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

    sub_projects = []
    stage_overview = raw_data.get("阶段总览", [])
    if stage_overview:
        module_id_to_ms_idx = {mid: idx for idx, mid in enumerate(sorted_module_ids)}

        for stage in stage_overview:
            stage_modules = stage.get("包含模块", [])
            ms_indices = [
                module_id_to_ms_idx[mid]
                for mid in stage_modules
                if mid in module_id_to_ms_idx
            ]
            prereq_stages = stage.get("前置阶段_全部满足", stage.get("前置阶段", []))
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


def convert_uploaded_tree(raw_data: dict) -> dict:
    """Convert uploaded knowledge tree to v5 format dict.

    Auto-detects format:
    - If `raw_data` has "stages" + "modules" -> already v5, return as-is.
    - If `raw_data` has "milestones" key -> legacy format, upgrade to v5.
    - If `raw_data` has "知识树节点" key -> Chinese format, convert to milestones then v5.

    Raises ValueError if format is unrecognized.
    """
    # Already v5 format
    if "stages" in raw_data and "modules" in raw_data:
        return raw_data

    # Legacy milestones format
    if "milestones" in raw_data:
        return milestones_to_v5(raw_data)

    # Chinese format -> milestones -> v5
    if "知识树节点" in raw_data:
        milestones_dict = _convert_chinese_to_milestones(raw_data)
        return milestones_to_v5(milestones_dict)

    raise ValueError(
        "Unrecognized format: must contain 'stages'+'modules', "
        "'milestones', or '知识树节点' key"
    )


def extract_project_brief(raw_data: dict) -> dict | None:
    """Extract project brief card from uploaded knowledge tree.

    Supports v2 tree_leaf format (项目总说明卡) and v4.1/v5 format (project_positioning).

    Returns a dict suitable for writing as project_brief.json,
    or None if no brief card is present.
    """
    # v4.1/v5 format
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

    Supports v2 tree_leaf format and v4.1/v5 format.

    Returns a dict suitable for project.yaml fields.
    """
    meta: dict = {}

    # v4.1/v5 format
    if "stages" in raw_data and "modules" in raw_data:
        if "title" in raw_data:
            meta["title"] = raw_data["title"]
        if "description" in raw_data:
            meta["description"] = raw_data["description"]

        identity = raw_data.get("project_identity", {})
        domain = identity.get("domain", "")
        domain_to_category = {
            "space_robotics": "aerospace",
            "aerospace": "aerospace",
            "biotech": "biotech",
            "biotech_health_ai": "biotech",
            "health_ai": "biotech",
            "ai": "ai",
            "music": "music",
            "climate": "climate",
            "robotics": "robotics",
            "chemistry": "chemistry",
            "math": "math",
            "cs": "cs",
        }
        meta["category"] = domain_to_category.get(domain, "other")

        learner = raw_data.get("target_learner", {})
        entry = learner.get("entry_profile", "")
        import re
        age_match = re.search(r"(\d+)\s*岁", entry)
        if age_match:
            start_age = int(age_match.group(1))
            meta["age_range"] = [start_age, 18]

        modules = raw_data.get("modules", [])
        total_months = 0.0
        for m in modules:
            dur = m.get("estimated_duration_months", "1")
            total_months += _parse_duration_months(dur)
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

    nodes = raw_data.get("知识树节点", [])
    total_minutes = sum(n.get("预估学习时长_分钟", 15) for n in nodes)
    meta["estimated_hours"] = max(1, round(total_minutes / 60))

    return meta


def parse_v5_knowledge_tree(
    tree_data: dict, *, validate: bool = True
) -> V5KnowledgeTree:
    """Parse and validate a v5 knowledge tree dict into a V5KnowledgeTree model.

    Auto-detects format and converts to v5 if needed.
    Raises KnowledgeTreeValidationError if validation fails.
    """
    # Auto-convert to v5 if needed
    if "stages" not in tree_data or "modules" not in tree_data:
        tree_data = convert_uploaded_tree(tree_data)

    if validate:
        errors = validate_v5_tree(tree_data)
        if errors:
            raise KnowledgeTreeValidationError(errors)

    return V5KnowledgeTree.model_validate(tree_data)


def parse_knowledge_tree(
    tree_data: dict, *, validate: bool = True
) -> V5KnowledgeTree:
    """Parse a knowledge tree dict into V5KnowledgeTree.

    Backward-compatible entry point -- delegates to parse_v5_knowledge_tree.
    """
    return parse_v5_knowledge_tree(tree_data, validate=validate)
