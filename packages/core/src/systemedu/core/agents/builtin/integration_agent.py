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
            generation_backend = self._resolve_generation_backend(idea)

            if not idea_id or not mode:
                continue

            section: dict = {
                "mode": mode,
                "html": None,
                "story_paragraphs": None,
                "exercises": None,
                "generation_backend": generation_backend,
                "user_guide": self._extract_user_guide(idea),
            }

            if mode in ("animation", "game"):
                html = result if isinstance(result, str) else ""
                section["html"] = html
                section["status"] = "ready" if html else "failed"
            elif mode == "story":
                story_paragraphs = result if isinstance(result, list) else []
                section["story_paragraphs"] = story_paragraphs
                section["status"] = "ready" if story_paragraphs else "failed"
            elif mode == "exercise":
                exercises = result if isinstance(result, list) else []
                section["exercises"] = exercises
                section["status"] = "ready" if exercises else "failed"
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
                    "style_key": idea.get("style_key", ""),
                    "topic": idea.get("topic", ""),
                    "context_summary": idea.get("context_summary", ""),
                    "mode_reason": idea.get("mode_reason", ""),
                    "generation_backend": self._resolve_generation_backend(idea),
                    "user_guide": self._extract_user_guide(idea),
                }
                for idea in ideas
            ],
            "rendered_sections": rendered_sections,
        }

        logger.info(
            f"IntegrationAgent: integrated {len(rendered_sections)} sections"
        )
        return course_content

    def _extract_user_guide(self, idea: dict) -> str:
        """Extract a user-facing guide from the detail_plan.

        Prefers the structured ``user_guide`` dict (new schema).
        Falls back to legacy field extraction for backward compatibility.
        """
        detail_plan = idea.get("detail_plan")
        if not isinstance(detail_plan, dict):
            return ""

        mode = idea.get("mode", "")

        # --- 优先使用结构化 user_guide 字段 ---
        guide = detail_plan.get("user_guide")
        if isinstance(guide, dict):
            if mode == "animation":
                return self._format_animation_guide(guide)
            elif mode == "game":
                return self._format_game_guide(guide)

        # --- Fallback: 从旧字段拼接（向下兼容） ---
        parts: list[str] = []

        if mode == "animation":
            persuasion = detail_plan.get("persuasion", {})
            if isinstance(persuasion, dict):
                claim = persuasion.get("learning_claim", "")
                evidence = persuasion.get("evidence", "")
                takeaway = persuasion.get("takeaway", "")
                if claim:
                    parts.append(f"核心要点: {claim}")
                if evidence:
                    parts.append(f"观察重点: {evidence}")
                if takeaway:
                    parts.append(f"学完后你能说出: {takeaway}")
            frames = detail_plan.get("frames", [])
            if isinstance(frames, list) and frames:
                narrations = []
                for f in frames:
                    if isinstance(f, dict):
                        n = f.get("narration", "")
                        d = f.get("description", "")
                        narrations.append(n or d)
                narrations = [n for n in narrations if n]
                if narrations:
                    parts.append("动画流程: " + " -> ".join(narrations))

        elif mode == "game":
            concept = detail_plan.get("game_concept", "")
            if concept:
                parts.append(f"学习目标: {concept}")
            mechanic_reason = detail_plan.get("mechanic_reason", "")
            if mechanic_reason:
                parts.append(f"玩法: {mechanic_reason}")
            flow = detail_plan.get("interaction_flow", [])
            if isinstance(flow, list) and flow:
                parts.append("操作步骤:")
                for i, step in enumerate(flow, 1):
                    if isinstance(step, str):
                        parts.append(f"  {i}. {step}")
            win = detail_plan.get("win_condition", "")
            if win:
                parts.append(f"通关条件: {win}")
            persuasion = detail_plan.get("persuasion", {})
            if isinstance(persuasion, dict):
                takeaway = persuasion.get("takeaway", "")
                if takeaway:
                    parts.append(f"完成后你能说出: {takeaway}")

        return "\n".join(parts)

    @staticmethod
    def _format_animation_guide(guide: dict) -> str:
        """Format structured animation user_guide to readable text."""
        parts: list[str] = []
        what = guide.get("what_it_shows", "")
        if what:
            parts.append(f"这个动画展示了: {what}")
        observe = guide.get("observe_points", [])
        if isinstance(observe, list) and observe:
            parts.append("观察重点:")
            for pt in observe:
                if isinstance(pt, str):
                    parts.append(f"  - {pt}")
        controls = guide.get("controls", "")
        if controls:
            parts.append(f"控制: {controls}")
        takeaway = guide.get("takeaway", "")
        if takeaway:
            parts.append(f"看完后你能回答: {takeaway}")
        return "\n".join(parts)

    @staticmethod
    def _format_game_guide(guide: dict) -> str:
        """Format structured game user_guide to readable text."""
        parts: list[str] = []
        goal = guide.get("goal", "")
        if goal:
            parts.append(f"目标: {goal}")
        controls = guide.get("controls", [])
        if isinstance(controls, list) and controls:
            parts.append("操作说明:")
            for ctrl in controls:
                if isinstance(ctrl, dict):
                    elem = ctrl.get("element", "")
                    action = ctrl.get("action", "")
                    parts.append(f"  - [{elem}] {action}")
        steps = guide.get("steps", [])
        if isinstance(steps, list) and steps:
            parts.append("操作步骤:")
            for i, step in enumerate(steps, 1):
                if isinstance(step, str):
                    parts.append(f"  {i}. {step}")
        win_cond = guide.get("win_condition", "")
        if win_cond:
            parts.append(f"通关条件: {win_cond}")
        tips = guide.get("tips", "")
        if tips:
            parts.append(f"提示: {tips}")
        return "\n".join(parts)

    def _resolve_generation_backend(self, idea: dict) -> str:
        """Resolve the media generation backend for an idea, if any."""
        if idea.get("generation_backend"):
            return str(idea["generation_backend"])
        detail_plan = idea.get("detail_plan") or {}
        if isinstance(detail_plan, dict) and detail_plan.get("generation_backend"):
            return str(detail_plan["generation_backend"])
        if idea.get("mode") == "animation":
            return "html_svg"
        return ""
