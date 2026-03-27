"""CourseIdeaDetailPlannerAgent - first-stage planner for idea detail plans."""

from __future__ import annotations

import json
import logging

from systemedu.agents.builtin.media_art_direction import (
    animation_component_library_block,
    motion_preset_block,
    style_kit_prompt_block,
)

logger = logging.getLogger(__name__)

ANIMATION_DETAIL_PROMPT = """你是一位动画脚本设计师，请为以下知识点设计一个教育动画的帧序列方案。

知识点：{topic}
上下文：{context_summary}
{style_kit_block}
{component_library_block}
{motion_block}

重要约束：
- 只允许设计“一个主场景”，不要切换多个场景
- 目标是“简单但有说服力”：控制复杂度，强调关键因果关系
- 禁止堆叠过多元素和效果

请输出一个可执行的动画制作方案，严格按以下 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "style_key": "edu_soft_tech|concept_lab_clean|storybook_vivid",
  "title": "动画标题（10字以内）",
  "frame_count": 6,
  "layout": {{
    "focal_object": "主焦点对象（如 电视屏幕）",
    "secondary_object": "次焦点对象（如 遥控器）",
    "safe_area_fill": 0.62
  }},
  "asset_plan": ["优先复用的组件1", "组件2", "组件3"],
  "persuasion": {{
    "learning_claim": "本动画要让学生确信的核心结论（20-40字）",
    "evidence": "通过什么视觉证据说服学生（20-40字）",
    "takeaway": "学生看完后能复述什么（15-30字）"
  }},
  "beats": [
    {{
      "t": 0.0,
      "action": "enter|anticipation|main_action|secondary_overlap|settle",
      "focus": "该时刻聚焦对象"
    }}
  ],
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
- frame_count 为 4-6 帧
- layout.safe_area_fill 必须在 0.55-0.8 之间（确保主体不小）
- 每帧描述清晰，有明确的视觉重点
- visual_elements 列出该帧需要绘制的主要元素（2-3个）
- beats 至少 4 个，且必须覆盖 anticipation、main_action、settle
- 全部使用中文（animation_type 中的分类词除外）
- 直接输出 JSON，不要其他文字
"""

GAME_DETAIL_PROMPT = """你是一位教育游戏设计师，请为以下知识点设计一个模拟实验互动游戏方案。

知识点：{topic}
上下文：{context_summary}
{style_kit_block}

游戏类型固定为 simulation（模拟实验）：学生通过调节参数、观察实验结果来理解知识点，适合有因果关系的概念。
设计目标：一个核心实验场景，少量参数，但要非常有说服力。

请输出一个详细的游戏设计方案，严格按以下 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "style_key": "edu_soft_tech|concept_lab_clean|storybook_vivid",
  "game_mechanic": "simulation",
  "game_concept": "学生通过这个模拟实验将理解什么核心概念（20-40字）",
  "game_title": "游戏标题（10字以内）",
  "visual_focus": "画面主焦点（如 小车、电路、光束）",
  "visual_storyboard": [
    "初始状态画面",
    "用户调节参数时变化",
    "结果反馈画面"
  ],
  "persuasion": {{
    "learning_claim": "本实验要证明的结论（20-40字）",
    "evidence": "学生会观察到的关键证据（20-40字）",
    "takeaway": "学生操作后应得出的结论（15-30字）"
  }},
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
- simulation_params 包含 2-3 个有意义的参数，每个参数必须与知识点强相关
- interaction_flow 包含 3-5 个步骤
- visual_storyboard 必须包含 3 个阶段并且与 interaction_flow 对应
- 全部使用中文（game_mechanic、param_name、difficulty_hint 除外）
- 直接输出 JSON，不要其他文字
"""

