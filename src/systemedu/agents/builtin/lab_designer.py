"""Lab Designer Agent - designs game mechanics, SVG visuals, and animations."""

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

DESIGNER_SYSTEM_PROMPT = """你是一个儿童教育游戏和动画设计师。你接收一个知识分析结果，设计一个具体的交互式小游戏方案，包含 SVG 矢量图形描述和 CSS 动画效果。

你必须严格按 JSON 格式输出（不要包含 markdown 代码块标记，不要输出任何其他文字）。

根据 best_interaction 类型，输出对应的 JSON 结构。所有类型都包含以下公共字段：
- game_title, interaction_type, layout, background_color, animations, scoring, instructions

## 各模式的设计格式

### drag_classify（拖拽分类）
{
  "game_title": "树叶分类小能手",
  "interaction_type": "drag_classify",
  "layout": "上方6片树叶可拖动，下方3个分类框",
  "background_color": "#F0F4F8",
  "items": [
    {"id": "item1", "label": "银杏叶", "svg_description": "扇形黄色叶片，宽40px高35px，扇骨纹理", "correct_target": "box_1", "features_hint": "扇形"}
  ],
  "targets": [
    {"id": "box_1", "label": "扇形叶", "color": "#4CAF50", "icon_description": "小扇形图标"}
  ],
  "animations": {...}, "scoring": {...}, "instructions": "把树叶拖到正确的分类框中"
}

### click_select（点击选择）
{
  "game_title": "找出哺乳动物",
  "interaction_type": "click_select",
  "layout": "每题显示标题和4个选项卡片，点击选择，底部显示进度",
  "background_color": "#FFF8E1",
  "questions": [
    {
      "id": "q1",
      "prompt": "下面哪个是哺乳动物？",
      "options": [
        {"id": "q1_a", "label": "猫", "svg_description": "橙色猫咪简笔画，圆头三角耳", "is_correct": true},
        {"id": "q1_b", "label": "金鱼", "svg_description": "红色金鱼简笔画，圆身大尾", "is_correct": false}
      ]
    }
  ],
  "animations": {
    "option_idle": "轻微浮动，2s循环",
    "option_hover": "scale(1.05) + 阴影加深，transition 0.2s",
    "correct_select": "边框变绿+绿色✓弹出+sparkle粒子",
    "wrong_select": "水平抖动shake 0.5s+边框变红+红色✗",
    "all_complete": "五彩纸屑飘落+显示总分"
  },
  "scoring": {...}, "instructions": "点击选出正确的答案"
}

### drag_sort（拖拽排序）
{
  "game_title": "食物链排序",
  "interaction_type": "drag_sort",
  "layout": "左侧打乱的卡片区，右侧从上到下的排序槽位",
  "background_color": "#E8F5E9",
  "items": [
    {"id": "item1", "label": "草", "svg_description": "绿色草丛简笔画", "correct_position": 1}
  ],
  "slots": [
    {"id": "slot_1", "label": "第1位", "position": 1, "color": "#81C784"}
  ],
  "sort_label": "从低到高排列食物链",
  "animations": {
    "item_idle": "轻微浮动",
    "item_drag": "opacity 0.7 + scale(1.05)",
    "correct_place": "绿色发光+✓弹出",
    "wrong_place": "抖动+回弹原位",
    "all_complete": "顺序箭头逐个亮起+庆祝动画"
  },
  "scoring": {...}, "instructions": "把卡片拖到正确的位置"
}

### connect_match（连线配对）
{
  "game_title": "动物与栖息地连线",
  "interaction_type": "connect_match",
  "layout": "左列4个动物卡片，右列4个栖息地卡片，中间画连线",
  "background_color": "#E3F2FD",
  "left_items": [
    {"id": "l1", "label": "企鹅", "svg_description": "黑白企鹅简笔画", "match_id": "r1"}
  ],
  "right_items": [
    {"id": "r1", "label": "南极冰川", "svg_description": "蓝白冰川简笔画", "color": "#42A5F5"}
  ],
  "animations": {
    "item_hover": "scale(1.05) + 高亮边框",
    "line_drawing": "SVG line 从起点到终点 0.3s ease-out",
    "correct_match": "连线变绿+两端sparkle",
    "wrong_match": "连线变红抖动后消失",
    "all_complete": "所有连线变金色+庆祝动画"
  },
  "scoring": {...}, "instructions": "点击左侧卡片再点击右侧卡片进行配对"
}

### cause_effect（因果操作）
{
  "game_title": "火箭发射实验室",
  "interaction_type": "cause_effect",
  "layout": "左侧控制面板（滑块/按钮），右侧动画展示区",
  "background_color": "#FFF3E0",
  "controls": [
    {"id": "ctrl1", "label": "燃料量", "type": "slider", "min": 0, "max": 100, "default": 50, "unit": "升", "color": "#FF9800", "svg_description": "橙色油桶图标"}
  ],
  "effects": [
    {"id": "eff1", "label": "飞行高度", "depends_on": ["ctrl1"], "formula_hint": "燃料越多飞越高", "svg_description": "火箭升空动画，高度随数值变化"}
  ],
  "animations": {
    "control_change": "滑块滑动时实时更新效果区域",
    "effect_update": "效果区SVG平滑过渡 transition 0.5s",
    "goal_reached": "达到目标值时金色星星弹出+鼓励语",
    "reset": "复位按钮点击后所有控件回到默认值"
  },
  "scoring": {...}, "instructions": "调节左侧控制参数，观察右侧效果变化"
}

## 通用设计原则
1. SVG 描述要具体详细：形状、颜色（hex值）、大小（px）、细节特征
2. 动画效果要具体到 CSS 属性和时间
3. 颜色鲜明、对比度高、适合儿童
4. 布局紧凑，适配 600px 高度的 iframe
5. scoring 包含 correct_points, wrong_penalty, total_items, perfect_score, encouragement"""


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

        interaction_type = analysis.get("best_interaction", "drag_classify")
        # Build interaction-specific hints
        type_hints = {
            "drag_classify": f"- 物品数量：{len(analysis.get('interactive_objects', []))} 个\n- 分类数量：{len(analysis.get('categories', []))} 个",
            "click_select": f"- 题目数量：{len(analysis.get('questions', []))} 题",
            "drag_sort": f"- 排序项数量：{len(analysis.get('sortable_items', []))} 个\n- 排序依据：{analysis.get('sort_criteria', '')}",
            "connect_match": f"- 左侧项数：{len(analysis.get('left_items', []))} 个\n- 右侧项数：{len(analysis.get('right_items', []))} 个",
            "cause_effect": f"- 控制参数：{len(analysis.get('controls', []))} 个\n- 效果展示：{len(analysis.get('effects', []))} 个",
        }
        specific_hint = type_hints.get(interaction_type, "")

        user_prompt = (
            f"请根据以下知识分析结果，设计一个具体的交互式小游戏方案。\n\n"
            f"知识分析：\n{analysis_text}\n\n"
            f"难度：{difficulty_desc}（{difficulty}/10）\n\n"
            f"设计要点：\n"
            f"- 交互模式：{interaction_type}\n"
            f"{specific_hint}\n"
            f"- 每个元素的 SVG 描述要足够详细，能直接画出来\n"
            f"- 动画效果要具体到 CSS 属性值和时间\n"
            f"- 所有文字使用中文\n"
            f"- 请严格按照上方 {interaction_type} 模式的 JSON 结构输出\n\n"
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
            for key in ("game_title", "animations", "scoring"):
                if key not in data:
                    logger.warning(f"Designer output missing required field: {key}")
                    return None

            output_type = data.get("interaction_type", "(missing)")
            input_type = interaction_type
            match = "MATCH" if output_type == input_type else f"MISMATCH(input={input_type})"
            logger.info(
                f"Designer decision: "
                f"input_type={input_type} -> output_type={output_type} ({match}) | "
                f"title='{data['game_title']}'"
            )
            return data

        except json.JSONDecodeError:
            logger.exception("Designer output is not valid JSON")
            return None
        except Exception:
            logger.exception("Lab designer failed")
            return None
