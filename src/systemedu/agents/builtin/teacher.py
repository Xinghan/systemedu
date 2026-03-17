"""TeacherAgent - AI classroom teacher that delivers lessons and guides discussions."""

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent
from systemedu.core.llm_client import get_llm

TEACHER_SYSTEM_PROMPT = """你是 SystemEdu 的 AI 课堂老师"星星老师"，一位温暖、专业、善于引导的老师。
你正在教一个 {age} 岁的学生。

{knode_section}

{lesson_plan_section}

{memory_section}

你的角色是**课堂讲解老师**，与"小龟老师"（AI 导师，负责个性化辅导）不同，你负责：
1. 系统地讲解知识点，按照教学策略有条理地展开
2. 用生动的语言和丰富的例子，让课堂生动有趣
3. 在讲解中穿插提问，检查学生理解情况
4. 当学生回答正确时给予肯定，回答错误时耐心引导
5. 适时总结要点，帮助学生形成完整的知识框架
6. 推荐学生去做实验和练习来巩固知识

教学风格：
- 根据学生年龄调整语言：6-9岁用故事和游戏化语言，10-13岁可以更正式但仍保持趣味，14-18岁可以像大学课堂一样
- 每次讲解一个概念后，用一个小问题确认理解
- 善用"你觉得为什么会这样？""你能举个例子吗？"这样的引导性问题
- 如果学生表现出困惑，换一种方式重新讲解
- 用中文回答"""


class TeacherAgent(BaseAgent):
    """AI classroom teacher that delivers structured lessons."""

    name = "teacher"
    description = "AI 课堂老师，负责系统地讲解知识点，引导课堂讨论"

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        age = ctx.get("user_age", 12)

        knode_section = ""
        if ctx.get("knode_title"):
            knode_section = (
                f"当前讲解的知识节点：{ctx['knode_title']}\n"
                f"节点简介：{ctx.get('knode_summary', '')}"
            )

        lesson_plan_section = ""
        if ctx.get("lesson_plan"):
            plan = ctx["lesson_plan"]
            lesson_plan_section = (
                f"教学策略：\n"
                f"- 核心要点：{plan.get('concept_emphasis', '')}\n"
                f"- 讲解方式：{plan.get('concept_approach', '')}\n"
                f"- 语气风格：{plan.get('overall_tone', '')}\n"
                f"- 关键术语：{', '.join(plan.get('key_vocabulary', []))}"
            )

        memory_section = ""
        if ctx.get("memory_context"):
            memory_section = f"关于这个学生的已知信息：\n{ctx['memory_context']}"

        system_prompt = TEACHER_SYSTEM_PROMPT.format(
            age=age,
            knode_section=knode_section,
            lesson_plan_section=lesson_plan_section,
            memory_section=memory_section,
        )

        provider = self.config.llm_provider if self.config else None
        llm = get_llm(provider=provider, streaming=False)

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=message),
        ]

        response = llm.invoke(messages)
        return response.content
