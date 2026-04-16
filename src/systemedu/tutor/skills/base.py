"""SkillBase ABC + SkillConfig (spec 014 T3.1, design §7.1).

A skill is a named teaching strategy (socratic / direct-instruction /
scaffolding / ...). Each one contributes:

- a frontmatter-parsed `SkillConfig` (name, triggers, tool whitelist, ...)
- a compiled LangGraph subgraph via `build_subgraph(llm, tools)`
- an optional L5 text formatter via `summarize_state(skill_state)`

The router picks the active skill; the subgraph runs inside a
`skill:<name>` node wrapped by the main graph. Tools get pre-filtered
by the skill's whitelist before being handed to the subgraph.

Pydantic (not dataclass) so `max_turns` / `priority` bounds are
enforced and SKILL.md frontmatter parses cleanly with aliasing later.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SkillConfig(BaseModel):
    """Frontmatter-backed config for a single skill."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1, description="Stable skill identifier")
    description: str = Field(..., min_length=1)
    triggers: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    max_turns: int = Field(default=5, ge=1, le=20)
    priority: int = Field(default=50, ge=0, le=100)
    body: str = Field(default="", description="Markdown body after frontmatter")
    path: Path | None = Field(default=None, description="Source SKILL.md path")


class SkillBase(ABC):
    """Abstract parent for every skill.

    Subclasses must implement `build_subgraph(llm, tools)` returning a
    compiled LangGraph. `summarize_state` has a safe default so simple
    skills don't have to override it — override when L5 needs more
    than `(turn_count, last_step)`.
    """

    def __init__(self, config: SkillConfig):
        self.config = config

    @abstractmethod
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        """Return a compiled LangGraph subgraph."""
        raise NotImplementedError

    def summarize_state(self, skill_state: dict[str, Any]) -> str:
        """Render the L5 memory-snapshot text for this skill.

        Default: `"- 当前策略: {name} (turn {n})"` plus an optional
        `summary` or `last_step` hint if the subgraph wrote one.
        """
        name = self.config.name
        turn = skill_state.get("turn_count", 0)
        summary = skill_state.get("summary") or skill_state.get("last_step")
        lines = [f"- 当前策略: {name} (turn {turn})"]
        if summary:
            lines.append(f"- 进展: {summary}")
        return "\n".join(lines)

    @property
    def name(self) -> str:
        return self.config.name


__all__ = ["SkillConfig", "SkillBase"]
