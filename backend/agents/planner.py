"""Planner Agent - decomposes a project into a knowledge tree (milestones + knodes)."""

import json

from langchain_core.messages import HumanMessage, SystemMessage

from .llm import get_llm

PLANNER_SYSTEM_PROMPT = """你是 SystemEdu 的课程规划 AI。你的任务是将一个工业级项目拆解为适合 {age} 岁学生的完整知识树。

要求：
1. 将项目拆解为 3-6 个里程碑（Milestone），由浅入深
2. 每个里程碑包含 2-5 个知识节点（KNode）
3. 知识节点必须是原子化的、可验收的学习单元
4. 根据学生年龄调整难度：6-9岁极简化，10-13岁可引入基础术语，14-18岁可接近专业
5. 标注每个节点的前置依赖（哪些节点必须先完成）

你必须严格返回以下 JSON 格式（不要返回其他内容）：

```json
{{
  "milestones": [
    {{
      "title": "里程碑标题",
      "description": "里程碑描述",
      "order": 0,
      "knodes": [
        {{
          "title": "知识节点标题",
          "summary": "节点简介（1-2句话）",
          "difficulty_level": 1,
          "content_type": "text|interactive|code|experiment|quiz|video",
          "acceptance_type": "quiz|code_submit|essay|demo|auto",
          "estimated_minutes": 15,
          "xp_reward": 20,
          "order": 0,
          "prerequisite_indices": []
        }}
      ]
    }}
  ]
}}
```

prerequisite_indices 使用全局节点索引（从0开始，按里程碑顺序编号所有节点）。
例如第一个里程碑有3个节点（索引0,1,2），第二个里程碑第一个节点索引为3。"""


def generate_knowledge_tree(
    project_title: str,
    project_description: str,
    user_age: int = 12,
) -> dict:
    """Call LLM to generate a knowledge tree for a project.

    Returns parsed JSON dict with milestones and knodes.
    """
    llm = get_llm(temperature=0.3, streaming=False)

    system_msg = SystemMessage(
        content=PLANNER_SYSTEM_PROMPT.format(age=user_age)
    )
    user_msg = HumanMessage(
        content=f"项目标题：{project_title}\n项目描述：{project_description}"
    )

    response = llm.invoke([system_msg, user_msg])
    content = response.content

    # Extract JSON from response (handle markdown code blocks)
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]

    return json.loads(content.strip())


def save_knowledge_tree(project, tree_data: dict) -> dict:
    """Save a generated knowledge tree to the database.

    Args:
        project: Project model instance
        tree_data: parsed JSON from generate_knowledge_tree()

    Returns:
        dict with counts of created milestones and knodes
    """
    from apps.projects.models import KnowledgeNode, Milestone

    created_knodes = []
    milestone_count = 0

    for ms_data in tree_data["milestones"]:
        milestone = Milestone.objects.create(
            project=project,
            title=ms_data["title"],
            description=ms_data.get("description", ""),
            order=ms_data["order"],
            xp_reward=sum(k.get("xp_reward", 20) for k in ms_data["knodes"]),
        )
        milestone_count += 1

        for kn_data in ms_data["knodes"]:
            knode = KnowledgeNode.objects.create(
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
            created_knodes.append(knode)

    # Set prerequisites using global indices
    global_index = 0
    for ms_data in tree_data["milestones"]:
        for kn_data in ms_data["knodes"]:
            prereq_indices = kn_data.get("prerequisite_indices", [])
            if prereq_indices:
                current_knode = created_knodes[global_index]
                for idx in prereq_indices:
                    if 0 <= idx < len(created_knodes) and idx != global_index:
                        current_knode.prerequisites.add(created_knodes[idx])
            global_index += 1

    return {
        "milestones_created": milestone_count,
        "knodes_created": len(created_knodes),
    }
