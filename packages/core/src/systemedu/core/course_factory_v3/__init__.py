"""Course Factory v3 — 程序化复刻 course_factory/SKILL.md 的 12 步流水线。

入口:
    from systemedu.core.course_factory_v3 import generate_course_v3

调用形式:
    result = await generate_course_v3(
        project_name="rocket-design",
        knode_id=0,
        progress_cb=lambda event, data: ...,  # SSE
        regenerate=False,
        overrides={"skip_research": False, ...},
    )
"""

from .pipeline import generate_course_v3

__all__ = ["generate_course_v3"]
