"""LessonPlannerAgent - orchestrates lesson strategy before content generation."""

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

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
3. lab_strategy.interaction_type 必须从 5 种中选最适合的：
   - drag_classify：按特征归类（如树叶分类、垃圾分类）
   - click_select：从选项中识别正确答案
   - drag_sort：有明确顺序的知识点（如步骤排列）
   - connect_match：两组概念有对应关系（如动物与栖息地）
   - cause_effect：操作与结果关系（如火箭发射、植物生长）
4. 所有策略要相互呼应，形成完整的教学闭环
5. key_vocabulary 包含 3-5 个该知识点的核心术语"""

VALID_APPROACHES = {"analogy", "visual", "story", "definition_first"}
VALID_DEPTHS = {"shallow", "medium", "deep"}
VALID_TONES = {"playful", "encouraging", "rigorous", "hands_on"}
VALID_INTERACTIONS = {"drag_classify", "click_select", "drag_sort", "connect_match", "cause_effect"}


class LessonPlannerAgent(BaseAgent):
    """Orchestrates lesson strategy before content generation."""

    name = "lesson_planner"
    description = "课程策划师，为知识节点制定整体教学策略"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        result = self.plan(
            node_title=message,
            node_summary=ctx.get("summary", ""),
            difficulty=ctx.get("difficulty", 5),
            content_type=ctx.get("content_type", "text"),
            milestone_title=ctx.get("milestone_title", ""),
        )
        return json.dumps(result, ensure_ascii=False) if result else ""

    def plan(
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
            response = self._llm.invoke([
                SystemMessage(content=PLANNER_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])
            text = response.content.strip()
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
                if lab.get("interaction_type") not in VALID_INTERACTIONS:
                    lab["interaction_type"] = "drag_classify"
            else:
                data["lab_strategy"] = {"interaction_type": "drag_classify"}

            logger.info(
                f"Planner: approach={data['concept_approach']}, "
                f"lab={data['lab_strategy'].get('interaction_type')}, "
                f"tone={data['overall_tone']}"
            )
            return data

        except json.JSONDecodeError:
            logger.exception(f"Planner output is not valid JSON for '{node_title}'")
            return None
        except Exception:
            logger.exception(f"Lesson planner failed for '{node_title}'")
            return None
