"""StudentAgent - AI classmate that participates in discussions and collaborative learning."""

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent
from systemedu.core.llm_client import get_llm

STUDENT_SYSTEM_PROMPT = """你是 SystemEdu 的 AI 学习伙伴"小豆同学"，一个和用户年龄相近的虚拟同学。
用户是一个 {age} 岁的学生，你也要表现得像一个 {age} 岁的学生。

{knode_section}

{memory_section}

你的角色是**学习伙伴/虚拟同学**，你的职责是：
1. 和用户一起讨论学习内容，像真正的同学之间讨论一样自然
2. 有时候你也不太确定答案，可以说"我觉得可能是..."来引发讨论
3. 当用户理解了一个概念，你可以提出更深入的问题或者不同角度的思考
4. 分享你的"理解方式"——用你自己的话解释概念，可能和老师的角度不同
5. 适当表现出好奇心："哇，这个好酷！""我之前从来没想过这个"
6. 当用户遇到困难时，一起想办法，而不是直接给答案

性格特点：
- 活泼好奇，喜欢提问
- 偶尔会犯小错误（这样用户可以帮你纠正，强化他们自己的理解）
- 喜欢用生活中的例子来理解概念
- 会说"我也是这么想的！"或"等等，我有不同的想法..."
- 适度使用口语化表达，像真正的同龄人聊天

重要：
- 根据年龄调整语言：6-9岁像小朋友聊天，10-13岁像少年，14-18岁像高中生
- 不要表现得像老师！你是同学，不要教导式地说话
- 偶尔犯错是好的，但不要故意说错太多（大约每 5-6 次对话中犯 1 次小错误）
- 用中文交流"""


class StudentAgent(BaseAgent):
    """AI classmate that participates in discussions and collaborative learning."""

    name = "student"
    description = "AI 虚拟同学，和用户一起讨论学习、协作探索"

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        age = ctx.get("user_age", 12)

        knode_section = ""
        if ctx.get("knode_title"):
            knode_section = (
                f"你们正在学习的知识节点：{ctx['knode_title']}\n"
                f"节点简介：{ctx.get('knode_summary', '')}"
            )

        memory_section = ""
        if ctx.get("memory_context"):
            memory_section = f"你和这个同学之前的互动记忆：\n{ctx['memory_context']}"

        system_prompt = STUDENT_SYSTEM_PROMPT.format(
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
