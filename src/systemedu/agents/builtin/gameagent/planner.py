"""GameSpecPlannerAgent - LLM generates structured GameSpec JSON."""

import json
import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent
from systemedu.agents.builtin.gameagent.spec import GameSpec
from systemedu.agents.builtin.gameagent.validator import GameSpecValidator

logger = logging.getLogger(__name__)

# Supported objects whitelist: injected into system prompt so LLM can only pick from these.
# Keeping it here (not inside the prompt literal) makes it easy to extend.
_SUPPORTED_OBJECTS = [
    "rocket.basic",
    "human_body.external",
    "cell.animal",
    "atom.bohr",
    "plant.basic",
    "earth.basic",
]

# Part whitelist per object (used in prompt examples so LLM knows valid part_ids)
_OBJECT_PARTS_HINT = {
    "rocket.basic": [
        "nose_cone", "body", "window", "interstage",
        "left_fin", "right_fin", "grid_fin_left", "engine_nozzle", "flame",
    ],
    "human_body.external": [
        "head", "torso", "heart", "left_lung", "right_lung",
        "stomach", "left_arm", "right_arm", "left_leg", "right_leg", "brain_outline",
    ],
    "cell.animal": [
        "cell_membrane", "nucleus", "nucleolus", "cytoplasm",
        "mitochondria_1", "ribosome", "er_rough", "golgi", "vacuole",
    ],
    "atom.bohr": [
        "nucleus", "proton", "neutron",
        "electron_shell_1", "electron_shell_2", "electron_1",
    ],
    "plant.basic": [
        "stem", "root", "leaf_left", "leaf_right", "leaf_top", "flower", "sun",
    ],
    "earth.basic": [
        "crust", "mantle", "outer_core", "inner_core",
        "atmosphere", "ocean", "land_mass",
    ],
}


def _build_object_spec_section() -> str:
    """Build the supported objects section injected into the system prompt."""
    lines = ["【label_map / simulation 的 object_spec 规则】"]
    lines.append("")
    lines.append("object_spec 字段中，object_key 必须从以下列表选一个，不允许发明新对象：")
    lines.append("")
    for key in _SUPPORTED_OBJECTS:
        parts = _OBJECT_PARTS_HINT.get(key, [])
        lines.append(f"  {key}")
        lines.append(f"    可标注部件：{', '.join(parts)}")
        lines.append("")
    lines.append("如果主题不适合以上任何对象，请换用其他 mechanic（drag_sort / match_pairs / timeline_order / boss_quiz）。")
    lines.append("不允许在 object_key 里发明 'rocket_detailed' / 'human_neural' 等不在列表中的名字。")
    lines.append("")
    lines.append("object_spec 字段示例（label_map 火箭）：")
    lines.append('  "object_spec": {')
    lines.append('    "object_key": "rocket.basic",')
    lines.append('    "view": "side",')
    lines.append('    "label_part_ids": ["nose_cone", "body", "engine_nozzle", "left_fin", "interstage"],')
    lines.append('    "highlight_part_ids": ["engine_nozzle"]')
    lines.append('  }')
    lines.append("")
    lines.append("label_part_ids 中的每个 part_id 必须出现在该对象的可标注部件列表中。")
    lines.append("推荐标注 4-6 个部件，不超过 8 个。")
    lines.append("LLM 不需要提供坐标、颜色、形状——这些由系统自动生成。")
    return "\n".join(lines)


