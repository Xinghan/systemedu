"""LessonPlannerAgent - orchestrates lesson strategy before content generation."""

import json
import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

PLANNER_SYSTEM_PROMPT = """你是一个资深教育课程策划师兼游戏设计师。你的任务是为一个知识节点制定整体教学策略，并为互动实验提出一个创意游戏概念。

你必须严格按以下 JSON 格式输出（不要包含 markdown 代码块标记，不要输出任何其他文字）：

{
  "concept_emphasis": "一句话说明该知识点最需要理解的核心要点",
  "concept_approach": "analogy|visual|story|definition_first",
  "concept_depth": "shallow|medium|deep",
  "example_strategy": {
    "total_count": 5,
    "visual_count": 2,
    "game_count": 3,
    "recommended_visual_templates": ["step-by-step", "comparison"],
    "recommended_game_templates": ["quiz-choice", "match-pairs"],
    "example_focus": "用什么角度/场景来展示概念"
  },
  "lab_strategy": {
    "game_concept": "具体描述游戏：界面有什么元素，用户做什么操作，看到什么实时反馈，最终体验到什么知识",
    "game_mechanic": "simulation|exploration|construction|puzzle|narrative",
    "learning_connection": "游戏机制如何直接体现该知识点的核心原理"
  },
  "practice_strategy": {
    "exercise_types": ["short_answer", "scenario_analysis"],
    "progression": "练习题的递进逻辑",
    "connection_to_lab": "练习与实验的关联"
  },
  "overall_tone": "playful|encouraging|rigorous|hands_on",
  "key_vocabulary": ["关键词1", "关键词2", "关键词3"]
}

策划原则：
1. concept_approach 根据知识点特点选择：
   - analogy：抽象概念用类比帮助理解
   - visual：空间/结构相关用可视化
   - story：历史/过程相关用故事串联
   - definition_first：精确定义很重要的概念先给定义
2. concept_depth 根据难度等级决定：低难度=shallow，中等=medium，高难度=deep
3. lab_strategy 游戏创意设计原则：

   【game_concept 写作要求】
   - 必须具体描述：屏幕上有什么（控件、图形、角色），用户做什么动作，实时看到什么变化，完成时体验到什么
   - 禁止写成「让用户把X拖到Y分类框」这种干瘪的模板式描述
   - 禁止仅描述知识点，必须描述游戏互动本身

   【game_mechanic 分类（仅供参考，不限制创意）】
   - simulation：用户调节参数，实时看到物理/化学/生物现象变化（最容易产生成就感）
   - exploration：用户点击/触碰场景中的元素，逐步发现和解锁知识
   - construction：用户组装/拼接元素，构建出正确的结构或系统
   - puzzle：用户解决有挑战性的谜题，答案体现知识点原理
   - narrative：用户做选择推进故事，选择结果体现知识点

   【优秀示例】
   - 火箭发射原理 → game_concept："左侧三个滑块分别控制燃料量、推力方向、大气阻力，右侧实时显示火箭飞行轨迹动画。用户调节参数后点击发射，火箭按物理规律飞行，显示最终高度。不同参数组合会产生截然不同的飞行效果，让用户建立参数与结果的直觉。"
   - 叶片结构 → game_concept："一片真实感的树叶占据屏幕中央，叶脉、叶柄、叶片边缘等部位有光点在闪烁。用户点击闪烁的光点，该结构名称和功能以气泡形式浮现，同时该部位高亮展开动画。探索完所有部位后，叶片播放呼吸动画（模拟光合作用）作为完成庆祝。"
   - 光线与图像质量 → game_concept："场景是一个模拟摄影棚，顶部有可拖动的灯光滑块（0-100%亮度），中间是被拍摄的物体，右侧实时预览照片效果（过暗/正常/过曝三种状态动态渐变）。用户拖动灯光找到最佳曝光区间，触发完美照片效果并获得星级评分。"

4. 所有策略要相互呼应，形成完整的教学闭环
5. key_vocabulary 包含 3-5 个该知识点的核心术语"""

VALID_APPROACHES = {"analogy", "visual", "story", "definition_first"}
VALID_DEPTHS = {"shallow", "medium", "deep"}
VALID_TONES = {"playful", "encouraging", "rigorous", "hands_on"}
VALID_GAME_MECHANICS = {"simulation", "exploration", "construction", "puzzle", "narrative"}


