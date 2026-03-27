"""Node tests: CourseIdeaDetailAgent orchestrator."""

from unittest.mock import AsyncMock, MagicMock

import pytest


class _FakePlanner:
    def __init__(self, plan_result=None, revise_result=None):
        self._plan_result = plan_result
        self._revise_result = revise_result
        self.plan = AsyncMock(return_value=plan_result)
        self.revise = AsyncMock(return_value=revise_result)


class _FakeCritic:
    def __init__(self, reports):
        self._reports = list(reports)
        self.calls = []

    def review(self, mode, detail_plan):
        self.calls.append((mode, detail_plan))
        if self._reports:
            return self._reports.pop(0)
        return {"pass": True, "complexity_score": 100, "persuasion_score": 100, "feedback": ""}


class _FakeSimplifier:
    def __init__(self):
        self.simplify_calls = 0
        self.fallback_calls = 0

    def simplify(self, mode, detail_plan):
        self.simplify_calls += 1
        return detail_plan

    def fallback(self, mode, idea):
        self.fallback_calls += 1
        return {"mode": mode, "fallback": True}


class TestCourseIdeaDetailOrchestratorNode:
    @pytest.mark.asyncio
    async def test_elaborate_uses_fallback_when_planner_fails(self):
        from systemedu.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        planner = _FakePlanner(plan_result=None)
        critic = _FakeCritic([{"pass": True, "complexity_score": 100, "persuasion_score": 100, "feedback": ""}])
        simplifier = _FakeSimplifier()
        agent = CourseIdeaDetailAgent(
            llm=MagicMock(),
            planner=planner,
            critic=critic,
            simplifier=simplifier,
        )
        out = await agent.elaborate({"idea_id": "i1", "mode": "animation", "topic": "力"})
        assert out["detail_plan"]["fallback"] is True
        assert simplifier.fallback_calls == 1

    @pytest.mark.asyncio
    async def test_elaborate_triggers_revision_when_critic_fails(self):
        from systemedu.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        first = {"style_key": "edu_soft_tech", "frame_count": 8, "frames": [], "beats": [], "layout": {"safe_area_fill": 0.2}}
        revised = {"style_key": "edu_soft_tech", "frame_count": 4, "frames": [], "beats": [], "layout": {"safe_area_fill": 0.62}}
        planner = _FakePlanner(plan_result=first, revise_result=revised)
        critic = _FakeCritic(
            [
                {"pass": False, "complexity_score": 50, "persuasion_score": 80, "feedback": "- 太复杂"},
                {"pass": True, "complexity_score": 90, "persuasion_score": 90, "feedback": ""},
                {"pass": True, "complexity_score": 90, "persuasion_score": 90, "feedback": ""},
            ]
        )
        simplifier = _FakeSimplifier()

        agent = CourseIdeaDetailAgent(
            llm=MagicMock(),
            planner=planner,
            critic=critic,
            simplifier=simplifier,
        )
        out = await agent.elaborate({"idea_id": "i2", "mode": "animation", "topic": "力"})
        assert out["detail_plan"]["frame_count"] == 4
        assert planner.revise.await_count == 1
