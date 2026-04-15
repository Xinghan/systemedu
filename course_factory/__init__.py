"""Course factory: rich-media course content generator.

Public API re-exported from factory module for convenience::

    from course_factory import (
        load_context, make_course_content, save_knode,
        make_exercises, preflight_v41, ensure_db_tables, upsert_lesson,
    )

See ``.claude/skills/course_factory/SKILL.md`` for the full creation workflow.
"""
from .factory import *  # noqa: F401, F403
