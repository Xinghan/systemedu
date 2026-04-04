"""CourseIdeaAgent — identifies rich-media knowledge points from a learning plan."""

import json
import logging
import uuid

logger = logging.getLogger(__name__)

COURSE_IDEA_PROMPT = """你是一位多媒体教育内容设计师。请分析以下学习计划，识别出 3-5 个最适合制作富媒体内容的知识点，
并在原文中插入占位符标记。

知识节点：{node_title}
学习计划：
{plan_markdown}

你的任务：
1. 阅读学习计划，找出 3-5 个最适合通过动画、游戏、练习题、故事或辩论来加深理解的知识点
2. 为每个知识点选择最合适的媒体模式（mode）：
   - animation（动画）：适合展示动态过程、物理/化学变化、算法步骤、时序流程。视觉化强、难以用文字描述的概念优先。
   - game（游戏）：适合需要互动操作、参数调节、因果关系探索的概念。让学生通过"做"来理解。
   - exercise（练习题）：适合检测理解、巩固记忆。概念需要应用练习、有对错之分的内容优先。
   - story（故事）：适合抽象概念引入、历史背景介绍、用类比解释复杂概念。
3. 模式选择原则：
   - 同一节内容最多 1 个 animation 和 1 个 game
   - 如果一个知识点既可以做动画也可以做游戏，优先选 game（更有互动性）
   - story 最多 1 个
4. 为每个知识点指定风格 style_key，根据内容领域选择最匹配的风格：
   - aether_clinic: 医学、神经科学、人体解剖、健康科学
   - ares_mission: 航天、火箭、天文、行星科学、地质
   - celestial_observatory: 天文、宇宙、恒星、黑洞、引力、光学
   - helix_lab: 基因、DNA、细胞、微生物、生物化学
   - neural_circuit: 计算机科学、AI、机器人、电路、编程
   - subatomic_matrix: 量子物理、粒子物理、原子结构、化学键
   - rocketry_control: 火箭工程、推进系统、轨道力学、工程力学
   - aqua_flow: 海洋科学、水文、流体力学、化学溶液
   - ember_forge: 地质学、火山、地球内部、冶金、热力学
   - flora_pulse: 植物学、光合作用、生态系统、农业、进化论
5. 在学习计划原文的合适位置插入占位符，格式为 [[IDEA:{{uuid}}]]
   - 占位符必须插入在与该知识点相关的段落之后、下一段开始之前
   - 直接替换原文中对应段落末尾处，保持其他内容不变

输出格式（用 ---SEPARATOR--- 分隔两部分）：

第一部分：修改后的完整学习计划（保留所有原文，仅在对应位置插入占位符）

---SEPARATOR---

第二部分：JSON 数组，每个元素格式：
[
  {{
    "idea_id": "与占位符中相同的 uuid",
    "mode": "animation|game|exercise|story|debate",
    "style_key": "aether_clinic|ares_mission|celestial_observatory|helix_lab|neural_circuit|subatomic_matrix|rocketry_control|aqua_flow|ember_forge|flora_pulse",
    "topic": "这个知识点的简短描述（10字以内）",
    "context_summary": "该知识点在学习计划中的上下文摘要（30-50字）",
    "mode_reason": "为什么选择该 mode（20字以内）"
  }}
]

注意：
- idea_id 必须与占位符中的 uuid 完全一致
- 只输出上述两部分内容，不要添加任何其他说明
- 全部使用中文（mode 字段除外）
"""


class CourseIdeaAgent:
    """Identifies 3-6 rich-media knowledge points from a learning plan."""

    def __init__(self, llm):
        self.llm = llm

    async def identify(
        self,
        plan_markdown: str,
        node_title: str,
    ) -> tuple[str, list[dict]]:
        """Parse the learning plan and identify ideas for rich-media content.

        Returns (plan_with_placeholders, ideas_list).
        On failure, returns (original plan_markdown, []).
        """
        from langchain_core.messages import HumanMessage

        prompt = COURSE_IDEA_PROMPT.format(
            node_title=node_title,
            plan_markdown=plan_markdown,
        )

        try:
            import asyncio

            response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
            text = response.content.strip()

            if "---SEPARATOR---" not in text:
                logger.warning("CourseIdeaAgent: missing SEPARATOR in response")
                return plan_markdown, []

            parts = text.split("---SEPARATOR---", 1)
            plan_with_placeholders = parts[0].strip()
            ideas_raw = parts[1].strip()

            # Strip markdown code fences if present
            if ideas_raw.startswith("```"):
                lines = ideas_raw.split("\n")
                ideas_raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                ideas_raw = ideas_raw.strip()

            # LLM sometimes prefixes with description text before the JSON array
            # Find the first '[' to locate the actual JSON array
            bracket_idx = ideas_raw.find("[")
            if bracket_idx > 0:
                ideas_raw = ideas_raw[bracket_idx:]

            ideas = json.loads(ideas_raw)
            if not isinstance(ideas, list):
                logger.warning("CourseIdeaAgent: ideas is not a list")
                return plan_markdown, []

            # Validate and normalize each idea
            valid_modes = {"animation", "game", "story", "exercise", "debate"}
            validated = []
            for item in ideas:
                if not isinstance(item, dict):
                    continue
                mode = item.get("mode", "")
                if mode not in valid_modes:
                    logger.warning(f"CourseIdeaAgent: invalid mode '{mode}', skipping")
                    continue
                idea_id = item.get("idea_id", "")
                if not idea_id or f"[[IDEA:{idea_id}]]" not in plan_with_placeholders:
                    logger.warning(f"CourseIdeaAgent: idea_id '{idea_id}' not found in plan, skipping")
                    continue
                validated.append({
                    "idea_id": idea_id,
                    "mode": mode,
                    "style_key": item.get("style_key", ""),
                    "topic": item.get("topic", ""),
                    "context_summary": item.get("context_summary", ""),
                    "mode_reason": item.get("mode_reason", ""),
                    "detail_plan": None,
                    "result": None,
                })

            if not validated:
                logger.warning("CourseIdeaAgent: no valid ideas after validation")
                return plan_markdown, []

            logger.info(
                f"CourseIdeaAgent: identified {len(validated)} ideas for '{node_title}'"
            )
            return plan_with_placeholders, validated

        except (json.JSONDecodeError, TypeError):
            logger.exception("CourseIdeaAgent: failed to parse ideas JSON")
            return plan_markdown, []
        except Exception:
            logger.exception("CourseIdeaAgent: unexpected error")
            return plan_markdown, []
