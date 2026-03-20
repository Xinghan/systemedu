"""GameSpecPlannerAgent - LLM generates structured GameSpec JSON."""

import json
import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent
from systemedu.agents.builtin.gameagent.spec import GameSpec
from systemedu.agents.builtin.gameagent.validator import GameSpecValidator

logger = logging.getLogger(__name__)

PLANNER_SYSTEM_PROMPT = """你是一个教育游戏策划师，专门为儿童和青少年设计基于知识点的互动小游戏。

你的任务是根据提供的知识点信息，生成一个结构化的 GameSpec JSON，描述一个教育小游戏。

【可用的游戏机制（mechanic）】
- drag_sort：将条目拖拽到正确的类别槽中（适合分类型知识点）
- match_pairs：点击左侧概念，再点击右侧配对的定义（适合词汇、术语配对）
- simulation：调节滑块参数，观察右侧效果变化，达成目标条件（适合规律、因果关系）
- label_map：点击场景中的闪烁圆点，探索各部分名称和描述（适合结构、空间知识）
- timeline_order：拖拽卡片按照正确的时间/逻辑顺序排列（适合历史事件、流程步骤）
- boss_quiz：回答选择题击败 Boss，错误次数超过上限则失败（适合概念理解、知识检测）

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
  "scene_description": "人体器官示意图（背景 SVG）",
  "rules": {"correct_points": 10, "max_mistakes": 0, "hint_after_sec": 0},
  "levels": [{"prompt": "点击闪烁的圆点，探索各个部分"}],
  "feedback": {"correct_text": "探索成功！", "wrong_text": "", "complete_text": "全部探索完毕，你已了解这个结构！"}
}

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

【要求】
- 至少 4 个 entities（越多越好，不超过 8 个）
- 根据知识点类型选择最合适的 mechanic
- 如果 lab_strategy 中提供了 game_mechanic 建议，优先使用该 mechanic
- topic 使用知识点标题
- theme 用 1-2 句话描述游戏背景
- 全部文字使用中文
- 直接输出 JSON，不要任何其他文字"""


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
