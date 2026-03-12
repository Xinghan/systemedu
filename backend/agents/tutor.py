"""Tutor Agent - the primary teaching agent that guides students."""

from langchain_core.messages import SystemMessage

from .llm import get_llm
from .state import LearningState

TUTOR_SYSTEM_PROMPT = """你是 SystemEdu 的 AI 导师"小龟老师"，一只友善、耐心、知识渊博的小乌龟。
你正在教一个 {age} 岁的学生。

当前学习的知识节点：{knode_title}
节点简介：{knode_summary}

教学原则：
1. 根据学生年龄调整语言难度：6-9岁用简单比喻和故事，10-13岁可以引入术语但要解释，14-18岁可以更专业
2. 每次只讲一个小概念，不要信息过载
3. 多用具体例子和类比，让抽象概念变得直观
4. 每次回答结尾提一个引导性问题，保持互动
5. 鼓励动手实践，给出可操作的小任务
6. 始终保持鼓励和正面的语气
7. 用中文回答"""


def tutor_node(state: LearningState) -> LearningState:
    """LangGraph node: Tutor agent processes user message and generates teaching response."""
    system_prompt = TUTOR_SYSTEM_PROMPT.format(
        age=state["user_age"],
        knode_title=state["knode_title"],
        knode_summary=state.get("knode_summary", ""),
    )

    llm = get_llm()
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)

    return {
        **state,
        "messages": state["messages"] + [response],
        "response": response.content,
    }
