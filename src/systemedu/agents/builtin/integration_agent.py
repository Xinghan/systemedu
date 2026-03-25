"""IntegrationAgent — pure Python: injects generated content into plan placeholders."""

import logging

logger = logging.getLogger(__name__)


class IntegrationAgent:
    """Integrates all generated idea results back into the learning plan.

    Pure Python, no LLM required.
    """

    def integrate(self, plan_with_placeholders: str, ideas: list[dict]) -> dict:
        """Build the final CourseContent dict.

        Replaces [[IDEA:{idea_id}]] placeholders in the plan with
        rendered section markers, and constructs the CourseContent structure.

        Returns a CourseContent dict.
        """
        rendered_sections: dict[str, dict] = {}

        for idea in ideas:
            idea_id = idea.get("idea_id", "")
            mode = idea.get("mode", "")
            result = idea.get("result")

            if not idea_id or not mode:
                continue

            section: dict = {"mode": mode, "html": None, "story_paragraphs": None}

            if mode in ("animation", "game"):
                html = result if isinstance(result, str) else ""
                section["html"] = html
                section["status"] = "ready" if html else "failed"
            elif mode == "story":
                story_paragraphs = result if isinstance(result, list) else []
                section["story_paragraphs"] = story_paragraphs
                section["status"] = "ready" if story_paragraphs else "failed"
            else:
                section["status"] = "failed"

            rendered_sections[idea_id] = section

        # Build final plan_markdown: replace placeholders with marker comments
        final_plan = plan_with_placeholders
        for idea_id in rendered_sections:
            placeholder = f"[[IDEA:{idea_id}]]"
            # Keep placeholder in plan_markdown for frontend to use as anchor
            # Frontend will look up rendered_sections[idea_id] by idea_id
            if placeholder not in final_plan:
                logger.warning(
                    f"IntegrationAgent: placeholder '{placeholder}' not found in plan"
                )

        course_content = {
            "plan_markdown": final_plan,
            "ideas": [
                {
                    "idea_id": idea.get("idea_id", ""),
                    "mode": idea.get("mode", ""),
                    "topic": idea.get("topic", ""),
                    "context_summary": idea.get("context_summary", ""),
                }
                for idea in ideas
            ],
            "rendered_sections": rendered_sections,
        }

        logger.info(
            f"IntegrationAgent: integrated {len(rendered_sections)} sections"
        )
        return course_content
