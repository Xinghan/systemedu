"""Planner Agent - generates knowledge trees (migrated from backend/agents/planner.py)."""

import json

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent
from systemedu.core.llm_client import get_llm


def _compute_tree_scale(target_nodes: int) -> dict:
    """Compute milestone and node ranges based on target node count."""
    if target_nodes <= 15:
        return {"milestones": "2-3", "nodes_per": "2-5", "target": target_nodes}
    elif target_nodes <= 50:
        return {"milestones": "3-6", "nodes_per": "3-10", "target": target_nodes}
    elif target_nodes <= 150:
        return {"milestones": "5-10", "nodes_per": "8-15", "target": target_nodes}
    else:
        return {"milestones": "8-15", "nodes_per": "15-35", "target": target_nodes}


PLANNER_SYSTEM_PROMPT = """你是 SystemEdu 的课程规划 AI。你的任务是将一个工业级项目拆解为适合 {age} 岁学生的完整知识树。

要求：
1. 将项目拆解为 {milestones} 个里程碑（Milestone），由浅入深
2. 每个里程碑包含 {nodes_per} 个知识节点（KNode）
3. 目标总节点数约为 {target} 个，请尽量接近此数量
4. 知识节点必须是原子化的、可验收的学习单元
5. 根据学生年龄调整难度：6-9岁极简化，10-13岁可引入基础术语，14-18岁可接近专业
6. 标注每个节点的前置依赖（哪些节点必须先完成）

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


class PlannerAgent(BaseAgent):
    """Generates knowledge trees from project descriptions."""

    name = "planner"
    description = "课程规划, 将项目拆解为知识树"

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        age = ctx.get("user_age", 12)
        target_nodes = ctx.get("target_nodes", 20)

        scale = _compute_tree_scale(target_nodes)

        provider = self.config.llm_provider if self.config else None
        llm = get_llm(provider=provider, temperature=0.3, streaming=False)

        system_msg = SystemMessage(content=PLANNER_SYSTEM_PROMPT.format(
            age=age,
            milestones=scale["milestones"],
            nodes_per=scale["nodes_per"],
            target=scale["target"],
        ))
        user_msg = HumanMessage(content=message)

        response = llm.invoke([system_msg, user_msg])
        return response.content

    def generate_tree(self, project_title: str, project_description: str, user_age: int = 12) -> dict:
        """Generate a knowledge tree and return parsed JSON."""
        import asyncio

        content = asyncio.get_event_loop().run_until_complete(
            self.process(
                f"项目标题：{project_title}\n项目描述：{project_description}",
                context={"user_age": user_age},
            )
        )

        # Extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        return json.loads(content.strip())
