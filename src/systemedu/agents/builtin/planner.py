"""Planner Agent - generates knowledge trees (migrated from backend/agents/planner.py)."""

import json
import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent
from systemedu.core.llm_client import get_llm

logger = logging.getLogger(__name__)


async def _astream_to_text(llm, messages) -> str:
    """spec 020: 用 astream 收集 chunk 拼成完整文本。

    streaming 模式下 nginx / OpenAI SDK 不会触发"总响应时间超时", 因为
    chunk 持续涌出。reasoning 阶段虽然没字符输出, 但 GLM 在 thinking
    完成后立即开始流 content 阶段, 后续 chunk 间隔短。

    每收到一个 chunk 都 log 一次 chunk 数量, 便于线上诊断进度。
    """
    buf: list[str] = []
    n_chunks = 0
    last_log_chunks = 0
    async for chunk in llm.astream(messages):
        text = getattr(chunk, "content", "") or ""
        if text:
            buf.append(text)
            n_chunks += 1
            # 每 50 个 chunk log 一次, 避免日志爆炸
            if n_chunks - last_log_chunks >= 50:
                logger.info(f"[Planner] streaming: {n_chunks} chunks, {sum(len(s) for s in buf)} chars so far")
                last_log_chunks = n_chunks
    full = "".join(buf)
    logger.info(f"[Planner] stream done: {n_chunks} chunks, {len(full)} chars")
    return full


def _compute_tree_scale(target_nodes: int) -> dict:
    """Compute milestone and node ranges based on target node count."""
    if target_nodes <= 15:
        return {"milestones": "2-3", "nodes_per": "2-5", "target": target_nodes}
    elif target_nodes <= 50:
        return {"milestones": "3-6", "nodes_per": "3-10", "target": target_nodes}
    elif target_nodes <= 150:
        return {"milestones": "5-10", "nodes_per": "8-15", "target": target_nodes}
    else:
        return {"milestones": "8-15", "nodes_per": "15-35", "target": target_nodes}


# ── Step 1: Curriculum outline ────────────────────────────────────────────────

OUTLINE_PROMPT = """你是 SystemEdu 的课程架构师。为以下项目设计课程大纲。

项目：{title}
描述：{description}
学生年龄：{age} 岁
目标节点数：约 {target} 个

请将课程拆分为 {milestones} 个里程碑，每个里程碑内列出该阶段应掌握的知识点群组。

【重要的结构原则】
真实的知识图谱并非一条直线，而是一棵有宽度的树。请分析每个里程碑内的知识点，判断：
- 哪些知识点是**概念并列**的（例如"速度/加速度/位移"都是运动学基础，可以并列学习）
- 哪些知识点是**真实串行**的（例如"理解力的概念"必须先于"牛顿第二定律"）

将知识点按"主题群"组织，每个主题群内的节点是并列的，主题群之间才是串行的。

返回以下 JSON（只返回 JSON）：
```json
{{
  "milestones": [
    {{
      "title": "里程碑名",
      "description": "本阶段核心目标",
      "topic_groups": [
        {{
          "group_name": "主题群名",
          "is_parallel": true,
          "topics": ["知识点A", "知识点B", "知识点C"]
        }}
      ]
    }}
  ]
}}
```

is_parallel=true 表示该群内各 topic 互相独立可并行，is_parallel=false 表示该群内 topics 有真实串行依赖。"""


# ── Step 2: Full node expansion ───────────────────────────────────────────────

