"""Step 0: 加载 knode 上下文 + 推送开工声明事件。

实现 SKILL.md §13-43 的"启动协议"。
"""

from __future__ import annotations

from ..progress import EV_BOOT, Emitter


async def run(
    project_name: str,
    knode_id: int,
    *,
    user_id: str = "default",
    overrides: dict,
    em: Emitter,
) -> dict:
    from course_factory.factory import load_knode_context

    raw = load_knode_context(project_name, knode_id)
    knode = raw["knode"]
    milestone = raw["milestone"]
    sub_project = raw["sub_project"]

    # 项目级元数据(category / knowledge_level)从 project.yaml 读
    project_meta = _load_project_meta(project_name)

    # 节点级 knowledge_level: 按 module_role 推导, 不直接用 project.yaml 的最终等级。
    # 项目最终 K5 ≠ 启蒙节点应该按 K5 写; foundation 节点必须 K1, capstone 才用 project 最终等级。
    module_role = knode.get("module_role", "")
    project_max_level = project_meta.get("knowledge_level", "K3")
    node_knowledge_level = _infer_node_level(module_role, project_max_level)

    ctx = {
        "project_name": project_name,
        "knode_id": knode_id,
        "user_id": user_id,
        "knode": knode,
        "milestone": milestone,
        "sub_project": sub_project,
        "module_role": module_role,
        "category": project_meta.get("category", ""),
        "knowledge_level": node_knowledge_level,
        "project_max_knowledge_level": project_max_level,
        "age_range": project_meta.get("age_range", [10, 15]),
        "overrides": overrides,
    }

    # 开工声明 SSE 事件 — F.0.1 验收点
    em.emit(EV_BOOT, {
        "project_name": project_name,
        "knode_id": knode_id,
        "module_role": ctx["module_role"],
        "category": ctx["category"],
        "knowledge_level": ctx["knowledge_level"],
        "core_question": knode.get("core_question", ""),
        "node_title": knode.get("name") or knode.get("title", ""),
        "milestone_title": milestone.get("title", ""),
        "overrides": overrides,
        "checklist": [
            "0 加载上下文",
            "0.5 Tavily 外部研究",
            "0.7 LabXchange 匹配",
            "1 plan_markdown",
            "1.5 theories",
            "2 8 类富媒体逐条 debate",
            "2.5 Ideation Divergence",
            "2.6 Creativity Gate",
            "3 Ideas 详细描述",
            "4 Debate 决策",
            "5 实现 HTML / exercises JSON",
            "5.5 五道闸门",
            "6 make_course_content + preflight + upsert",
            "6.5 generate_assignment",
            "6.6 generate_audio_scripts",
        ],
    })
    return ctx


def _infer_node_level(module_role: str, project_max_level: str) -> str:
    """按 module_role 推导节点级 knowledge_level。

    foundation → K1 (启蒙)
    core       → K2 (基础概念巩固)
    deepening  → K3 (深化)
    synthesis  → K4 (整合)
    capstone   → 项目最终等级 (通常 K5)

    若 module_role 未知, 退回 K3 中性默认。
    若推导值 > project_max_level, clamp 到 project_max_level。
    """
    role = (module_role or "").lower()
    role_map = {
        "foundation": "K1",
        "core":       "K2",
        "deepening":  "K3",
        "synthesis":  "K4",
        "capstone":   project_max_level or "K5",
    }
    inferred = role_map.get(role, "K3")
    # clamp: 若项目最高 K2 但 role 推到 K3, 不让超过项目天花板
    def _level_num(lv: str) -> int:
        return int(lv[1:]) if lv and lv.startswith("K") and lv[1:].isdigit() else 3
    if _level_num(inferred) > _level_num(project_max_level):
        return project_max_level
    return inferred


def _load_project_meta(project_name: str) -> dict:
    """从 projects/<name>/project.yaml 读取项目级元数据。"""
    import yaml
    from pathlib import Path
    ROOT = Path(__file__).resolve().parents[4]
    yaml_path = ROOT / "projects" / project_name / "project.yaml"
    if not yaml_path.exists():
        return {}
    try:
        return yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}
