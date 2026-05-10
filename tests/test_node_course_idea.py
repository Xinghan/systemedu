"""Node tests: CourseIdeaAgent."""

import json
from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage


def _make_llm(response_text: str):
    llm = MagicMock()
    llm.invoke = MagicMock(return_value=AIMessage(content=response_text))
    return llm


class TestCourseIdeaNode:
    @pytest.mark.asyncio
    async def test_identify_keeps_style_and_mode_reason(self):
        from systemedu.core.agents.builtin.course_idea_agent import CourseIdeaAgent

        plan = "正文段落[[IDEA:idea-1]]"
        ideas = [
            {
                "idea_id": "idea-1",
                "mode": "animation",
                "style_key": "edu_soft_tech",
                "topic": "力传递",
                "context_summary": "通过动态展示力传递",
                "mode_reason": "动态变化适合动画",
            }
        ]
        llm = _make_llm(f"{plan}\n---SEPARATOR---\n{json.dumps(ideas, ensure_ascii=False)}")
        plan_text, parsed = await CourseIdeaAgent(llm).identify("原始计划", "力")
        assert plan_text == plan
        assert len(parsed) == 1
        assert parsed[0]["style_key"] == "edu_soft_tech"
        assert parsed[0]["mode_reason"] == "动态变化适合动画"

    @pytest.mark.asyncio
    async def test_identify_returns_empty_ideas_on_invalid_json(self):
        from systemedu.core.agents.builtin.course_idea_agent import CourseIdeaAgent

        llm = _make_llm("内容\n---SEPARATOR---\nnot json")
        plan_text, ideas = await CourseIdeaAgent(llm).identify("原始", "力")
        assert plan_text == "原始"
        assert ideas == []