EXPAND_PROMPT = """你是 SystemEdu 的课程节点设计师。根据课程大纲，生成完整的知识树 JSON。

项目：{title}
学生年龄：{age} 岁

大纲：
{outline}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【一、节点拆分规则】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 每个 topic 对应 1 个知识节点
- 若该 topic 内含 2 个以上可独立教学的子概念，可拆成 2 个节点（基础 + 进阶），但不强制

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【二、summary 写作要求（最重要）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
summary 必须是 3-5 句话的实质性描述，不得是标题的简单改写。每个 summary 必须包含：
① 这个知识点是什么（定义/现象/概念）
② 为什么重要 / 在项目中有什么作用
③ 学完后学生能做什么 / 能理解什么

写作风格：面向 {age} 岁学生，语言具体，有画面感，避免空洞。

好的示例（火箭项目中"推力与阻力"节点）：
  "推力是火箭发动机喷出燃气产生的向上的力，阻力是空气对火箭运动的阻碍力。
   理解两者的关系，是预测火箭能否成功升空的核心。当推力大于重力+阻力之和时，
   火箭才能加速离地。学完本节，你能计算一个简单火箭模型在给定推力下能否起飞。"

差的示例（禁止这样写）：
  "本节介绍推力与阻力的概念。"（只是标题改写，没有实质内容）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【三、difficulty_level 评估方法（1-10）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
difficulty_level 必须根据以下维度综合评估，不能统一写成同一个值：

基准：以 {age} 岁学生的平均认知水平为基准（该年龄的 "中等难度" = 5 分）

评估维度：
A. 抽象程度：纯具体/可见事物(+0) → 需要类比才能理解(+1) → 纯抽象概念/公式(+2)
B. 前置知识量：无需前置(+0) → 需要1-2个前置(+1) → 需要多个前置且容易混淆(+2)
C. 操作复杂度：只需记忆/识别(+0) → 需要简单计算或操作(+1) → 需要推导/综合应用(+2)
D. 年龄适配调整：该概念是否超出该年龄段通常接触范围(-1/0/+1)

打分参考（面向 {age} 岁）：
- 1-2分：生活中直接可见，几乎不需要解释（如"火箭是什么"、"速度是快慢"）
- 3-4分：需要简单讲解，但直觉上容易接受（如"重力把东西往下拉"）
- 5-6分：需要认真学习，有一定抽象性（如"牛顿第三定律"、"动量守恒"）
- 7-8分：较难，需要前置知识且有公式推导（如"比冲的计算"、"轨道力学基础"）
- 9-10分：专业级，该年龄段极少能掌握（慎用）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【四、estimated_minutes 评估方法】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
estimated_minutes 是学生完成该节点学习（含阅读、练习、互动）所需的总时间，
范围 10-45 分钟，按以下逻辑评估：

基础时间（由内容复杂度决定）：
- 纯概念/定义类（只需理解）：10-15 分钟
- 概念 + 少量例题：15-20 分钟
- 有公式/计算/代码：20-30 分钟
- 需要动手实验/综合项目：30-45 分钟

调整因子：
- difficulty_level >= 7：+5 分钟
- 该节点是多个概念的综合（由2个以上子概念合并而来）：+5 分钟
- 学生年龄 <= 10 岁：整体 × 1.2（低龄学生需要更多时间）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【五、xp_reward 计算方法】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
xp_reward 反映完成该节点的"成就感"，与难度和学习投入正相关：

公式：xp_reward = difficulty_level × 8 + round(estimated_minutes × 0.8)

调整规则：
- 结果取整到最近的 5 的倍数
- 最低 10 分，最高 150 分
- 里程碑末尾的节点（往往是综合性节点）额外 +10 分

示例：difficulty=6, minutes=25 → 6×8 + 25×0.8 = 68 → 取整到 70

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【六、prerequisite_indices 规则】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 使用全局节点索引（所有节点从 0 开始连续编号，按里程碑顺序）
- 只有当"不掌握 A，就无法理解 B"时，才建立 B→A 的依赖
- is_parallel=true 的主题群：节点之间绝对不要互相依赖（都指向群外共同前置，或空列表）
- is_parallel=false 的主题群：逐一判断，若无真实依赖则改为并列
- 每个里程碑的入口节点，依赖上一个里程碑末尾的 1-2 个节点

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【七、其他字段说明】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
content_type（根据节点实际内容选择最匹配的一种）：
- text：以阅读和理解为主的概念节点
- interactive：以互动游戏/动手操作为主
- code：需要编写或阅读代码
- experiment：有动手实验或真实操作
- quiz：主要以测验形式检验掌握程度
- video：以视频为主要载体

acceptance_type（学生如何证明掌握）：
- quiz：选择题/判断题测验
- code_submit：提交代码
- essay：写作/报告
- demo：演示/展示
- auto：系统自动判断（完成互动即通过）

只返回 JSON，格式如下：
```json
{{
  "milestones": [
    {{
      "title": "里程碑标题",
      "description": "里程碑描述（2-3句，说明本阶段学完后能做什么）",
      "order": 0,
      "knodes": [
        {{
          "title": "节点标题",
          "summary": "3-5句实质性描述，包含：①是什么 ②为何重要 ③学完能做什么",
          "difficulty_level": 4,
          "content_type": "text",
          "acceptance_type": "quiz",
          "estimated_minutes": 20,
          "xp_reward": 50,
          "order": 0,
          "prerequisite_indices": []
        }}
      ]
    }}
  ]
}}
```"""