PLANNER_SYSTEM_PROMPT = """你是一位顶级教育游戏策划师，为 6-18 岁学生设计沉浸式、主题完全匹配的互动小游戏。

你的核心原则：
1. 游戏视觉和主题必须与知识点完全对应。学火箭就要有火箭，学细胞就要有细胞，学光合作用就要有植物和阳光。
2. 游戏逻辑必须服务于学习目标，让学生在"玩"的过程中真正理解概念。
3. 禁止使用通用的抽象场景——必须设计与主题强相关的具体场景。

【可用的游戏机制（mechanic）】
- drag_sort：将条目拖拽到正确的类别槽中（适合分类型知识点）
  好例子：火箭零件按系统分类、食物按营养素分类、动物按栖息地分类
- match_pairs：点击左侧概念，再点击右侧配对的定义（适合词汇、术语配对）
  好例子：细胞器与功能配对、元素符号与名称配对、历史事件与年代配对
- simulation：调节参数滑块，观察右侧可视化场景的实时变化（适合因果/规律类知识点）
  好例子：调推力+燃料观察火箭升空高度、调光照+CO2观察植物光合速率、调温度+浓度观察化学反应
- label_map：点击场景中特定位置的闪烁圆点，解锁该部位的名称和功能说明（适合结构/解剖类）
  好例子：火箭剖面图各系统位置标注、人体器官位置、细胞结构、地球圈层
- timeline_order：拖拽卡片按照正确的时间/流程顺序排列（适合历史/流程类）
  好例子：火箭发射流程、历史朝代、生物进化阶段、化学反应步骤
- boss_quiz：回答选择题击败 Boss（适合综合测验）
  好例子：系统学完后挑战"知识守卫者"，用问答检验掌握程度

【mechanic 选择指导】
- 知识点是"认识/了解某个结构/系统" → 优先 label_map（需填 object_spec）
- 知识点是"理解变量如何影响结果" → 优先 simulation（需填 object_spec）
- 知识点是"理解事件/步骤顺序" → 优先 timeline_order
- 知识点是"区分/归类多个概念" → 优先 drag_sort
- 知识点是"记忆术语定义" → 优先 match_pairs
- 综合测验/章节末尾 → boss_quiz

{object_spec_section}

【输出格式（严格 JSON，无其他文字）】

drag_sort 示例：
{{
  "mechanic": "drag_sort",
  "topic": "知识点标题",
  "theme": "游戏背景主题描述",
  "difficulty": 5,
  "entities": [
    {{"id": "e1", "label": "条目名称", "category": "cat1", "color": "#4F8EF7"}},
    {{"id": "e2", "label": "条目名称", "category": "cat2", "color": "#4ADE80"}}
  ],
  "categories": [
    {{"id": "cat1", "label": "类别A"}},
    {{"id": "cat2", "label": "类别B"}}
  ],
  "rules": {{"correct_points": 10, "max_mistakes": 3, "hint_after_sec": 8}},
  "levels": [{{"prompt": "将以下内容拖入正确类别"}}],
  "feedback": {{"correct_text": "分类正确！", "wrong_text": "再想想...", "complete_text": "太棒了，全部分类完成！"}}
}}

match_pairs 示例：
{{
  "mechanic": "match_pairs",
  "topic": "知识点标题",
  "theme": "连线配对游戏",
  "difficulty": 4,
  "entities": [
    {{"id": "e1", "term": "概念词", "definition": "对应定义"}},
    {{"id": "e2", "term": "概念词", "definition": "对应定义"}}
  ],
  "rules": {{"correct_points": 10, "max_mistakes": 5, "hint_after_sec": 10}},
  "levels": [{{"prompt": "点击左侧概念，再点击右侧对应的定义"}}],
  "feedback": {{"correct_text": "配对成功！", "wrong_text": "再试一次！", "complete_text": "全部配对完成，太厉害了！"}}
}}

simulation 示例（含 object_spec）：
{{
  "mechanic": "simulation",
  "topic": "知识点标题",
  "theme": "火箭推进实验",
  "difficulty": 6,
  "entities": [
    {{"id": "p1", "param_name": "thrust", "label": "推力", "min": 0, "max": 100, "default": 30, "unit": "kN", "effect_key": "altitude"}},
    {{"id": "p2", "param_name": "fuel", "label": "燃料量", "min": 0, "max": 100, "default": 50, "unit": "%", "effect_key": "duration"}},
    {{"id": "p3", "param_name": "angle", "label": "发射角度", "min": 60, "max": 90, "default": 80, "unit": "°", "effect_key": "trajectory"}}
  ],
  "object_spec": {{
    "object_key": "rocket.basic",
    "view": "side",
    "label_part_ids": [],
    "highlight_part_ids": ["engine_nozzle", "flame"]
  }},
  "target_condition": "推力超过 70 且燃料量超过 60",
  "visual_description": "火箭随推力增加上升，燃料影响飞行时长",
  "rules": {{"correct_points": 15, "max_mistakes": 0, "hint_after_sec": 12}},
  "levels": [{{"prompt": "拖动滑块调节参数，让火箭成功升空"}}],
  "feedback": {{"correct_text": "参数设置正确！", "wrong_text": "", "complete_text": "实验成功！你掌握了规律！"}}
}}

label_map 示例（含 object_spec）：
{{
  "mechanic": "label_map",
  "topic": "知识点标题",
  "theme": "探索火箭结构",
  "difficulty": 3,
  "entities": [],
  "object_spec": {{
    "object_key": "rocket.basic",
    "view": "side",
    "label_part_ids": ["nose_cone", "body", "engine_nozzle", "left_fin", "interstage"],
    "highlight_part_ids": ["engine_nozzle"]
  }},
  "scene_description": "火箭侧视剖面图",
  "rules": {{"correct_points": 10, "max_mistakes": 0, "hint_after_sec": 0}},
  "levels": [{{"prompt": "点击闪烁的圆点，探索各个部分"}}],
  "feedback": {{"correct_text": "探索成功！", "wrong_text": "", "complete_text": "全部探索完毕，你已了解这个结构！"}}
}}

timeline_order 示例：
{{
  "mechanic": "timeline_order",
  "topic": "知识点标题",
  "theme": "历史时间线",
  "difficulty": 5,
  "ordered_items": [
    {{"id": "t1", "label": "第一个事件", "date": "1776年", "emoji": ""}},
    {{"id": "t2", "label": "第二个事件", "date": "1789年", "emoji": ""}},
    {{"id": "t3", "label": "第三个事件", "date": "1815年", "emoji": ""}},
    {{"id": "t4", "label": "第四个事件", "date": "1848年", "emoji": ""}}
  ],
  "entities": [],
  "rules": {{"correct_points": 10, "max_mistakes": 3, "hint_after_sec": 10}},
  "levels": [{{"prompt": "拖动卡片，按照正确的时间顺序排列"}}],
  "feedback": {{"correct_text": "顺序正确！", "wrong_text": "顺序有误，调整一下", "complete_text": "时间线排列正确，太厉害了！"}}
}}

boss_quiz 示例：
{{
  "mechanic": "boss_quiz",
  "topic": "知识点标题",
  "theme": "知识挑战",
  "difficulty": 6,
  "boss_name": "知识守卫者",
  "boss_emoji": "",
  "questions": [
    {{
      "id": "q1",
      "question": "问题内容？",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correct": "选项A"
    }},
    {{
      "id": "q2",
      "question": "另一个问题？",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correct": "选项C"
    }}
  ],
  "entities": [],
  "rules": {{"correct_points": 10, "max_mistakes": 3, "hint_after_sec": 0}},
  "levels": [{{"prompt": "回答问题击败 Boss！每次答错扣一条命"}}],
  "feedback": {{"correct_text": "答对了！造成伤害！", "wrong_text": "答错了！小心！", "complete_text": "Boss 已击败！知识就是力量！"}}
}}

【强制要求】
- drag_sort / match_pairs 至少 4 个 entities（推荐 5-7 个），不超过 8 个
- label_map 使用 object_spec，entities 留空列表
- simulation 使用 object_spec，entities 填参数滑块
- mechanic 选择：优先 lab_strategy 中的 game_mechanic 建议；否则根据知识点类型选最合适的
- topic 使用知识点标题；theme 用 1-2 句话描述游戏场景（要有画面感，体现主题）
- 全部文字使用中文
- 直接输出 JSON，不要任何其他文字

【simulation 参数设计要求】
- 每个参数必须与主题场景强关联，有物理或逻辑意义
  正确：param_name="thrust" label="推力", param_name="fuel" label="燃料量"
  错误：param_name="param1" label="参数1"（无意义）
- effect_key 用于标识该参数影响的效果，如 "altitude"/"rate"/"temperature"
"""


