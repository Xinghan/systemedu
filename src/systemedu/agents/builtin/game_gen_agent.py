"""GameGenAgent — wraps the existing GameSpec pipeline for CourseContent generation."""

import logging

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

        # Build enhanced context for the planner
        enhanced_summary = game_concept
        if interaction_flow:
            flow_text = "；".join(interaction_flow[:3])
            enhanced_summary = f"{game_concept}。互动流程：{flow_text}"

        # Build override hints dict for the planner
        extra_hints: dict = {}
        if game_mechanic:
            extra_hints["preferred_mechanic"] = game_mechanic

        try:
            planner = GameSpecPlannerAgent(llm=self.llm)
            spec = await planner.plan(
                node_title=game_title or node_title,
                node_summary=enhanced_summary,
                difficulty=difficulty,
                extra_hints=extra_hints,
            )
            if spec is None:
                logger.warning(
                    f"GameGenAgent: GameSpecPlannerAgent returned None for '{node_title}'"
                )
                return ""

            html = GameCompiler().compile(spec)
            logger.info(
                f"GameGenAgent: generated {len(html)} chars for '{node_title}'"
            )
            return html

        except Exception:
            logger.exception(f"GameGenAgent: unexpected error for '{node_title}'")
            return ""
