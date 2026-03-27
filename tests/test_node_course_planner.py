"""Node tests: CoursePlannerAgent."""

from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage


def _make_llm_with_responses(*responses: str):
    llm = MagicMock()
    side_effect = [AIMessage(content=r) for r in responses]
    llm.invoke = MagicMock(side_effect=side_effect)
    return llm


class TestCoursePlannerNode:
    @pytest.mark.asyncio
    async def test_plan_detailed_expands_when_first_pass_short(self):
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        short = "## 学习目标\n\n1. 理解概念\n\n## 正文\n\n简短内容。"
        long = "## 学习目标\n\n- 目标1\n\n## 正文\n\n" + ("详细内容。" * 600)
        llm = _make_llm_with_responses(short, long)
        agent = CoursePlannerAgent(llm)
        result = await agent.plan_detailed("力", "关于力", 3, "物理")
        assert len(result) > len(short)
        assert llm.invoke.call_count == 2

    @pytest.mark.asyncio
    async def test_plan_detailed_returns_empty_on_exception(self):
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=RuntimeError("llm error"))
        result = await CoursePlannerAgent(llm).plan_detailed("力", "关于力", 3, "物理")
        assert result == ""
