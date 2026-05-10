"""CourseIdeaDetailPlannerAgent - first-stage planner for idea detail plans."""

from __future__ import annotations

import json
import logging

from systemedu.core.agents.builtin.media_art_direction import (
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
  "style_key": "aether_clinic|ares_mission|celestial_observatory|helix_lab|neural_circuit|subatomic_matrix|rocketry_control|aqua_flow|ember_forge|flora_pulse",
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
  "animation_type": "流程演示|对比展示|数据变化|物理过程|概念图解",
  "user_guide": {{
    "what_it_shows": "这个动画展示了什么（一句话，20-30字）",
    "observe_points": ["观察重点1", "观察重点2", "观察重点3"],
    "controls": "播放控制说明（如：自动循环播放，共4个阶段；或：点击播放/暂停，共6帧）",
    "takeaway": "看完后你能回答什么问题（15-25字）"
  }}
}}

要求：
- frame_count 为 4-6 帧
- layout.safe_area_fill 必须在 0.55-0.8 之间（确保主体不小）
- 每帧描述清晰，有明确的视觉重点
- visual_elements 列出该帧需要绘制的主要元素（2-3个）
- beats 至少 4 个，且必须覆盖 anticipation、main_action、settle
- user_guide.observe_points 至少 2 项，每项 10-20 字，指出学生应注意的视觉变化
- user_guide.controls 必须明确说明播放方式（自动循环/手动翻页/点击播放等）
- 全部使用中文（animation_type 中的分类词除外）
- 直接输出 JSON，不要其他文字
"""

GAME_DETAIL_PROMPT = """你是一位教育游戏设计师，请为以下知识点设计最合适的互动游戏方案。

知识点：{topic}
上下文：{context_summary}
{style_kit_block}

【mechanic 选择规则（必须严格遵守）】
根据知识点类型选择一种 mechanic：
- simulation   → 知识点有明确的"参数→结果"因果规律，可用 2-4 个滑块直观展示
  例：调推力观察火箭升空高度、调温度观察化学反应速率、调电压观察电流
- drag_sort    → 需要将多个概念/事物归类到不同类别
  例：火箭零件按系统分类、食物按营养素分类、动物按栖息地分类
- match_pairs  → 需要配对记忆：概念↔定义、术语↔解释、符号↔含义
  例：细胞器与功能配对、元素符号与名称配对、公式符号与物理量配对
- timeline_order → 知识点有明确的先后顺序或步骤流程
  例：火箭发射流程、化学反应步骤、生物进化阶段
- boss_quiz    → 综合测验型，知识点适合用选择题检验
  例：章节末综合测试、多知识点交叉考察

设计目标：机制与知识点高度匹配，学生在"玩"的过程中自然理解概念。
注意：只允许选以上 5 种 mechanic，不要选 free_simulation 或其他。

请输出游戏设计方案，严格按以下 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "style_key": "aether_clinic|ares_mission|celestial_observatory|helix_lab|neural_circuit|subatomic_matrix|rocketry_control|aqua_flow|ember_forge|flora_pulse",
  "game_mechanic": "simulation|drag_sort|match_pairs|timeline_order|boss_quiz",
  "mechanic_reason": "一句话解释为什么选这个 mechanic（15-25字）",
  "game_concept": "学生通过这个游戏将理解什么核心概念（20-40字）",
  "game_title": "游戏标题（10字以内）",
  "visual_focus": "画面主焦点（如 小车、电路、光束、卡片组）",
  "visual_storyboard": [
    "初始/开始状态画面描述",
    "核心交互过程画面描述",
    "完成/反馈状态画面描述"
  ],
  "persuasion": {{
    "learning_claim": "这个游戏要证明的核心结论（20-40字）",
    "evidence": "学生会看到/体验到的关键证据（20-40字）",
    "takeaway": "学生完成后应能复述的结论（15-30字）"
  }},
  "interaction_flow": [
    "步骤1：学生做什么操作",
    "步骤2：看到什么变化/反馈",
    "步骤3：得出什么结论"
  ],
  "win_condition": "正确完成的判定条件（20字以内）",
  "difficulty_hint": "easy|medium|hard",
  "simulation_params": [],
  "scene_description": "游戏场景的视觉描述（60-100字），描述画面布局、主要元素、交互时的视觉变化",
  "user_guide": {{
    "goal": "游戏目标（一句话，15-25字）",
    "controls": [
      {{"element": "按钮/控件名称", "action": "点击/拖拽/滑动后做什么"}}
    ],
    "steps": ["第一步做什么", "第二步做什么", "第三步做什么"],
    "win_condition": "怎样算通关（15-20字）",
    "tips": "操作提示（15-25字）"
  }}
}}

重要说明：
- simulation_params 仅在 game_mechanic="simulation" 时填写（2-3个参数对象），其他 mechanic 留空列表 []
- simulation_params 每项格式：{{"param_name":"英文名","label":"中文名","min":0,"max":100,"default":50,"unit":"单位"}}
- interaction_flow 包含 3-5 个步骤，必须与 game_mechanic 的交互方式一致
- visual_storyboard 必须 3 项，对应 开始/过程/结束
- user_guide.controls 列出学生能看到的每一个交互控件及其功能，至少 2 项
- user_guide.steps 必须是具体可操作的步骤（3-5步），不要写抽象描述
- 全部使用中文（game_mechanic、param_name、difficulty_hint 除外）
- 直接输出 JSON，不要其他文字
"""

STORY_DETAIL_PROMPT = """你是一位儿童教育故事作家，请为以下知识点创作一个引人入胜的教育故事。

知识点：{topic}
上下文：{context_summary}
{style_kit_block}

请输出一个故事方案，严格按以下 JSON 格式（不要包含 markdown 代码块标记）：
{{
  "style_key": "aether_clinic|ares_mission|celestial_observatory|helix_lab|neural_circuit|subatomic_matrix|rocketry_control|aqua_flow|ember_forge|flora_pulse",
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