STORY_DETAIL_PROMPT = """你是一位儿童教育故事作家，请为以下知识点创作一个引人入胜的教育故事。

知识点：{topic}
上下文：{context_summary}
{style_kit_block}

请输出一个故事方案，严格按以下 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "style_key": "edu_soft_tech|concept_lab_clean|storybook_vivid",
  "title": "故事标题（10字以内）",
  "character_bible": [
    {{
      "name": "角色名",
      "appearance": "外观关键词",
      "personality": "性格关键词"
    }}
  ],
  "persuasion": {{
    "learning_claim": "故事想让学生理解的核心道理（20-40字）",
    "evidence": "通过哪段情节体现该道理（20-40字）",
    "takeaway": "学生读完可复述的结论（15-30字）"
  }},
  "paragraphs": [
    {{
      "text": "故事正文段落，中文，生动有趣，100-150字",
      "image_prompt": "This paragraph's illustration: [detailed English description for image generation, include art style, colors, characters, setting]"
    }}
  ]
}}

要求：
- 共 3-4 个段落
- 每段有独立的场景和情节
- 故事要有完整的起承转合
- 每段 image_prompt 保持角色外观一致，突出单一视觉焦点
- text 全部使用中文，语言亲切适合学生
- image_prompt 必须是英文，详细描述图片内容（40-80词），包含风格（如：children's book illustration style, vibrant colors）
- 最后一段要点题，总结知识点
- 直接输出 JSON，不要其他文字
"""

DETAIL_REVISION_PROMPT = """你是一位教育内容总导演。请根据审查反馈修订下列 detail_plan。

目标：
1. 简化复杂度：确保单场景、低负担、可一次生成
2. 保持说服力：学习主张清晰，有视觉或交互证据
3. 不改变 mode 与 topic，只优化结构

mode: {mode}
topic: {topic}
审查反馈：
{feedback}

原始 detail_plan JSON：
{raw_detail_plan}

请输出“修订后的完整 JSON”，不要解释。
"""


def _strip_code_fence(text: str) -> str:
    if not text.startswith("```"):
        return text
    lines = text.split("\n")
    return "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()


class CourseIdeaDetailPlannerAgent:
    """Planner node for course idea detail plans."""

    def __init__(self, llm):
        self.llm = llm

    async def plan(self, idea: dict) -> dict | None:
        """Generate initial detail_plan for one idea."""
        from langchain_core.messages import HumanMessage

        mode = idea.get("mode", "")
        topic = idea.get("topic", "")
        context_summary = idea.get("context_summary", "")
        style_key = idea.get("style_key")

        prompt_map = {
            "animation": ANIMATION_DETAIL_PROMPT,
            "game": GAME_DETAIL_PROMPT,
            "story": STORY_DETAIL_PROMPT,
        }
        prompt_template = prompt_map.get(mode)
        if not prompt_template:
            return None

        prompt = prompt_template.format(
            topic=topic,
            context_summary=context_summary,
            style_kit_block=style_kit_prompt_block(mode=mode, preferred_key=style_key),
            component_library_block=(
                animation_component_library_block() if mode == "animation" else ""
            ),
            motion_block=(motion_preset_block() if mode == "animation" else ""),
        )

        import asyncio

        response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
        text = _strip_code_fence(response.content.strip())
        detail_plan = json.loads(text)
        if not isinstance(detail_plan, dict):
            return None
        if not detail_plan.get("style_key") and style_key:
            detail_plan["style_key"] = style_key
        return detail_plan

    async def revise(
        self,
        *,
        mode: str,
        topic: str,
        detail_plan: dict,
        feedback: str,
        style_key: str = "",
    ) -> dict | None:
        """Revise a detail plan with feedback."""
        from langchain_core.messages import HumanMessage

        prompt = DETAIL_REVISION_PROMPT.format(
            mode=mode,
            topic=topic,
            feedback=feedback,
            raw_detail_plan=json.dumps(detail_plan, ensure_ascii=False)[:6000],
        )

        import asyncio

        response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
        text = _strip_code_fence(response.content.strip())
        revised = json.loads(text)
        if not isinstance(revised, dict):
            return None
        if not revised.get("style_key") and style_key:
            revised["style_key"] = style_key
        return revised
