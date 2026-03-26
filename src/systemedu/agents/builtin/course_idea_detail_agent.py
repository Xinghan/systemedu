"""CourseIdeaDetailAgent — elaborates each CourseIdea into a detailed production plan."""

import json
import logging

logger = logging.getLogger(__name__)

ANIMATION_DETAIL_PROMPT = """你是一位动画脚本设计师，请为以下知识点设计一个教育动画的帧序列方案。

知识点：{topic}
上下文：{context_summary}

请输出一个详细的动画制作方案，严格按以下 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "title": "动画标题（10字以内）",
  "frame_count": 6,
  "frames": [
    {{
      "frame_index": 0,
      "description": "该帧展示的内容描述（20-40字）",
      "visual_elements": ["元素1", "元素2", "元素3"],
      "narration": "该帧的旁白或说明文字（可选，20字以内）"
    }}
  ],
  "style_hint": "科技感|卡通|手绘|写实",
  "animation_type": "流程演示|对比展示|数据变化|物理过程|概念图解"
}}

要求：
- frame_count 为 4-8 帧
- 每帧描述清晰，有明确的视觉重点
- visual_elements 列出该帧需要绘制的主要元素（3-5个）
- 全部使用中文（animation_type 中的分类词除外）
- 直接输出 JSON，不要其他文字
"""

GAME_DETAIL_PROMPT = """你是一位教育游戏设计师，请为以下知识点设计一个模拟实验互动游戏方案。

知识点：{topic}
上下文：{context_summary}

游戏类型固定为 simulation（模拟实验）：学生通过调节参数、观察实验结果来理解知识点，适合有因果关系的概念。

请输出一个详细的游戏设计方案，严格按以下 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "game_mechanic": "simulation",
  "game_concept": "学生通过这个模拟实验将理解什么核心概念（20-40字）",
  "game_title": "游戏标题（10字以内）",
  "interaction_flow": [
    "步骤1：调节哪个参数",
    "步骤2：观察什么现象",
    "步骤3：得出什么结论"
  ],
  "win_condition": "正确完成条件描述（20字以内）",
  "difficulty_hint": "easy|medium|hard",
  "simulation_params": [
    {{
      "param_name": "参数英文名（如 temperature、voltage）",
      "label": "参数中文名（如 温度、电压）",
      "min": 0,
      "max": 100,
      "default": 50,
      "unit": "单位（如 °C、V）"
    }}
  ],
  "scene_description": "模拟场景的视觉描述（40-60字），描述画面中有什么元素、参数变化时会看到什么效果"
}}

要求：
- game_mechanic 必须是 "simulation"，不能是其他值
- simulation_params 包含 2-4 个有意义的参数，每个参数必须与知识点强相关
- interaction_flow 包含 3-5 个步骤
- 全部使用中文（game_mechanic、param_name、difficulty_hint 除外）
- 直接输出 JSON，不要其他文字
"""

STORY_DETAIL_PROMPT = """你是一位儿童教育故事作家，请为以下知识点创作一个引人入胜的教育故事。

知识点：{topic}
上下文：{context_summary}

请输出一个故事方案，严格按以下 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "title": "故事标题（10字以内）",
  "paragraphs": [
    {{
      "text": "故事正文段落，中文，生动有趣，100-150字",
      "image_prompt": "This paragraph's illustration: [detailed English description for image generation, include art style, colors, characters, setting]"
    }}
  ]
}}

要求：
- 共 3-5 个段落
- 每段有独立的场景和情节
- 故事要有完整的起承转合
- text 全部使用中文，语言亲切适合学生
- image_prompt 必须是英文，详细描述图片内容（40-80词），包含风格（如：children's book illustration style, vibrant colors）
- 最后一段要点题，总结知识点
- 直接输出 JSON，不要其他文字
"""


class CourseIdeaDetailAgent:
    """Elaborates each CourseIdea into a detailed production plan based on its mode."""

    def __init__(self, llm):
        self.llm = llm

    async def elaborate(self, idea: dict) -> dict:
        """Generate a detailed plan for a single CourseIdea.

        Returns the idea dict with 'detail_plan' filled in.
        """
        mode = idea.get("mode", "")
        topic = idea.get("topic", "")
        context_summary = idea.get("context_summary", "")

        prompt_map = {
            "animation": ANIMATION_DETAIL_PROMPT,
            "game": GAME_DETAIL_PROMPT,
            "story": STORY_DETAIL_PROMPT,
        }

        prompt_template = prompt_map.get(mode)
        if not prompt_template:
            logger.warning(f"CourseIdeaDetailAgent: unknown mode '{mode}'")
            return idea

        from langchain_core.messages import HumanMessage

        prompt = prompt_template.format(
            topic=topic,
            context_summary=context_summary,
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

            detail_plan = json.loads(text)
            result = dict(idea)
            result["detail_plan"] = detail_plan
            logger.info(
                f"CourseIdeaDetailAgent: elaborated idea '{topic}' (mode={mode})"
            )
            return result

        except (json.JSONDecodeError, TypeError):
            logger.exception(
                f"CourseIdeaDetailAgent: failed to parse detail plan for idea '{topic}'"
            )
            return idea
        except Exception:
            logger.exception(
                f"CourseIdeaDetailAgent: unexpected error for idea '{topic}'"
            )
            return idea
