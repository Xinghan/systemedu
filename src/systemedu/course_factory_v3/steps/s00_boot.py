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

    ctx = {
        "project_name": project_name,
        "knode_id": knode_id,
        "user_id": user_id,
        "knode": knode,
        "milestone": milestone,
        "sub_project": sub_project,
        "module_role": knode.get("module_role", ""),
        "category": project_meta.get("category", ""),
        "knowledge_level": project_meta.get("knowledge_level", "K3"),
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
