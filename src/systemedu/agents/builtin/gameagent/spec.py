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
    mechanic: Literal["drag_sort", "match_pairs", "simulation", "label_map"]
    topic: str
    theme: str
    difficulty: int = Field(ge=1, le=10)
    entities: list[dict]
    rules: GameRules = Field(default_factory=GameRules)
    levels: list[GameLevel] = Field(default_factory=list)
    feedback: GameFeedback = Field(default_factory=GameFeedback)
    # mechanic-specific extra fields
    categories: list[dict] | None = None      # drag_sort
    target_condition: str | None = None        # simulation
    visual_description: str | None = None      # simulation
    scene_description: str | None = None       # label_map
