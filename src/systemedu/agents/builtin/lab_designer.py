"""Lab Designer Agent - designs game mechanics, SVG visuals, and animations."""

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

DESIGNER_SYSTEM_PROMPT = """你是一个儿童教育游戏和动画设计师。你接收一个知识分析结果，设计一个具体的交互式小游戏方案，包含 SVG 矢量图形描述和 CSS 动画效果。

你必须严格按以下 JSON 格式输出（不要包含 markdown 代码块标记，不要输出任何其他文字）：

{
  "game_title": "游戏标题（如：树叶分类小能手）",
  "interaction_type": "交互模式（与输入一致）",
  "layout": "布局描述（如：上方6片树叶可拖动，下方3个分类框）",
  "background_color": "#F0F4F8",
  "items": [
    {
      "id": "item1",
      "label": "物品名称",
      "svg_description": "详细的 SVG 图形描述（形状、颜色、大小、特征细节）",
      "correct_target": "目标ID（如 box_1）",
      "features_hint": "特征提示文字"
    }
  ],
  "targets": [
    {
      "id": "box_1",
      "label": "分类名称",
      "color": "#4CAF50",
      "icon_description": "分类框图标的 SVG 描述"
    }
  ],
  "animations": {
    "item_idle": "物品待机动画描述（如：轻微浮动 translateY 2px，2s 循环）",
    "item_hover": "鼠标悬停效果（如：scale(1.1) + 阴影加深，transition 0.2s）",
    "item_drag": "拖动中效果（如：opacity 0.7 + scale(1.05) + 旋转2度）",
    "correct_drop": "放置正确动画（如：物品缩小飞入框 0.3s，绿色✓弹出 scale 0→1→0.8，分数+10飘起上移1s消失）",
    "wrong_drop": "放置错误动画（如：物品水平抖动 shake 0.5s 后回原位，红色✗闪现0.5s）",
    "all_complete": "全部完成庆祝动画（如：五彩纸屑粒子从顶部飘落3s，大号金色星星缩放弹跳，显示总分和鼓励语渐入）"
  },
  "scoring": {
    "correct_points": 10,
    "wrong_penalty": -5,
    "total_items": 6,
    "perfect_score": 60,
    "encouragement": {
      "perfect": "太棒了！满分！你是分类大师！🌟",
      "good": "做得不错！再试试能不能更好？😊",
      "try_again": "加油！多试几次就能掌握了！💪"
    }
  },
  "instructions": "玩法说明（一句话，如：把树叶拖到正确的分类框中）"
}

设计原则：
1. SVG 描述要具体详细，足以让程序员画出来：包含形状、颜色（hex值）、大小（px）、细节特征
2. 动画效果要具体到 CSS 属性和时间：transform、opacity、transition、@keyframes
3. items 的 correct_target 必须对应某个 targets 的 id
4. 颜色要鲜明、对比度高、适合儿童，每个分类框颜色不同
5. 布局要紧凑，适配 600px 高度的 iframe
6. 对于 drag_sort 模式：targets 是排序位置（如 pos_1, pos_2），items 的 correct_target 是正确位置
7. 对于 connect_match 模式：items 是左列，targets 是右列，通过 correct_target 关联
8. 对于 cause_effect 模式：items 是可操作的控制元素，targets 是展示效果的区域
9. 对于 click_select 模式：items 是可点击的选项，targets 是正确答案标记"""


class LabDesignerAgent(BaseAgent):
    """Designs game mechanics, SVG visuals, and animations for interactive labs."""

    name = "lab_designer"
    description = "设计交互式实验的游戏方案、SVG 图形和动画效果"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        analysis = json.loads(message) if isinstance(message, str) else message
        difficulty = context.get("difficulty", 5) if context else 5
        result = self.design(analysis, difficulty)
        return json.dumps(result, ensure_ascii=False) if result else ""

    def design(self, analysis: dict, difficulty: int) -> dict | None:
        """Design a game based on the analyst's output.

        Args:
            analysis: The JSON dict from LabAnalystAgent.
            difficulty: Difficulty level (1-10).

        Returns:
            Parsed JSON dict with game design, or None on failure.
        """
        difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"
        analysis_text = json.dumps(analysis, ensure_ascii=False, indent=2)

        user_prompt = (
            f"请根据以下知识分析结果，设计一个具体的交互式小游戏方案。\n\n"
            f"知识分析：\n{analysis_text}\n\n"
            f"难度：{difficulty_desc}（{difficulty}/10）\n\n"
            f"设计要点：\n"
            f"- 交互模式：{analysis.get('best_interaction', 'drag_classify')}\n"
            f"- 物品数量：{len(analysis.get('interactive_objects', []))} 个\n"
            f"- 分类数量：{len(analysis.get('categories', []))} 个\n"
            f"- 每个物品的 SVG 描述要足够详细，能直接画出来\n"
            f"- 动画效果要具体到 CSS 属性值和时间\n"
            f"- 所有文字使用中文\n\n"
            f"请直接输出 JSON，不要包含其他文字。"
        )

        try:
            response = self._llm.invoke([
                SystemMessage(content=DESIGNER_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])
            text = response.content.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                text = text.strip()

            data = json.loads(text)
            if not isinstance(data, dict):
                logger.warning("Designer output is not a JSON object")
                return None
            for key in ("game_title", "items", "targets", "animations", "scoring"):
                if key not in data:
                    logger.warning(f"Designer output missing required field: {key}")
                    return None

            logger.info(
                f"Designer: '{data['game_title']}', "
                f"{len(data['items'])} items, {len(data['targets'])} targets"
            )
            return data

        except json.JSONDecodeError:
            logger.exception("Designer output is not valid JSON")
            return None
        except Exception:
            logger.exception("Lab designer failed")
            return None