class PlannerAgent(BaseAgent):
    """Generates knowledge trees using a 2-step outline→expand pipeline."""

    name = "planner"
    description = "课程规划, 将项目拆解为知识树"

    async def process(self, message: str, context: dict | None = None) -> str:
        """2-step pipeline: outline (with parallel/serial analysis) → expand."""
        ctx = context or {}
        age = ctx.get("user_age", 12)
        target_nodes = ctx.get("target_nodes", 20)

        lines = message.strip().splitlines()
        title = lines[0].replace("项目标题：", "").strip() if lines else message
        description = lines[1].replace("项目描述：", "").strip() if len(lines) > 1 else ""

        provider = self.config.llm_provider if self.config else None
        # spec 020: streaming=True + max_retries=0
        # - streaming 让 nginx / SDK 按"chunk 间空闲"判活, 避免长请求被
        #   "总响应时间超时"杀掉
        # - max_retries=0 关掉 SDK 自动重试, 由 tree_generator 外层 max_retries=3
        #   接管, 避免双倍累计超时
        llm = get_llm(provider=provider, temperature=0.4, streaming=True, max_retries=0)
        scale = _compute_tree_scale(target_nodes)

        # ── Step 1: Structured outline with parallel/serial grouping ──────
        logger.info(f"[Planner] Step 1: outline for '{title}' (~{target_nodes} nodes)")
        outline_text = await _astream_to_text(llm, [
            SystemMessage(content="你是课程架构师，只输出要求的JSON，不添加任何说明。"),
            HumanMessage(content=OUTLINE_PROMPT.format(
                title=title,
                description=description,
                age=age,
                target=target_nodes,
                milestones=scale["milestones"],
            )),
        ])
        outline_json = _extract_json(outline_text)
        n_milestones = len(outline_json.get("milestones", []))
        logger.info(f"[Planner] Step 1 done: {n_milestones} milestones")

        # ── Step 2: Expand to full node tree ──────────────────────────────
        logger.info(f"[Planner] Step 2: expanding to full node tree")
        expand_text = await _astream_to_text(llm, [
            SystemMessage(content="你是课程节点设计师，只输出要求的JSON，不添加任何说明。"),
            HumanMessage(content=EXPAND_PROMPT.format(
                title=title,
                age=age,
                outline=json.dumps(outline_json, ensure_ascii=False, indent=2),
            )),
        ])
        tree_json = _extract_json(expand_text)
        total_nodes = sum(len(m.get("knodes", [])) for m in tree_json.get("milestones", []))
        logger.info(f"[Planner] Step 2 done: {total_nodes} total nodes")

        return json.dumps(tree_json, ensure_ascii=False)

    def generate_tree(self, project_title: str, project_description: str, user_age: int = 12) -> dict:
        """Generate a knowledge tree and return parsed JSON."""
        import asyncio
        content = asyncio.get_event_loop().run_until_complete(
            self.process(
                f"项目标题：{project_title}\n项目描述：{project_description}",
                context={"user_age": user_age},
            )
        )
        return json.loads(content)


def _extract_json(content: str) -> dict:
    """Extract JSON from LLM response (fenced block or raw object)."""
    for pattern in [r"```json\s*\n?(.*?)```", r"```\s*\n?(.*?)```"]:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                pass

    brace_start = content.find("{")
    if brace_start >= 0:
        depth = 0
        for i in range(brace_start, len(content)):
            if content[i] == "{":
                depth += 1
            elif content[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(content[brace_start: i + 1])
                    except json.JSONDecodeError:
                        break

    raise ValueError("No valid JSON found in LLM response")
