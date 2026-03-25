"""Planner Agent - generates knowledge trees (migrated from backend/agents/planner.py)."""

import json
import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent
from systemedu.core.llm_client import get_llm

logger = logging.getLogger(__name__)


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


# ── Step 1: Curriculum outline ────────────────────────────────────────────────

OUTLINE_PROMPT = """你是 SystemEdu 的课程架构师。为以下项目设计课程大纲。

项目：{title}
描述：{description}
学生年龄：{age} 岁
目标节点数：约 {target} 个

请将课程拆分为 {milestones} 个里程碑，每个里程碑内列出该阶段应掌握的知识点群组。

【重要的结构原则】
真实的知识图谱并非一条直线，而是一棵有宽度的树。请分析每个里程碑内的知识点，判断：
- 哪些知识点是**概念并列**的（例如"速度/加速度/位移"都是运动学基础，可以并列学习）
- 哪些知识点是**真实串行**的（例如"理解力的概念"必须先于"牛顿第二定律"）

将知识点按"主题群"组织，每个主题群内的节点是并列的，主题群之间才是串行的。

返回以下 JSON（只返回 JSON）：
```json
{{
  "milestones": [
    {{
      "title": "里程碑名",
      "description": "本阶段核心目标",
      "topic_groups": [
        {{
          "group_name": "主题群名",
          "is_parallel": true,
          "topics": ["知识点A", "知识点B", "知识点C"]
        }}
      ]
    }}
  ]
}}
```

is_parallel=true 表示该群内各 topic 互相独立可并行，is_parallel=false 表示该群内 topics 有真实串行依赖。"""


# ── Step 2: Full node expansion ───────────────────────────────────────────────

EXPAND_PROMPT = """你是 SystemEdu 的课程节点设计师。根据课程大纲，生成完整的知识树 JSON。

项目：{title}，学生年龄：{age} 岁

大纲：
{outline}

【节点生成规则】
1. 每个 topic 对应 1 个知识节点；复杂 topic 可拆成 2 个节点（基础 + 进阶）
2. prerequisite_indices 使用**全局节点索引**（所有节点从 0 开始连续编号，按里程碑顺序）
3. 依赖关系必须基于**真实的知识依赖**——即"不掌握 A，就无法理解 B"才能建立依赖。
   判断标准：
   - 如果学生可以在不了解另一个节点的情况下学习某节点，两者之间**不应有依赖**
   - 如果两个节点只是"同一领域"但互相独立，它们应该并列（都依赖同一个前置）
   - 只有当 A 是理解 B 的逻辑前提（定义、公式推导、概念基础）时，才建立 B→A 的依赖
   具体规则：
   - is_parallel=true 的主题群：节点之间**绝对不要互相依赖**（都指向群外的共同前置，或空列表）
   - is_parallel=false 的主题群：仔细判断每个 topic 是否真的依赖前一个；若无真实依赖，改为并列
   - 每个里程碑的入口节点，依赖上一个里程碑的最后若干节点（表示里程碑间的顺序关系）
4. 节点难度根据 {age} 岁学生调整，estimated_minutes 在 10-30 之间

只返回 JSON，格式如下：
```json
{{
  "milestones": [
    {{
      "title": "里程碑标题",
      "description": "里程碑描述",
      "order": 0,
      "knodes": [
        {{
          "title": "节点标题",
          "summary": "1-2句话简介",
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
```"""


class PlannerAgent(BaseAgent):
    """Generates knowledge trees using a 2-step outline→expand pipeline."""

    name = "planner"
    description = "课程规划, 将项目拆解为知识树"

    async def process(self, message: str, context: dict | None = None) -> str:
        """2-step pipeline: outline (with parallel/serial analysis) → expand."""
        ctx = context or {}
        age = ctx.get("user_age", 12)
        target_nodes = ctx.get("target_nodes", 20)

        lines = message.strip().splitlines()
        title = lines[0].replace("项目标题：", "").strip() if lines else message
        description = lines[1].replace("项目描述：", "").strip() if len(lines) > 1 else ""

        provider = self.config.llm_provider if self.config else None
        llm = get_llm(provider=provider, temperature=0.4, streaming=False)
        scale = _compute_tree_scale(target_nodes)

        # ── Step 1: Structured outline with parallel/serial grouping ──────
        logger.info(f"[Planner] Step 1: outline for '{title}' (~{target_nodes} nodes)")
        outline_resp = await llm.ainvoke([
            SystemMessage(content="你是课程架构师，只输出要求的JSON，不添加任何说明。"),
            HumanMessage(content=OUTLINE_PROMPT.format(
                title=title,
                description=description,
                age=age,
                target=target_nodes,
                milestones=scale["milestones"],
            )),
        ])
        outline_json = _extract_json(outline_resp.content)
        n_milestones = len(outline_json.get("milestones", []))
        logger.info(f"[Planner] Step 1 done: {n_milestones} milestones")

        # ── Step 2: Expand to full node tree ──────────────────────────────
        logger.info(f"[Planner] Step 2: expanding to full node tree")
        expand_resp = await llm.ainvoke([
            SystemMessage(content="你是课程节点设计师，只输出要求的JSON，不添加任何说明。"),
            HumanMessage(content=EXPAND_PROMPT.format(
                title=title,
                age=age,
                outline=json.dumps(outline_json, ensure_ascii=False, indent=2),
            )),
        ])
        tree_json = _extract_json(expand_resp.content)
        total_nodes = sum(len(m.get("knodes", [])) for m in tree_json.get("milestones", []))
        logger.info(f"[Planner] Step 2 done: {total_nodes} total nodes")

        return json.dumps(tree_json, ensure_ascii=False)

    def generate_tree(self, project_title: str, project_description: str, user_age: int = 12) -> dict:
        """Generate a knowledge tree and return parsed JSON."""
        import asyncio
        content = asyncio.get_event_loop().run_until_complete(
            self.process(
                f"项目标题：{project_title}\n项目描述：{project_description}",
                context={"user_age": user_age},
            )
        )
        return json.loads(content)


def _extract_json(content: str) -> dict:
    """Extract JSON from LLM response (fenced block or raw object)."""
    for pattern in [r"```json\s*\n?(.*?)```", r"```\s*\n?(.*?)```"]:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                pass

    brace_start = content.find("{")
    if brace_start >= 0:
        depth = 0
        for i in range(brace_start, len(content)):
            if content[i] == "{":
                depth += 1
            elif content[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(content[brace_start: i + 1])
                    except json.JSONDecodeError:
                        break

    raise ValueError("No valid JSON found in LLM response")
