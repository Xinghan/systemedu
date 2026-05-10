"""CourseIdeaDetailCriticAgent - evaluates detail plan quality."""

from __future__ import annotations

from systemedu.core.agents.builtin.media_art_direction import (
    evaluate_detail_plan,
    format_detail_plan_feedback,
)


class CourseIdeaDetailCriticAgent:
    """Critic node: checks complexity and persuasion quality."""

    def review(self, mode: str, detail_plan: dict) -> dict:
        """Return review report for a detail plan."""
        report = evaluate_detail_plan(mode, detail_plan)
        report["feedback"] = format_detail_plan_feedback(report)
        return report
