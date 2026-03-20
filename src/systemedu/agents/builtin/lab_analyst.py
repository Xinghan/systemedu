"""Lab Analyst Agent - analyzes knowledge nodes to extract interactive elements."""

import json
import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

ANALYST_SYSTEM_PROMPT = """你是一个教育知识分析专家。你的任务是分析一个知识点，提取适合制作交互式实验的关键要素。

你必须严格按 JSON 格式输出（不要包含 markdown 代码块标记，不要输出任何其他文字）。

首先选择最合适的交互模式（best_interaction），然后根据所选模式输出对应的 JSON 结构。

## 交互模式选择（5 选 1）

- "drag_classify"：拖拽分类 — 需要按特征将物品归类（如树叶分类、食物分类、垃圾分类）
- "click_select"：点击选择 — 需要从选项中识别正确答案（如识别形状、选出正确答案、找出不同类的物品）
- "drag_sort"：拖拽排序 — 有明确顺序（如食物链、历史事件排序、步骤排列）
- "connect_match"：连线配对 — 两组概念有对应关系（如动物与栖息地、单词与释义、国家与首都）
- "cause_effect"：因果操作 — 展示操作与结果的关系（如火箭发射参数调节、植物生长条件、化学反应）
- "animated_story"：动画演示 — 用逐帧矢量动画动态展示知识点（适合"认识/了解/知道"类概念性节点，当以上模式都不自然时使用）

## 各模式的 JSON 输出格式

### drag_classify（拖拽分类）
{
  "topic": "知识点主题",
  "core_concept": "一句话说明核心概念",
  "best_interaction": "drag_classify",
  "interactive_objects": [
    {"name": "物品名称", "category": "所属分类", "features": {"特征名": "特征值"}, "search_keyword": "Ginkgo biloba leaf"}
  ],
  "categories": ["分类1", "分类2", "分类3"],
  "learning_goal": "学习目标"
}
- interactive_objects: 4-8 个，覆盖所有 categories
- categories: 2-4 个

### click_select（点击选择）
{
  "topic": "知识点主题",
  "core_concept": "一句话说明核心概念",
  "best_interaction": "click_select",
  "questions": [
    {
      "prompt": "题目描述（如：下面哪个是哺乳动物？）",
      "options": [
        {"label": "选项文字", "is_correct": true, "svg_hint": "图形特征描述", "search_keyword": "domestic cat"}
      ]
    }
  ],
  "learning_goal": "学习目标"
}
- questions: 3-5 题，每题 3-4 个选项，至少 1 个正确
- svg_hint: 手绘简笔画风格的图形特征描述（用于 rough.js 绘制，描述形状、线条、填充风格）
- 注意：如果只是单纯的文字选择题，应改用 animated_story 动画演示而非 click_select

### drag_sort（拖拽排序）
{
  "topic": "知识点主题",
  "core_concept": "一句话说明核心概念",
  "best_interaction": "drag_sort",
  "sortable_items": [
    {"label": "项目名称", "correct_position": 1, "svg_hint": "图形特征描述", "search_keyword": "grass plant"}
  ],
  "sort_criteria": "排序依据说明（如：从小到大、从早到晚）",
  "learning_goal": "学习目标"
}
- sortable_items: 4-8 个，correct_position 从 1 开始
- 前端会打乱顺序，玩家拖拽排列

### connect_match（连线配对）
{
  "topic": "知识点主题",
  "core_concept": "一句话说明核心概念",
  "best_interaction": "connect_match",
  "left_items": [
    {"id": "l1", "label": "左侧概念", "svg_hint": "图形描述", "search_keyword": "penguin animal"}
  ],
  "right_items": [
    {"id": "r1", "label": "右侧概念", "match_id": "l1", "svg_hint": "图形描述", "search_keyword": "Antarctica glacier"}
  ],
  "learning_goal": "学习目标"
}
- left_items 和 right_items 各 4-6 个，通过 match_id 关联
- 前端会打乱右侧顺序

### cause_effect（因果操作）
{
  "topic": "知识点主题",
  "core_concept": "一句话说明核心概念",
  "best_interaction": "cause_effect",
  "controls": [
    {"id": "ctrl1", "label": "控制参数名", "type": "slider|button|toggle", "min": 0, "max": 100, "default": 50, "unit": "单位"}
  ],
  "effects": [
    {"id": "eff1", "label": "效果指标名", "depends_on": ["ctrl1"], "formula_hint": "变化规律描述"}
  ],
  "cause_effect_pairs": [
    {"cause": "原因/操作", "effect": "结果/现象"}
  ],
  "learning_goal": "学习目标"
}
- controls: 1-3 个可操作元素
- effects: 1-3 个展示变化的指标/动画
- cause_effect_pairs: 总结关键因果关系

### animated_story（动画演示）
{
  "topic": "知识点主题",
  "core_concept": "一句话说明核心概念",
  "best_interaction": "animated_story",
  "scene_description": "整体场景描述（如：一个浏览器窗口，顶部有地址栏和搜索框，窗口下方有一个小人）",
  "characters": [
    {"id": "char1", "name": "角色名称", "description": "外观描述（如：圆头小人，蓝色身体，大眼睛）"}
  ],
  "animation_steps": [
    {
      "step": 1,
      "narration": "旁白文字，简短说明这一步发生了什么",
      "action": "具体动画描述（如：小人从左侧走到地址栏下方，地址栏发出蓝色光晕）",
      "highlight": "高亮的元素名称（如：地址栏）",
      "duration_ms": 2000
    }
  ],
  "interactive_prompt": "用户交互说明（如：点击任意位置继续，或：点击高亮区域回答问题）",
  "learning_goal": "学习目标"
}
- animation_steps: 3-6 步，每步有明确动画动作和旁白
- scene_description: 要具体到布局、颜色、关键视觉元素
- 适用场景：认识界面/部件、了解概念、知道流程等偏认知性节点

## 分析原则
1. 选择最能体现该知识点动手操作特点的交互模式
2. "认识/了解/知道"类概念性节点优先考虑 animated_story 或 connect_match，而非 click_select（避免生成纯文字选择题）
3. click_select 仅适用于"需要视觉辨别"的场景（如：识别图中哪张是正面/哪种叶形/哪类动物），且选项必须提供真实可绘制的 SVG 图形，不能是纯文字选项
4. 有明确分组特征（按形状/颜色/类别分类）→ drag_classify；有两组概念对应 → connect_match；有顺序/流程 → drag_sort；有操作与结果 → cause_effect；纯概念演示 → animated_story
5. 禁止用 click_select 做纯文字题（选项只有文字没有图形），那种情况改用 animated_story 或 connect_match
6. animated_story 是最后的兜底选项，当其他模式都不自然时使用
7. 每种模式的字段不同，请严格按照对应模式输出
8. svg_hint 要描述手绘简笔画风格：指定形状、线条粗细、填充模式（hachure/cross-hatch）和颜色，便于用 rough.js 绘制
9. search_keyword：drag_classify/drag_sort/click_select/connect_match 模式的每个物品/选项，必须提供 search_keyword 字段（1-3 个英文词），用于在 Wikipedia 搜索真实图片（如 "Ginkgo biloba leaf"、"domestic cat"、"Antarctica glacier"）"""

