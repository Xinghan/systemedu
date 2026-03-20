"""GameSpecPlannerAgent - LLM generates structured GameSpec JSON."""

import json
import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent
from systemedu.agents.builtin.gameagent.spec import GameSpec
from systemedu.agents.builtin.gameagent.validator import GameSpecValidator

logger = logging.getLogger(__name__)

PLANNER_SYSTEM_PROMPT = """你是一位顶级教育游戏策划师，为 6-18 岁学生设计沉浸式、主题完全匹配的互动小游戏。

你的核心原则：
1. 游戏视觉和主题必须与知识点完全对应。学火箭就要有火箭，学细胞就要有细胞，学光合作用就要有植物和阳光。
2. 游戏逻辑必须服务于学习目标，让学生在"玩"的过程中真正理解概念。
3. 禁止使用通用的抽象场景（如随机柱状图、无意义圆圈）——必须设计与主题强相关的具体场景。

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

【输出格式（严格 JSON，无其他文字）】

drag_sort 示例：
{
  "mechanic": "drag_sort",
  "topic": "知识点标题",
  "theme": "游戏背景主题描述",
  "difficulty": 5,
  "entities": [
    {"id": "e1", "label": "条目名称", "category": "cat1", "color": "#4F8EF7"},
    {"id": "e2", "label": "条目名称", "category": "cat2", "color": "#4ADE80"}
  ],
  "categories": [
    {"id": "cat1", "label": "类别A"},
    {"id": "cat2", "label": "类别B"}
  ],
  "rules": {"correct_points": 10, "max_mistakes": 3, "hint_after_sec": 8},
  "levels": [{"prompt": "将以下内容拖入正确类别"}, {"prompt": "继续分类剩余内容"}],
  "feedback": {"correct_text": "分类正确！", "wrong_text": "再想想...", "complete_text": "太棒了，全部分类完成！"}
}

match_pairs 示例：
{
  "mechanic": "match_pairs",
  "topic": "知识点标题",
  "theme": "连线配对游戏",
  "difficulty": 4,
  "entities": [
    {"id": "e1", "term": "概念词", "definition": "对应定义"},
    {"id": "e2", "term": "概念词", "definition": "对应定义"}
  ],
  "rules": {"correct_points": 10, "max_mistakes": 5, "hint_after_sec": 10},
  "levels": [{"prompt": "点击左侧概念，再点击右侧对应的定义"}],
  "feedback": {"correct_text": "配对成功！", "wrong_text": "再试一次！", "complete_text": "全部配对完成，太厉害了！"}
}

simulation 示例：
{
  "mechanic": "simulation",
  "topic": "知识点标题",
  "theme": "参数调节实验",
  "difficulty": 6,
  "entities": [
    {"id": "p1", "param_name": "temperature", "label": "温度", "min": 0, "max": 100, "default": 20, "unit": "°C", "effect_key": "speed"},
    {"id": "p2", "param_name": "pressure", "label": "压力", "min": 0, "max": 100, "default": 30, "unit": "Pa", "effect_key": "density"}
  ],
  "target_condition": "将温度和压力都调高，使反应速率超过 70%",
  "visual_description": "气体分子运动速率可视化",
  "rules": {"correct_points": 15, "max_mistakes": 0, "hint_after_sec": 12},
  "levels": [{"prompt": "拖动滑块调节参数，观察右侧变化"}, {"prompt": "尝试让进度条超过 70%"}],
  "feedback": {"correct_text": "参数设置正确！", "wrong_text": "", "complete_text": "实验成功！你掌握了规律！"}
}

label_map 示例：
{
  "mechanic": "label_map",
  "topic": "知识点标题",
  "theme": "探索地图",
  "difficulty": 3,
  "entities": [
    {"id": "l1", "name": "部位名称", "x": 25, "y": 40, "description": "该部位的功能描述"},
    {"id": "l2", "name": "部位名称", "x": 60, "y": 55, "description": "该部位的功能描述"}
  ],
  "scene_description": "人体器官示意图",
  "scene_type": "human_body",
  "rules": {"correct_points": 10, "max_mistakes": 0, "hint_after_sec": 0},
  "levels": [{"prompt": "点击闪烁的圆点，探索各个部分"}],
  "feedback": {"correct_text": "探索成功！", "wrong_text": "", "complete_text": "全部探索完毕，你已了解这个结构！"}
}

【label_map scene_type 取值规则（必须从以下选一个）】
- rocket       → 火箭、航天器、运载火箭、飞船
- human_body   → 人体、解剖、器官、骨骼、肌肉
- cell         → 细胞、细胞器、线粒体、细胞核
- earth        → 地球、大气层、地理、陆地、海洋
- brain        → 大脑、神经系统、脑区、认知
- atom         → 原子、分子、电子、质子、化学结构
- plant        → 植物、花、根、叶、光合作用
- default      → 以上都不匹配时使用

【label_map entities 坐标说明】
- x, y 是百分比坐标（0-100），基于 600×500 的场景画布
- 火箭场景：鼻锥顶部约 x=50,y=18；头锥约 y=25；窗口约 y=42；分级线约 y=62；尾翼约 y=88；推进系统约 y=75
- 人体场景：头部约 x=50,y=16；心脏约 x=53,y=38；左肺约 x=42,y=36；胃约 x=50,y=56；左臂约 x=38,y=48；腿约 y=80
- 细胞场景：细胞膜约 x=50,y=50；细胞核约 x=50,y=46；核糖体约 x=25,y=60；线粒体约 x=32,y=42；液泡约 x=68,y=36
- 地球场景：大气层约 x=50,y=14；海洋约 x=34,y=52；陆地约 x=56,y=44；极地约 x=50,y=18；卫星约 x=84,y=38
- 脑部场景：额叶约 x=38,y=30；顶叶约 x=55,y=28；颞叶约 x=30,y=52；枕叶约 x=72,y=40；小脑约 x=50,y=74
- 原子场景：原子核约 x=50,y=50；电子1约 x=80,y=50；电子2约 x=28,y=28；电子3约 x=28,y=72
- 植物场景：花朵约 x=50,y=40；叶片约 x=38,y=62；茎约 x=50,y=70；根系约 x=50,y=88；土壤约 x=50,y=82

timeline_order 示例：
{
  "mechanic": "timeline_order",
  "topic": "知识点标题",
  "theme": "历史时间线",
  "difficulty": 5,
  "ordered_items": [
    {"id": "t1", "label": "第一个事件", "date": "1776年", "emoji": ""},
    {"id": "t2", "label": "第二个事件", "date": "1789年", "emoji": ""},
    {"id": "t3", "label": "第三个事件", "date": "1815年", "emoji": ""},
    {"id": "t4", "label": "第四个事件", "date": "1848年", "emoji": ""}
  ],
  "entities": [],
  "rules": {"correct_points": 10, "max_mistakes": 3, "hint_after_sec": 10},
  "levels": [{"prompt": "拖动卡片，按照正确的时间顺序排列"}],
  "feedback": {"correct_text": "顺序正确！", "wrong_text": "顺序有误，调整一下", "complete_text": "时间线排列正确，太厉害了！"}
}

boss_quiz 示例：
{
  "mechanic": "boss_quiz",
  "topic": "知识点标题",
  "theme": "知识挑战",
  "difficulty": 6,
  "boss_name": "知识守卫者",
  "boss_emoji": "🤖",
  "questions": [
    {
      "id": "q1",
      "question": "问题内容？",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correct": "选项A"
    },
    {
      "id": "q2",
      "question": "另一个问题？",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correct": "选项C"
    }
  ],
  "entities": [],
  "rules": {"correct_points": 10, "max_mistakes": 3, "hint_after_sec": 0},
  "levels": [{"prompt": "回答问题击败 Boss！每次答错扣一条命"}],
  "feedback": {"correct_text": "答对了！造成伤害！", "wrong_text": "答错了！小心！", "complete_text": "Boss 已击败！知识就是力量！"}
}

【强制要求】
- 至少 4 个 entities（推荐 5-7 个），不超过 8 个
- mechanic 选择：优先 lab_strategy 中的 game_mechanic 建议；否则根据知识点类型选最合适的
- topic 使用知识点标题；theme 用 1-2 句话描述游戏场景（要有画面感，体现主题）
- 全部文字使用中文
- 直接输出 JSON，不要任何其他文字

【mechanic 选择指导】
- 知识点是"认识/了解某个结构/系统" → 优先 label_map（带 scene_type）
- 知识点是"理解变量如何影响结果" → 优先 simulation（带 scene_type）
- 知识点是"理解事件/步骤顺序" → 优先 timeline_order
- 知识点是"区分/归类多个概念" → 优先 drag_sort
- 知识点是"记忆术语定义" → 优先 match_pairs
- 综合测验/章节末尾 → boss_quiz

【simulation 参数设计要求】
- 每个参数必须与主题场景强关联，有物理或逻辑意义
  ✓ 火箭：param_name="thrust" label="推力", param_name="fuel" label="燃料量", param_name="angle" label="发射角度"
  ✗ 错误：param_name="param1" label="参数1"（无意义）
- effect_key 用于标识该参数影响的效果，如 "altitude"/"rate"/"temperature"
- 必须填写 scene_type（同 label_map 规则）和 visual_description（一句话描述右侧看到的画面）

【label_map 设计要求】
- scene_type 必须从以下选一个：rocket / human_body / cell / earth / brain / atom / plant / default
- entities 的 x,y 坐标必须与 scene_type 的实际画面匹配（参考坐标说明）
- description 要具体说明该部位的功能，不要泛泛而谈

【label_map scene_type 坐标参考】
- rocket(600x500)：鼻锥 x=50,y=18；气动整流罩 x=50,y=28；载荷舱 x=50,y=38；航电系统 x=56,y=50；推进系统 x=50,y=75；栅格翼 x=39,y=58；回收腿 x=50,y=90
- human_body(600x500)：头部/脑 x=50,y=16；心脏 x=54,y=38；左肺 x=42,y=36；右肺 x=58,y=36；胃 x=50,y=56；肝脏 x=56,y=50；肾脏 x=44,y=62；脊柱 x=50,y=50
- cell(600x500)：细胞膜 x=78,y=50；细胞核 x=50,y=46；核仁 x=50,y=46；线粒体 x=32,y=42；核糖体 x=25,y=62；内质网 x=65,y=62；高尔基体 x=38,y=66；液泡 x=65,y=34
- earth(600x500)：大气层 x=50,y=16；平流层 x=50,y=22；海洋 x=34,y=54；陆地 x=56,y=44；地壳 x=68,y=62；地幔 x=75,y=50；地核 x=50,y=50
- plant(600x500)：花朵 x=50,y=39；叶片左 x=38,y=58；叶片右 x=62,y=50；茎 x=50,y=70；根系 x=50,y=86；土壤 x=50,y=82；阳光 x=86,y=14"""


class GameSpecPlannerAgent(BaseAgent):
    """Generates a structured GameSpec from knowledge node info via LLM."""

    name = "game_spec_planner"
    description = "根据知识点生成结构化 GameSpec JSON，用于游戏编译"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm
        self._validator = GameSpecValidator()

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
                system_prompt=PLANNER_SYSTEM_PROMPT,
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
