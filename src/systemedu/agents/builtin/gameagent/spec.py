"""GameSpec Pydantic models for structured game generation."""

from typing import Literal

from pydantic import BaseModel, Field

from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec


class GameRules(BaseModel):
    correct_points: int = 10
    max_mistakes: int = 3
    hint_after_sec: int = 8


class GameLevel(BaseModel):
    prompt: str


class GameFeedback(BaseModel):
    correct_text: str = "太棒了！"
    wrong_text: str = "再试一次！"
    complete_text: str = "恭喜你完成了！"


class SimulationSceneJS(BaseModel):
    """LLM-generated JS code fragments for a simulation scene.

    static_svg: SVG markup injected as innerHTML of #scene-static (axes, labels, background).
    dynamic_fn: JavaScript function body (no `function` keyword).
                Receives three named params: p (params object), progress (0-1), entities (array).
                Must return an SVG string for #scene-dynamic innerHTML.
    """
    static_svg: str = ""
    dynamic_fn: str = ""


class FreeSimulationHTML(BaseModel):
    """LLM-generated standalone HTML for free_simulation mechanic."""
    html: str = ""
    design_idea: str = ""


class GameSpec(BaseModel):
    mechanic: Literal["drag_sort", "match_pairs", "simulation", "label_map", "timeline_order", "boss_quiz", "free_simulation"]
    topic: str
    theme: str
    difficulty: int = Field(ge=1, le=10)
    entities: list[dict]
    rules: GameRules = Field(default_factory=GameRules)
    levels: list[GameLevel] = Field(default_factory=list)
    feedback: GameFeedback = Field(default_factory=GameFeedback)
    # visual skin fields
    color_theme: str | None = None
    bg_gradient: list[str] | None = None
    # mechanic-specific extra fields
    categories: list[dict] | None = None      # drag_sort
    target_condition: str | None = None        # simulation
    visual_description: str | None = None      # simulation
    scene_description: str | None = None       # label_map (legacy, kept for compat)
    scene_type: str | None = None              # label_map (legacy, kept for compat)
    # V2: structured object spec (label_map + simulation)
    object_spec: ObjectSpec | None = None      # LLM picks object_key + label_part_ids
    # timeline_order
    ordered_items: list[dict] | None = None    # [{id, label, emoji, year, description}]
    # boss_quiz
    boss_name: str | None = None
    boss_emoji: str | None = None
    questions: list[dict] | None = None        # [{id, question, options:[str], correct:int, explanation}]
    # simulation: LLM-generated JS scene code (overrides hardcoded SCENES in template)
    scene_js: SimulationSceneJS | None = None
    # free_simulation: LLM-generated standalone HTML (Canvas/SVG, self-contained)
    free_html: FreeSimulationHTML | None = None
    # scientific model constraints injected at planning time (stored for reference)
    scientific_model: dict | None = None
