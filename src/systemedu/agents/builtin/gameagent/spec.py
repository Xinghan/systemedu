"""GameSpec Pydantic models for structured game generation."""

from typing import Literal

from pydantic import BaseModel, Field


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


class GameSpec(BaseModel):
    mechanic: Literal["drag_sort", "match_pairs", "simulation", "label_map", "timeline_order", "boss_quiz"]
    topic: str
    theme: str
    difficulty: int = Field(ge=1, le=10)
    entities: list[dict]
    rules: GameRules = Field(default_factory=GameRules)
    levels: list[GameLevel] = Field(default_factory=list)
    feedback: GameFeedback = Field(default_factory=GameFeedback)
    # visual skin fields (V2)
    color_theme: str | None = None          # hex accent color, e.g. "#6366F1"
    bg_gradient: list[str] | None = None    # [from_color, to_color]
    # mechanic-specific extra fields
    categories: list[dict] | None = None      # drag_sort
    target_condition: str | None = None        # simulation
    visual_description: str | None = None      # simulation
    scene_description: str | None = None       # label_map
    # timeline_order
    ordered_items: list[dict] | None = None    # [{id, label, emoji, year, description}]
    # boss_quiz
    boss_name: str | None = None
    boss_emoji: str | None = None
    questions: list[dict] | None = None        # [{id, question, options:[str], correct:int, explanation}]
