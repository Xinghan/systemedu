"""Lab Analyst Agent - analyzes knowledge nodes to extract interactive elements."""

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

ANALYST_SYSTEM_PROMPT = """你是一个教育知识分析专家。你的任务是分析一个知识点，提取适合制作交互式实验的关键要素。

你必须严格按以下 JSON 格式输出（不要包含 markdown 代码块标记，不要输出任何其他文字）：

{
  "topic": "知识点主题",
  "core_concept": "一句话说明核心概念",
  "interactive_objects": [
    {"name": "物品名称", "category": "所属分类", "features": {"特征名": "特征值"}}
  ],
  "categories": ["分类1", "分类2", "分类3"],
  "best_interaction": "交互模式",
  "cause_effect_pairs": [
    {"cause": "原因/操作", "effect": "结果/现象"}
  ],
  "learning_goal": "学习目标"
}

交互模式（best_interaction）必须从以下 5 种中选择最合适的一种：
- "drag_classify"：拖拽分类 — 适合需要按特征将物品归类的知识点（如树叶分类、食物分类、垃圾分类）
- "click_select"：点击选择 — 适合需要从选项中识别正确答案的知识点（如识别形状、选择正确答案）
- "drag_sort"：拖拽排序 — 适合有明确顺序的知识点（如食物链、历史事件排序、步骤排列）
- "connect_match"：连线配对 — 适合两组概念有对应关系的知识点（如动物与栖息地、单词与释义）
- "cause_effect"：因果操作 — 适合展示操作与结果关系的知识点（如火箭发射、植物生长、化学反应）

分析原则：
1. interactive_objects 至少 4 个，最多 8 个，覆盖所有 categories
2. 每个物品的 features 至少 2 个特征，用于视觉区分
3. categories 数量 2-4 个，不要太多
4. cause_effect_pairs 仅在 best_interaction 为 "cause_effect" 时填写，其他模式设为空数组
5. 选择最能体现该知识点动手操作特点的交互模式"""

VALID_INTERACTIONS = {
    "drag_classify", "click_select", "drag_sort",
    "connect_match", "cause_effect",
}


class LabAnalystAgent(BaseAgent):
    """Analyzes knowledge nodes to extract interactive elements for lab generation."""

    name = "lab_analyst"
    description = "分析知识节点，提取交互式实验所需的关键要素"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        result = self.analyze(
            node_title=message,
            node_summary=context.get("summary", "") if context else "",
            difficulty=context.get("difficulty", 5) if context else 5,
            lesson_plan=context.get("lesson_plan") if context else None,
        )
        return json.dumps(result, ensure_ascii=False) if result else ""

    def analyze(self, node_title: str, node_summary: str, difficulty: int, lesson_plan: dict | None = None) -> dict | None:
        """Analyze a knowledge node and return structured JSON.

        Args:
            node_title: Title of the knowledge node.
            node_summary: Brief summary of the knowledge node.
            difficulty: Difficulty level (1-10).
            lesson_plan: Optional teaching strategy from LessonPlannerAgent.

        Returns:
            Parsed JSON dict with analysis results, or None on failure.
        """
        difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"

        # Build plan guidance if available
        plan_guidance = ""
        if lesson_plan:
            lab = lesson_plan.get("lab_strategy", {})
            if isinstance(lab, dict):
                interaction = lab.get("interaction_type", "")
                rationale = lab.get("interaction_rationale", "")
                theme = lab.get("game_theme", "")
                item_count = lab.get("item_count", "")
                plan_guidance = (
                    f"\n\n【策划师指引】\n"
                    f"- 推荐交互模式：{interaction}\n"
                    f"- 推荐理由：{rationale}\n"
                    f"- 游戏主题：{theme}\n"
                    f"- 推荐物品数量：{item_count}\n"
                    f"请优先使用策划师推荐的交互模式，除非你有充分理由选择其他模式。"
                )

        user_prompt = (
            f"请分析以下知识点，提取适合制作交互式实验的要素。\n\n"
            f"知识点：{node_title}\n"
            f"简介：{node_summary}\n"
            f"难度：{difficulty_desc}（{difficulty}/10）\n"
            f"{plan_guidance}\n\n"
            f"请直接输出 JSON，不要包含其他文字。"
        )

        try:
            response = self._llm.invoke([
                SystemMessage(content=ANALYST_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])
            text = response.content.strip()
            # Strip markdown code fences
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                text = text.strip()

            data = json.loads(text)
            # Validate required fields
            if not isinstance(data, dict):
                logger.warning("Analyst output is not a JSON object")
                return None
            for key in ("topic", "core_concept", "interactive_objects", "categories", "best_interaction", "learning_goal"):
                if key not in data:
                    logger.warning(f"Analyst output missing required field: {key}")
                    return None
            # Validate interaction type
            if data["best_interaction"] not in VALID_INTERACTIONS:
                logger.warning(f"Unknown interaction type: {data['best_interaction']}, defaulting to drag_classify")
                data["best_interaction"] = "drag_classify"

            logger.info(f"Analyst: topic='{data['topic']}', interaction={data['best_interaction']}, {len(data['interactive_objects'])} objects")
            return data

        except json.JSONDecodeError:
            logger.exception(f"Analyst output is not valid JSON for '{node_title}'")
            return None
        except Exception:
            logger.exception(f"Lab analyst failed for '{node_title}'")
            return None
