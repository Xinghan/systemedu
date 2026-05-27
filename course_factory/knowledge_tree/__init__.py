"""SystemEdu 平台学科理论知识树 (spec 035).

11 学科 baseline 知识图谱 (每学科一棵独立子树), 用于:
- project 级点亮: course_factory.lit_tree 跑 agent 把项目教的知识点映射到树上
- 前端展示: student-web 项目详情页 "知识树" tab

学科间**不**互相 prerequisites — 简化第一版.
"""

from course_factory.knowledge_tree.schema import (
    DepthLevel,
    PlatformTree,
    Subject,
    SubjectId,
    TreeNode,
    load_platform_tree,
)

__all__ = [
    "DepthLevel",
    "PlatformTree",
    "Subject",
    "SubjectId",
    "TreeNode",
    "load_platform_tree",
]
