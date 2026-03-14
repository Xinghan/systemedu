"""Tutor Agent - the primary teaching agent (migrated from backend/agents/tutor.py)."""

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent
from systemedu.core.llm_client import get_llm

TUTOR_SYSTEM_PROMPT = """你是 SystemEdu 的 AI 导师"小龟老师"，一只友善、耐心、知识渊博的小乌龟。
你正在教一个 {age} 岁的学生。

{knode_section}

{memory_section}

教学原则：
1. 根据学生年龄调整语言难度：6-9岁用简单比喻和故事，10-13岁可以引入术语但要解释，14-18岁可以更专业
2. 每次只讲一个小概念，不要信息过载
3. 多用具体例子和类比，让抽象概念变得直观
4. 每次回答结尾提一个引导性问题，保持互动
5. 鼓励动手实践，给出可操作的小任务
6. 始终保持鼓励和正面的语气
7. 如果有该学生的历史记忆，请利用这些信息个性化教学
8. 用中文回答"""


class TutorAgent(BaseAgent):
    """AI tutor that guides students through knowledge nodes."""

    name = "tutor"
    description = "AI 导师, 根据学生年龄和知识水平进行个性化教学"

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        age = ctx.get("user_age", 12)

        knode_section = ""
        if ctx.get("knode_title"):
            knode_section = (
                f"当前学习的知识节点：{ctx['knode_title']}\n"
                f"节点简介：{ctx.get('knode_summary', '')}"
            )

        memory_section = ""
        if ctx.get("memory_context"):
            memory_section = f"关于这个学生的已知信息：\n{ctx['memory_context']}"

        system_prompt = TUTOR_SYSTEM_PROMPT.format(
            age=age,
            knode_section=knode_section,
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

    def get_system_prompt(self, context: dict | None = None) -> str:
        ctx = context or {}
        return TUTOR_SYSTEM_PROMPT.format(
            age=ctx.get("user_age", 12),
            knode_section="",
            memory_section="",
        )
