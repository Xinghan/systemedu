"""LessonPlannerAgent - orchestrates lesson strategy before content generation."""

import json
import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

PLANNER_SYSTEM_PROMPT = """你是一个资深教育课程策划师。你的任务是为一个知识节点制定整体教学策略，指导后续的概念讲解、示例设计、实验设计和练习设计。

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
    "interaction_type": "drag_classify|click_select|drag_sort|connect_match|cause_effect",
    "interaction_rationale": "为什么选择这种交互模式",
    "game_theme": "一句话描述游戏主题",
    "item_count": 6,
    "difficulty_adjustment": "针对难度的调整说明"
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
3. lab_strategy.interaction_type 选择（每种模式都有明确适用条件，不要全往一个模式塞）：

   - cause_effect：知识点的核心是「变量影响结果」，用户可以拖动滑块/按按钮，实时看到效果变化。
     适用：参数调节实验（光线强弱影响图片质量、准确率随数据量变化、温度影响植物生长）
     不适用：纯概念描述、分类辨认

   - drag_sort：知识点有「明确顺序或步骤」，用户将打乱的项目拖拽排序。
     适用：流程步骤（AI项目5步、图片采集流程、训练流程）、生长阶段、时间顺序
     不适用：无顺序的分类或配对

   - drag_classify：知识点涉及「将多个事物按类别归组」，用户拖拽物品放入分类框。
     适用：按特征分类（叶形分类、数据质量分类好坏、图片分清晰/模糊）
     不适用：只有2个事物对应关系（那用connect_match）

   - connect_match：知识点有「两组事物一一对应」（4-6对），用户连线配对。
     适用：概念与定义对应、名称与图片对应、原因与结果对应
     只有当对应关系明确、且双方数量相当时才用；不要把所有「有对应关系」的知识点都塞进来

   - click_select：用户从图形选项中「视觉辨别」正确答案，选项必须是可绘制的图形（形状/图案/颜色差异）。
     适用：识别叶形轮廓、识别图案、从4张图中选正确的
     禁止：选项只有文字的绝对不用 click_select

   - animated_story：以上模式都不自然时，用逐帧动画演示概念。
     适用：纯概念性知识（「认识/了解/知道」类）、流程动画演示、无法互动的抽象概念

   【选择原则】优先选最能让学生「动手操作」的模式；cause_effect 是最能产生成就感的模式，凡是涉及「变量影响」的优先考虑；不要因为「有对应关系」就总用 connect_match。

   【示例】
   - 认识叶形 → drag_classify（将椭圆/心形/针形叶拖入对应类别）
   - 认识叶脉 → connect_match（叶脉名称配对形态图）
   - 理解光线影响图片 → cause_effect（滑块调节光线强度，看图片效果变化）
   - 建立准确率直觉 → cause_effect（滑块调节训练数据量，看准确率曲线变化）
   - AI项目五步 → drag_sort（将5个步骤拖拽排序）
   - 认识叶片结构 → animated_story（动画标注各部分名称）
4. 所有策略要相互呼应，形成完整的教学闭环
5. key_vocabulary 包含 3-5 个该知识点的核心术语"""

VALID_APPROACHES = {"analogy", "visual", "story", "definition_first"}
VALID_DEPTHS = {"shallow", "medium", "deep"}
VALID_TONES = {"playful", "encouraging", "rigorous", "hands_on"}
VALID_INTERACTIONS = {"drag_classify", "click_select", "drag_sort", "connect_match", "cause_effect", "animated_story"}


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
                raw_type = lab.get("interaction_type", "(missing)")
                if raw_type not in VALID_INTERACTIONS:
                    logger.warning(
                        f"Planner decision for '{node_title}': "
                        f"LLM chose invalid interaction_type='{raw_type}', "
                        f"FALLBACK to drag_classify"
                    )
                    lab["interaction_type"] = "drag_classify"
            else:
                logger.warning(
                    f"Planner decision for '{node_title}': "
                    f"lab_strategy is not a dict, FALLBACK to drag_classify"
                )
                data["lab_strategy"] = {"interaction_type": "drag_classify"}

            lab = data["lab_strategy"]
            logger.info(
                f"Planner decision for '{node_title}': "
                f"interaction_type={lab.get('interaction_type')} | "
                f"rationale={lab.get('interaction_rationale', '(none)')}"
            )
            return data

        except json.JSONDecodeError:
            logger.exception(f"Planner output is not valid JSON for '{node_title}'")
            return None
        except Exception:
            logger.exception(f"Lesson planner failed for '{node_title}'")
            return None