class GameSpecPlannerAgent(BaseAgent):
    """Generates a structured GameSpec from knowledge node info via LLM."""

    name = "game_spec_planner"
    description = "根据知识点生成结构化 GameSpec JSON，用于游戏编译"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm
        self._validator = GameSpecValidator()

    def _build_system_prompt(self) -> str:
        """Inject the supported objects whitelist into the system prompt at runtime."""
        return PLANNER_SYSTEM_PROMPT.format(
            object_spec_section=_build_object_spec_section()
        )

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        spec = await self.plan(
            node_title=message,
            node_summary=ctx.get("summary", ""),
            difficulty=ctx.get("difficulty", 5),
            lab_strategy=ctx.get("lab_strategy", {}),
        )
        return spec.model_dump_json() if spec else ""

    async def plan(
        self,
        node_title: str,
        node_summary: str,
        difficulty: int,
        lab_strategy: dict | None = None,
    ) -> GameSpec | None:
        """Generate and validate a GameSpec for the given knowledge node.

        Returns a validated GameSpec, or None on failure.
        """
        lab_strategy = lab_strategy or {}
        difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"
        suggested_mechanic = lab_strategy.get("game_mechanic", "")

        user_prompt = (
            f"知识点：{node_title}\n"
            f"简介：{node_summary}\n"
            f"难度：{difficulty}/10（{difficulty_desc}）\n"
        )
        if suggested_mechanic:
            user_prompt += f"建议游戏机制：{suggested_mechanic}\n"
        user_prompt += "\n请生成 GameSpec JSON。"

        try:
            agent = create_deep_agent(
                model=self._llm,
                tools=[],
                system_prompt=self._build_system_prompt(),
            )
            result = await agent.ainvoke({"messages": [HumanMessage(content=user_prompt)]})

            raw = ""
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content:
                    raw = msg.content
                    break

            raw = raw.strip()
            # Strip markdown fences
            if raw.startswith("```"):
                lines = raw.split("\n")
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                raw = raw.strip()

            data = json.loads(raw)
            spec = GameSpec(**data)
            valid, errors = self._validator.validate(spec)
            if not valid:
                logger.warning(f"GameSpec validation failed for '{node_title}': {errors}")
                return None

            logger.info(f"GameSpec planned: mechanic={spec.mechanic}, entities={len(spec.entities)} for '{node_title}'")
            return spec

        except Exception:
            logger.exception(f"GameSpecPlannerAgent failed for '{node_title}'")
            return None
