"""GameGenAgent — wraps the existing GameSpec pipeline for CourseContent generation."""

import logging

from systemedu.agents.builtin.media_art_direction import (
    KATEX_PROMPT_HINT,
    inject_game_style_overrides,
    inject_katex_if_needed,
    style_kit_prompt_block,
)

logger = logging.getLogger(__name__)


class GameGenAgent:
    """Generates interactive game HTML by wrapping GameSpecPlannerAgent + GameCompiler.

    Uses the detail_plan from CourseIdeaDetailAgent (game mode) as additional context
    to guide the GameSpec planner.
    """

    def __init__(self, llm):
        self.llm = llm

    async def generate(
        self,
        detail_plan: dict,
        node_title: str,
        node_summary: str,
        difficulty: int,
    ) -> str:
        """Generate game HTML from a game detail_plan.

        Returns HTML string, or empty string on failure.
        """
        from systemedu.agents.builtin.gameagent.compiler import GameCompiler
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        game_mechanic = detail_plan.get("game_mechanic", "")
        game_concept = detail_plan.get("game_concept", node_summary)
        game_title = detail_plan.get("game_title", node_title)
        interaction_flow = detail_plan.get("interaction_flow", [])
        visual_storyboard = detail_plan.get("visual_storyboard", [])
        visual_focus = detail_plan.get("visual_focus", "")
        style_key = detail_plan.get("style_key")

        # Build enhanced context for the planner
        enhanced_summary = game_concept
        if interaction_flow:
            flow_text = "；".join(interaction_flow[:3])
            enhanced_summary = f"{game_concept}。互动流程：{flow_text}"
        if visual_storyboard:
            storyboard_text = "；".join(str(step) for step in visual_storyboard[:3])
            enhanced_summary = f"{enhanced_summary}。画面分镜：{storyboard_text}"
        if visual_focus:
            enhanced_summary = f"{enhanced_summary}。视觉焦点：{visual_focus}"
        enhanced_summary = (
            f"{enhanced_summary}\n\n"
            f"以下为必须遵守的视觉风格：\n{style_kit_prompt_block(mode='game', preferred_key=style_key)}\n\n"
            f"{KATEX_PROMPT_HINT}"
        )

        # 强制使用 simulation 模式
        lab_strategy: dict = {"game_mechanic": "simulation"}

        try:
            planner = GameSpecPlannerAgent(llm=self.llm)
            spec = await planner.plan(
                node_title=game_title or node_title,
                node_summary=enhanced_summary,
                difficulty=difficulty,
                lab_strategy=lab_strategy,
            )
            if spec is None:
                logger.warning(
                    f"GameGenAgent: GameSpecPlannerAgent returned None for '{node_title}'"
                )
                return ""

            # Fill optional visual skin fields for downstream templates/runtime.
            if hasattr(spec, "color_theme"):
                spec.color_theme = style_key or "concept_lab_clean"
            if hasattr(spec, "bg_gradient"):
                spec.bg_gradient = ["#eef2ff", "#ffffff"]

            html = GameCompiler().compile(spec)
            html = inject_game_style_overrides(html, style_key=style_key)
            html = inject_katex_if_needed(html)
            logger.info(
                f"GameGenAgent: generated {len(html)} chars for '{node_title}'"
            )
            return html

        except Exception:
            logger.exception(f"GameGenAgent: unexpected error for '{node_title}'")
            return ""
