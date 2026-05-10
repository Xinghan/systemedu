"""Node tests: CourseIdeaDetailPlannerAgent."""

import json
from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage


def _make_llm(response_text: str):
    llm = MagicMock()
    llm.invoke = MagicMock(return_value=AIMessage(content=response_text))
    return llm


class TestCourseIdeaDetailPlannerNode:
    @pytest.mark.asyncio
    async def test_plan_animation_returns_detail_plan(self):
        from systemedu.core.agents.builtin.course_idea_detail_planner_agent import (
            CourseIdeaDetailPlannerAgent,
        )

        payload = {
            "style_key": "edu_soft_tech",
            "title": "力传递",
            "frame_count": 4,
            "layout": {"focal_object": "小球", "secondary_object": "手", "safe_area_fill": 0.62},
            "asset_plan": ["focus_highlight"],
            "persuasion": {"learning_claim": "A", "evidence": "B", "takeaway": "C"},
            "beats": [{"t": 0.0, "action": "enter", "focus": "小球"}],
            "frames": [{"frame_index": 0, "description": "初始", "visual_elements": ["小球", "手"], "narration": ""}],
            "style_hint": "科技感",
            "animation_type": "流程演示",
        }
        llm = _make_llm(json.dumps(payload, ensure_ascii=False))
        planner = CourseIdeaDetailPlannerAgent(llm)
        result = await planner.plan(
            {
                "mode": "animation",
                "topic": "力传递",
                "context_summary": "上下文",
                "style_key": "edu_soft_tech",
            }
        )
        assert result is not None
        assert result["title"] == "力传递"
        assert result["style_key"] == "edu_soft_tech"

    @pytest.mark.asyncio
    async def test_revise_returns_revised_plan(self):
        from systemedu.core.agents.builtin.course_idea_detail_planner_agent import (
            CourseIdeaDetailPlannerAgent,
        )

        revised = {"style_key": "concept_lab_clean", "game_mechanic": "simulation", "simulation_params": []}
        llm = _make_llm(json.dumps(revised, ensure_ascii=False))
        planner = CourseIdeaDetailPlannerAgent(llm)
        result = await planner.revise(
            mode="game",
            topic="折射",
            detail_plan={"bad": True},
            feedback="- 参数过多",
            style_key="concept_lab_clean",
        )
        assert result is not None
        assert result["style_key"] == "concept_lab_clean"
