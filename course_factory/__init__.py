"""Course factory: rich-media course content generator.

Public API re-exported from factory module for convenience::

    # 旧模式 (本地单用户, 写 SQLite)
    from course_factory import (
        load_context, make_course_content, save_knode,
        make_exercises, preflight_v41, ensure_db_tables, upsert_lesson,
    )

    # 新模式 (workspace, spec 023 后默认, 写 content-workspace/generated/)
    from course_factory import (
        load_blueprint_for_workspace,
        generate_knowledge_tree_from_blueprint,
        load_knode_context_from_workspace,
        save_knode_to_workspace,
        WorkspaceKnodeContext,
    )

See ``.claude/skills/course_factory/SKILL.md`` for the full creation workflow.
"""
from .factory import *  # noqa: F401, F403
from .workspace_bridge import (  # noqa: F401
    WorkspaceKnodeContext,
    clear_knode_workspace,
    generate_knowledge_tree_from_blueprint,
    get_knowledge_tree,
    load_blueprint_for_workspace,
    load_knode_context_from_workspace,
    save_knode_to_workspace,
)