class LessonPlannerAgent(BaseAgent):
    """Orchestrates lesson strategy before content generation."""

    name = "lesson_planner"
    description = "课程策划师，为知识节点制定整体教学策略"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        result = await self.plan(
            node_title=message,
            node_summary=ctx.get("summary", ""),
            difficulty=ctx.get("difficulty", 5),
            content_type=ctx.get("content_type", "text"),
            milestone_title=ctx.get("milestone_title", ""),
        )
        return json.dumps(result, ensure_ascii=False) if result else ""

    async def plan(
        self,
        node_title: str,
        node_summary: str,
        difficulty: int,
        content_type: str = "text",
        milestone_title: str = "",
    ) -> dict | None:
        """Create a teaching strategy plan for a knowledge node.

        Args:
            node_title: Title of the knowledge node.
            node_summary: Brief summary of the knowledge node.
            difficulty: Difficulty level (1-10).
            content_type: Content type (text, code, project, etc.).
            milestone_title: Parent milestone title for context.

        Returns:
            Parsed JSON dict with teaching strategy, or None on failure.
        """
        difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"

        user_prompt = (
            f"请为以下知识节点制定教学策略。\n\n"
            f"知识点：{node_title}\n"
            f"简介：{node_summary}\n"
            f"所属里程碑：{milestone_title}\n"
            f"难度：{difficulty_desc}（{difficulty}/10）\n"
            f"内容类型：{content_type}\n\n"
            f"请直接输出 JSON，不要包含其他文字。"
        )

        try:
            agent = create_deep_agent(
                model=self._llm,
                tools=[],
                system_prompt=PLANNER_SYSTEM_PROMPT,
            )
            result = await agent.ainvoke({"messages": [HumanMessage(content=user_prompt)]})
            # Extract last AIMessage content
            text = ""
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content:
                    text = msg.content
                    break

            text = text.strip()
            # Strip markdown code fences
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                text = text.strip()

            data = json.loads(text)
            if not isinstance(data, dict):
                logger.warning("Planner output is not a JSON object")
                return None

            # Validate required top-level fields
            for key in ("concept_emphasis", "concept_approach", "lab_strategy", "overall_tone"):
                if key not in data:
                    logger.warning(f"Planner output missing required field: {key}")
                    return None

            # Normalize enum values with fallback defaults
            if data.get("concept_approach") not in VALID_APPROACHES:
                data["concept_approach"] = "analogy"
            if data.get("concept_depth") not in VALID_DEPTHS:
                data["concept_depth"] = "medium"
            if data.get("overall_tone") not in VALID_TONES:
                data["overall_tone"] = "encouraging"

            # Validate lab_strategy
            lab = data.get("lab_strategy", {})
            if isinstance(lab, dict):
                if not lab.get("game_concept"):
                    logger.warning(
                        f"Planner decision for '{node_title}': "
                        f"lab_strategy missing game_concept, using fallback"
                    )
                    lab["game_concept"] = f"用户通过互动探索{node_title}的核心概念，实时看到操作反馈"
                raw_mechanic = lab.get("game_mechanic", "(missing)")
                if raw_mechanic not in VALID_GAME_MECHANICS:
                    logger.warning(
                        f"Planner decision for '{node_title}': "
                        f"LLM chose invalid game_mechanic='{raw_mechanic}', "
                        f"FALLBACK to 'exploration'"
                    )
                    lab["game_mechanic"] = "exploration"
            else:
                logger.warning(
                    f"Planner decision for '{node_title}': "
                    f"lab_strategy is not a dict, using fallback"
                )
                data["lab_strategy"] = {
                    "game_concept": f"用户通过互动探索{node_title}的核心概念",
                    "game_mechanic": "exploration",
                    "learning_connection": node_title,
                }

            lab = data["lab_strategy"]
            logger.info(
                f"Planner decision for '{node_title}': "
                f"game_mechanic={lab.get('game_mechanic')} | "
                f"game_concept={lab.get('game_concept', '(none)')[:60]}..."
            )
            return data

        except json.JSONDecodeError:
            logger.exception(f"Planner output is not valid JSON for '{node_title}'")
            return None
        except Exception:
            logger.exception(f"Lesson planner failed for '{node_title}'")
            return None
