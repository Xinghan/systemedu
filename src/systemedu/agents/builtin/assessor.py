"""Assessor Agent - evaluates student knowledge."""

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent
from systemedu.core.llm_client import get_llm

ASSESSOR_SYSTEM_PROMPT = """你是 SystemEdu 的知识评估 AI。你需要评估一个 {age} 岁学生对知识节点的掌握程度。

{knode_section}

评估原则：
1. 提出 2-3 个递进式问题来测试理解程度
2. 根据年龄调整问题难度
3. 评估完成后给出分数（0-100）和反馈
4. 指出学生的优势和需要改进的地方
5. 用中文回答，语气友善鼓励"""


class AssessorAgent(BaseAgent):
    """Evaluates student knowledge on specific topics."""

    name = "assessor"
    description = "知识评估, 测试学生对知识节点的掌握程度"

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        age = ctx.get("user_age", 12)

        knode_section = ""
        if ctx.get("knode_title"):
            knode_section = (
                f"评估的知识节点：{ctx['knode_title']}\n"
                f"节点简介：{ctx.get('knode_summary', '')}"
            )

        system_prompt = ASSESSOR_SYSTEM_PROMPT.format(
            age=age,
            knode_section=knode_section,
        )

        provider = self.config.llm_provider if self.config else None
        llm = get_llm(provider=provider, streaming=False)

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=message),
        ]

        response = llm.invoke(messages)
        return response.content