VALID_INTERACTIONS = {
    "drag_classify", "click_select", "drag_sort",
    "connect_match", "cause_effect", "animated_story",
}


class LabAnalystAgent(BaseAgent):
    """Analyzes knowledge nodes to extract interactive elements for lab generation."""

    name = "lab_analyst"
    description = "分析知识节点，提取交互式实验所需的关键要素"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        result = await self.analyze(
            node_title=message,
            node_summary=context.get("summary", "") if context else "",
            difficulty=context.get("difficulty", 5) if context else 5,
            lesson_plan=context.get("lesson_plan") if context else None,
        )
        return json.dumps(result, ensure_ascii=False) if result else ""

    async def analyze(self, node_title: str, node_summary: str, difficulty: int, lesson_plan: dict | None = None) -> dict | None:
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
            agent = create_deep_agent(
                model=self._llm,
                tools=[],
                system_prompt=ANALYST_SYSTEM_PROMPT,
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
            # Validate required fields
            if not isinstance(data, dict):
                logger.warning("Analyst output is not a JSON object")
                return None
            for key in ("topic", "core_concept", "best_interaction", "learning_goal"):
                if key not in data:
                    logger.warning(f"Analyst output missing required field: {key}")
                    return None
            # Log what the planner recommended vs what analyst chose
            planner_rec = ""
            if lesson_plan:
                planner_rec = lesson_plan.get("lab_strategy", {}).get("interaction_type", "?")

            raw_interaction = data.get("best_interaction", "(missing)")

            # Validate interaction type
            if raw_interaction not in VALID_INTERACTIONS:
                logger.warning(
                    f"Analyst decision for '{node_title}': "
                    f"LLM chose invalid '{raw_interaction}', FALLBACK to drag_classify"
                )
                data["best_interaction"] = "drag_classify"

            itype = data["best_interaction"]

            # Log the decision chain
            if planner_rec:
                followed = "FOLLOWED" if itype == planner_rec else "OVERRODE"
                logger.info(
                    f"Analyst decision for '{node_title}': "
                    f"planner_recommended={planner_rec} -> analyst_chose={itype} ({followed}) | "
                    f"topic={data.get('topic')}"
                )
            else:
                logger.info(
                    f"Analyst decision for '{node_title}': "
                    f"chose={itype} (no planner guidance) | "
                    f"topic={data.get('topic')}"
                )

            # Validate per-type required fields
            type_fields = {
                "drag_classify": ["interactive_objects", "categories"],
                "click_select": ["questions"],
                "drag_sort": ["sortable_items", "sort_criteria"],
                "connect_match": ["left_items", "right_items"],
                "cause_effect": ["controls", "effects"],
                "animated_story": ["scene_description", "animation_steps"],
            }
            for field in type_fields.get(itype, []):
                if field not in data:
                    logger.warning(
                        f"Analyst decision for '{node_title}': "
                        f"chose {itype} but missing required field '{field}', returning None"
                    )
                    return None
            return data

        except json.JSONDecodeError:
            logger.exception(f"Analyst output is not valid JSON for '{node_title}'")
            return None
        except Exception:
            logger.exception(f"Lab analyst failed for '{node_title}'")
            return None
