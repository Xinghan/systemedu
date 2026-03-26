"""CoursePlannerAgent — plans a step-by-step course for a knowledge node."""

import json
import logging

logger = logging.getLogger(__name__)

PLAN_DETAILED_PROMPT = """你是一位经验丰富的教育专家，专门为 6-18 岁学生设计深度学习内容。

请为以下知识节点撰写一份详细的学习计划文档（800-1500字，Markdown格式）。

知识节点：{node_title}
简介：{node_summary}
所属里程碑：{milestone_title}
难度等级：{difficulty}/10

学习计划必须包含以下三个部分：

## 学习目标

列出 3-5 条可验证的学习目标，每条目标用动词开头（如"理解"、"能够描述"、"能够计算"、"掌握"），并说明如何验证是否达成。

## 正文

分 3-5 节，每节包含：
- 二级标题（## 小节名称）
- 每节 200-400 字
- 核心定义或概念的清晰解释
- 至少一个贴近生活的类比或例子
- 该概念的实际应用场景

各节之间应有逻辑递进关系（从基础到深入）。

## 学习路径建议

描述最佳学习顺序：
- 需要先掌握哪些基础知识
- 本节点的学习步骤建议
- 学完后可以进一步探索的方向

要求：
- 全部使用中文
- 语言亲切、适合学生年龄段
- 不使用任何 emoji 符号
- 内容丰富，不少于 800 字
- 直接输出 Markdown 内容，不要添加额外说明
"""

COURSE_PLANNER_PROMPT = """你是一位经验丰富的教育课程设计师，专门为 6-18 岁学生设计步骤式学习体验（类似 Duolingo）。

请为以下知识节点规划一套有序的学习步骤序列。

知识节点：{node_title}
简介：{node_summary}
所属里程碑：{milestone_title}
难度等级：{difficulty}/10
目标年龄段：6-18 岁学习者

设计原则：
1. 按认知流程规划（吸引注意 → 建立概念 → 具化/类比 → 互动体验 → 练习巩固 → 总结回顾）
2. 步骤数量：3-8 步，根据知识点难度和复杂度决定（难度<=3取3-4步，难度4-7取4-6步，难度>=8取6-8步）
3. 禁止为每类内容固定分配步骤，根据知识点特性灵活组合
4. 步骤类型说明：
   - concept：核心概念讲解（markdown）
   - story：故事/类比引入（markdown，本阶段占位）
   - animation：动画演示（本阶段用 markdown 占位）
   - game：互动游戏（使用 GameSpec → GameCompiler 生成 HTML）
   - code：代码示例与解析（markdown）
   - practice：练习题（JSON 格式题目）
   - summary：总结要点（markdown）

请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：
{{
  "node_title": "知识节点标题",
  "total_steps": 5,
  "learning_goal": "完成本课后，学生能够...",
  "steps": [
    {{
      "step_index": 0,
      "type": "concept",
      "title": "步骤标题（简短，5-15字）",
      "duration_minutes": 3,
      "spec": {{
        "prompt_hint": "针对这一步骤的具体内容提示，20-50字"
      }}
    }},
    {{
      "step_index": 1,
      "type": "game",
      "title": "步骤标题",
      "duration_minutes": 5,
      "spec": {{
        "game_mechanic": "drag_sort",
        "game_concept": "描述游戏要让学生理解什么"
      }}
    }},
    {{
      "step_index": 2,
      "type": "practice",
      "title": "步骤标题",
      "duration_minutes": 5,
      "spec": {{
        "exercise_count": 3,
        "prompt_hint": "练习侧重点"
      }}
    }}
  ]
}}

要求：
- game 类型的 spec 必须包含 game_mechanic（可选：drag_sort, simulation, quiz_game, match_game, build_sort）和 game_concept
- practice 类型的 spec 必须包含 exercise_count（3-5道题）
- concept/code/summary/story/animation 类型的 spec 必须包含 prompt_hint
- 全部使用中文（type 字段除外）
- 直接输出 JSON，不要其他文字
"""


class CoursePlannerAgent:
    """Plans a step-by-step course manifest for a knowledge node."""

    def __init__(self, llm):
        self.llm = llm

    async def plan(
        self,
        node_title: str,
        node_summary: str,
        difficulty: int,
        milestone_title: str = "",
    ) -> dict | None:
        """Generate a CourseManifest for the given knowledge node.

        Returns a dict matching CourseManifest schema, or None on failure.
        """
        from langchain_core.messages import HumanMessage

        prompt = COURSE_PLANNER_PROMPT.format(
            node_title=node_title,
            node_summary=node_summary,
            difficulty=difficulty,
            milestone_title=milestone_title or "未知里程碑",
        )

        try:
            import asyncio

            response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
            text = response.content.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                text = text.strip()

            manifest = json.loads(text)

            # Validate required fields
            if not isinstance(manifest, dict):
                logger.warning("CoursePlannerAgent: response is not a dict")
                return None
            if "steps" not in manifest or not isinstance(manifest["steps"], list):
                logger.warning("CoursePlannerAgent: missing or invalid 'steps' field")
                return None
            if len(manifest["steps"]) == 0:
                logger.warning("CoursePlannerAgent: empty steps array")
                return None

            # Validate each step
            valid_types = {"concept", "story", "animation", "game", "code", "practice", "summary"}
            for i, step in enumerate(manifest["steps"]):
                if not isinstance(step, dict):
                    logger.warning(f"CoursePlannerAgent: step {i} is not a dict")
                    return None
                if step.get("type") not in valid_types:
                    logger.warning(f"CoursePlannerAgent: step {i} has invalid type '{step.get('type')}'")
                    return None
                # Ensure step_index matches position
                step["step_index"] = i

            manifest["total_steps"] = len(manifest["steps"])
            logger.info(
                f"CoursePlannerAgent: planned {manifest['total_steps']} steps for '{node_title}'"
            )
            return manifest

        except (json.JSONDecodeError, TypeError):
            logger.exception("CoursePlannerAgent: failed to parse LLM response as JSON")
            return None
        except Exception:
            logger.exception("CoursePlannerAgent: unexpected error during planning")
            return None

    async def plan_detailed(
        self,
        node_title: str,
        node_summary: str,
        difficulty: int,
        milestone_title: str = "",
    ) -> str:
        """Generate a detailed learning plan in Markdown format (800-1500 words).

        Returns a Markdown string, or empty string on failure.
        """
        from langchain_core.messages import HumanMessage

        prompt = PLAN_DETAILED_PROMPT.format(
            node_title=node_title,
            node_summary=node_summary,
            difficulty=difficulty,
            milestone_title=milestone_title or "未知里程碑",
        )

        try:
            import asyncio

            response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
            text = response.content.strip()
            if not text:
                logger.warning("CoursePlannerAgent.plan_detailed: empty response")
                return ""
            logger.info(
                f"CoursePlannerAgent.plan_detailed: generated {len(text)} chars for '{node_title}'"
            )
            return text
        except Exception:
            logger.exception("CoursePlannerAgent.plan_detailed: unexpected error")
            return ""
