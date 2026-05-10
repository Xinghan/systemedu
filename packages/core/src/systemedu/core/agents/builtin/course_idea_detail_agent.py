"""CourseIdeaDetailAgent — orchestrates planner/critic/simplifier detail nodes."""

from __future__ import annotations

import logging

from systemedu.core.agents.builtin.course_idea_detail_critic_agent import (
    CourseIdeaDetailCriticAgent,
)
from systemedu.core.agents.builtin.course_idea_detail_planner_agent import (
    CourseIdeaDetailPlannerAgent,
)
from systemedu.core.agents.builtin.course_idea_detail_simplifier_agent import (
    CourseIdeaDetailSimplifierAgent,
)

logger = logging.getLogger(__name__)


class CourseIdeaDetailAgent:
    """Elaborates each CourseIdea using a 3-node pipeline.

    Pipeline:
    1. Planner node: propose a structured detail plan
    2. Critic node: score complexity/persuasion and produce feedback
    3. Simplifier node: deterministic complexity reduction + fallback
    """

    def __init__(
        self,
        llm,
        *,
        planner: CourseIdeaDetailPlannerAgent | None = None,
        critic: CourseIdeaDetailCriticAgent | None = None,
        simplifier: CourseIdeaDetailSimplifierAgent | None = None,
    ):
        self.llm = llm
        self.planner = planner or CourseIdeaDetailPlannerAgent(llm)
        self.critic = critic or CourseIdeaDetailCriticAgent()
        self.simplifier = simplifier or CourseIdeaDetailSimplifierAgent()

    async def elaborate(self, idea: dict) -> dict:
        """Generate a robust detail plan for one idea."""
        mode = idea.get("mode", "")
        topic = idea.get("topic", "")
        style_key = idea.get("style_key", "")

        # exercise mode: skip complex planner/critic pipeline
        # ExerciseGenAgent uses the idea directly, no elaboration needed
        if mode == "exercise":
            result = dict(idea)
            result["detail_plan"] = {
                "mode": "exercise",
                "topic": topic,
                "context_summary": idea.get("context_summary", ""),
                "exercise_count": 2,
            }
            logger.info("CourseIdeaDetailAgent: exercise mode passthrough for '%s'", topic)
            return result

        if mode not in {"animation", "game", "story"}:
            logger.warning("CourseIdeaDetailAgent: unknown mode '%s'", mode)
            return idea

        try:
            detail_plan = await self.planner.plan(idea)
            if not isinstance(detail_plan, dict):
                logger.warning(
                    "CourseIdeaDetailAgent: planner failed for '%s', use fallback",
                    topic,
                )
                detail_plan = self.simplifier.fallback(mode, idea)

            report = self.critic.review(mode, detail_plan)
            if not report["pass"]:
                revised = None
                try:
                    revised = await self.planner.revise(
                        mode=mode,
                        topic=topic,
                        detail_plan=detail_plan,
                        feedback=report.get("feedback", ""),
                        style_key=style_key,
                    )
                except Exception:
                    logger.warning(
                        "CourseIdeaDetailAgent: revise failed for '%s'",
                        topic,
                        exc_info=True,
                    )

                if isinstance(revised, dict):
                    revised_report = self.critic.review(mode, revised)
                    if revised_report["pass"] or (
                        revised_report["complexity_score"] >= report["complexity_score"]
                        and revised_report["persuasion_score"] >= report["persuasion_score"]
                    ):
                        detail_plan = revised

            detail_plan = self.simplifier.simplify(mode, detail_plan)
            final_report = self.critic.review(mode, detail_plan)
            if not final_report["pass"]:
                logger.warning(
                    "CourseIdeaDetailAgent: final plan still weak for '%s', using fallback",
                    topic,
                )
                detail_plan = self.simplifier.fallback(mode, idea)

            result = dict(idea)
            result["detail_plan"] = detail_plan
            logger.info(
                "CourseIdeaDetailAgent: elaborated '%s' (mode=%s)",
                topic,
                mode,
            )
            return result

        except Exception:
            logger.exception(
                "CourseIdeaDetailAgent: unexpected error for '%s' (mode=%s)",
                topic,
                mode,
            )
            result = dict(idea)
            result["detail_plan"] = self.simplifier.fallback(mode, idea)
            return result
