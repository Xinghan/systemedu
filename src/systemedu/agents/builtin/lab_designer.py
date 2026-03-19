"""Lab Designer Agent - designs game mechanics, SVG visuals, and animations."""

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

DESIGNER_SYSTEM_PROMPT = """你是一个儿童教育游戏设计师。你接收一个知识分析结果，设计一个具体的交互式小游戏方案，包含卡通风格的图形描述和动画效果。

你必须严格按 JSON 格式输出（不要包含 markdown 代码块标记，不要输出任何其他文字）。

【卡通风格要求】
整体视觉风格活泼、现代，类似 Duolingo 的儿童教育游戏：
- background_color 统一使用渐变背景描述（如 "linear-gradient(135deg, #EEF2FF, #F0FDF4)"）
- svg_description 描述简洁几何卡通图形：圆润形状、鲜明色彩、清晰轮廓
- 色板：蓝 #4F8EF7、绿 #4ADE80、红 #F87171、橙 #FB923C、紫 #A78BFA、黄 #FCD34D
- 线条清晰，strokeWidth 2，stroke 颜色比填充色深一档
- 卡片白色背景 + 16px 圆角 + 底部 4px 彩色阴影（立体感）

根据 best_interaction 类型，输出对应的 JSON 结构。所有类型都包含以下公共字段：
- game_title, interaction_type, layout, background_color, animations, scoring, instructions

## 各模式的设计格式

### drag_classify（拖拽分类）
{
  "game_title": "树叶分类小能手",
  "interaction_type": "drag_classify",
  "layout": "上方6张彩色卡片可拖动，下方3个分类框，白色圆角卡片+彩色阴影",
  "background_color": "linear-gradient(135deg, #EEF2FF, #F0FDF4)",
  "items": [
    {"id": "item1", "label": "银杏叶", "svg_description": "扇形黄色叶片SVG，填充 #FCD34D，stroke #D97706，宽40px高35px", "correct_target": "box_1", "features_hint": "扇形", "color": "#FCD34D"}
  ],
  "targets": [
    {"id": "box_1", "label": "扇形叶", "color": "#4ADE80", "icon_description": "小扇形SVG图标，绿色"}
  ],
  "animations": {...}, "scoring": {...}, "instructions": "把卡片拖到正确的分类框中"
}

### click_select（点击选择）
{
  "game_title": "找出哺乳动物",
  "interaction_type": "click_select",
  "layout": "每题显示题目文字和4个白色圆角卡片选项，点击选择，底部彩色进度条",
  "background_color": "linear-gradient(135deg, #EEF2FF, #FDF4FF)",
  "questions": [
    {
      "id": "q1",
      "prompt": "下面哪个是哺乳动物？",
      "options": [
        {"id": "q1_a", "label": "猫", "svg_description": "卡通猫咪SVG：圆头三角耳，填充 #FCD34D，stroke #D97706", "is_correct": true, "color": "#FCD34D"},
        {"id": "q1_b", "label": "金鱼", "svg_description": "卡通金鱼SVG：圆身大尾，填充 #F87171，stroke #DC2626", "is_correct": false, "color": "#F87171"}
      ]
    }
  ],
  "animations": {
    "option_idle": "卡片静止显示",
    "option_hover": "scale(1.04) + box-shadow 加深，transition 0.15s",
    "correct_select": "绿色边框 + scale(1.08) bounce + 对勾图标淡入",
    "wrong_select": "红色边框 + shake抖动 0.4s",
    "all_complete": "彩色圆点从顶部飘落 + 显示总分"
  },
  "scoring": {...}, "instructions": "点击选出正确的答案"
}

### drag_sort（拖拽排序）
{
  "game_title": "食物链排序",
  "interaction_type": "drag_sort",
  "layout": "左侧打乱的彩色卡片区，右侧从上到下的排序槽位（虚线圆角框）",
  "background_color": "linear-gradient(135deg, #F0FDF4, #EFF6FF)",
  "items": [
    {"id": "item1", "label": "草", "svg_description": "绿色草丛SVG，填充 #4ADE80，stroke #16A34A", "correct_position": 1, "color": "#4ADE80"}
  ],
  "slots": [
    {"id": "slot_1", "label": "第1位", "position": 1, "color": "#4ADE80"}
  ],
  "sort_label": "从低到高排列食物链",
  "animations": {
    "item_drag": "opacity 0.7 + scale(1.05)",
    "correct_place": "绿色边框 + bounce动画",
    "wrong_place": "shake抖动+回弹原位",
    "all_complete": "彩色圆点飘落+鼓励语"
  },
  "scoring": {...}, "instructions": "把卡片拖到正确的位置"
}

### connect_match（连线配对）
{
  "game_title": "动物与栖息地连线",
  "interaction_type": "connect_match",
  "layout": "左列4个彩色卡片，右列4个彩色卡片，中间SVG画连线",
  "background_color": "linear-gradient(135deg, #EEF2FF, #FDF4FF)",
  "left_items": [
    {"id": "l1", "label": "企鹅", "svg_description": "卡通企鹅SVG：黑白圆身，填充 #1E293B，肚皮白色", "match_id": "r1", "color": "#A78BFA"}
  ],
  "right_items": [
    {"id": "r1", "label": "南极冰川", "svg_description": "卡通冰山SVG：三角形，填充 #BAE6FD，stroke #0EA5E9", "color": "#4F8EF7"}
  ],
  "animations": {
    "item_hover": "scale(1.04) + box-shadow 加深",
    "line_drawing": "SVG line stroke-dasharray 动画从起点到终点 0.3s",
    "correct_match": "连线变绿 #4ADE80",
    "wrong_match": "连线变红 #F87171 后消失",
    "all_complete": "所有连线变金色 #FCD34D + 彩色圆点飘落"
  },
  "scoring": {...}, "instructions": "点击左侧卡片再点击右侧卡片进行配对"
}

### cause_effect（因果操作）
{
  "game_title": "火箭发射实验室",
  "interaction_type": "cause_effect",
  "layout": "左侧彩色控制面板（滑块/按钮），右侧动画展示区，白色圆角卡片",
  "background_color": "linear-gradient(135deg, #EFF6FF, #FDF4FF)",
  "controls": [
    {"id": "ctrl1", "label": "燃料量", "type": "slider", "min": 0, "max": 100, "default": 50, "unit": "升", "color": "#FB923C", "svg_description": "橙色油桶SVG图标，圆柱形，填充 #FB923C"}
  ],
  "effects": [
    {"id": "eff1", "label": "飞行高度", "depends_on": ["ctrl1"], "formula_hint": "燃料越多飞越高", "svg_description": "卡通火箭SVG，红蓝配色，高度随数值变化"}
  ],
  "animations": {
    "control_change": "滑块滑动时实时更新效果区域",
    "effect_update": "效果区SVG平滑过渡 transition 0.5s",
    "goal_reached": "彩色圆点飘落+鼓励语",
    "reset": "复位按钮点击后所有控件回到默认值"
  },
  "scoring": {...}, "instructions": "调节左侧控制参数，观察右侧效果变化"
}

### animated_story（动画演示）
{
  "game_title": "认识浏览器地址栏",
  "interaction_type": "animated_story",
  "layout": "全屏场景：上半部分为知识场景（SVG 绘制），下半部分为旁白文字区 + 继续按钮",
  "background_color": "linear-gradient(135deg, #EEF2FF, #F0FDF4)",
  "scene": {
    "width": 760,
    "height": 320,
    "description": "整体场景的 SVG 布局描述",
    "elements": [
      {
        "id": "elem1",
        "name": "元素名称",
        "type": "rect|circle|path|text|group",
        "x": 50, "y": 50, "width": 200, "height": 40,
        "fill": "#4F8EF7",
        "stroke": "#2563EB",
        "rx": 8,
        "label": "元素标签文字",
        "svg_description": "具体SVG图形描述"
      }
    ]
  },
  "characters": [
    {
      "id": "char1",
      "name": "小明",
      "start_x": 30,
      "start_y": 240,
      "svg_description": "卡通小人SVG：圆形头部填充 #FCD34D，矩形身体填充 #4F8EF7，两条腿，宽30px高50px"
    }
  ],
  "animation_steps": [
    {
      "step": 1,
      "narration": "这是浏览器的地址栏，用来输入网址",
      "actions": [
        {"target": "char1", "type": "move", "to_x": 120, "to_y": 240, "duration_ms": 1000, "easing": "easeInOut"},
        {"target": "elem1", "type": "highlight", "color": "#4F8EF7", "glow": true, "duration_ms": 800}
      ],
      "label_popup": {"text": "地址栏", "point_to": "elem1", "color": "#4F8EF7"}
    }
  ],
  "narration_style": {
    "font_size": 16,
    "color": "#1E293B",
    "background": "#FFFFFF",
    "padding": "12px 20px",
    "border_radius": 12
  },
  "continue_button": {"label": "继续", "color": "#4F8EF7"},
  "animations": {
    "character_walk": "小人水平移动，Y 轴小幅上下模拟走路，transition ease-in-out",
    "highlight_glow": "目标元素 box-shadow 脉冲动画：0 0 0 4px #4F8EF740 循环",
    "label_popup": "标签从元素附近淡入 scale(0.8->1.0)，箭头指向目标",
    "step_transition": "旁白区文字淡出再淡入，新旁白出现",
    "scene_complete": "彩色圆点从顶部飘落，显示完成文字"
  },
  "scoring": {
    "type": "progress",
    "total_steps": 4,
    "encouragement": "太棒了！你已经认识了浏览器的基本组成！"
  },
  "instructions": "点击「继续」按钮，跟着小明一起认识浏览器"
}

设计要点：
- scene.elements 要完整描述场景中所有视觉元素（界面/物体/背景）
- animation_steps 的 actions 要精确到每个元素的动画类型和参数
- 角色动作要生动：走路、指向、跳跃、惊讶
- label_popup 要清晰标注知识点名称

## 通用设计原则
1. SVG 描述用简洁几何卡通图形：圆润形状、填充色鲜明、stroke 比填充深一档
2. 动画效果：正确用 bounce+绿色，错误用 shake+红色，完成用彩色圆点飘落
3. 色调活泼鲜明，使用卡通色板（蓝/绿/红/橙/紫/黄）
4. 布局紧凑，适配 600px 高度的 iframe
5. scoring 包含 correct_points, wrong_penalty, total_items, perfect_score, encouragement（animated_story 用 type:"progress"）
6. 整体风格类似 Duolingo：圆角、彩色、立体感卡片"""


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
            "animated_story": f"- 动画步骤：{len(analysis.get('animation_steps', []))} 步\n- 场景：{analysis.get('scene_description', '')}\n- 角色：{[c.get('name') for c in analysis.get('characters', [])]}",
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
