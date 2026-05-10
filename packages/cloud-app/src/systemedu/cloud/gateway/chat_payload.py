"""Chat endpoint payload validation (spec 014 T5.1).

Enforces the 2-context model:
- `context_scope=project`: `project_name` required, knode_id optional
- `context_scope=global`: `project_name` and `knode_id` must be absent

`user_id` is always overridden by the authenticated session — the
field is present in the model so existing clients don't break, but
`resolve_user_id()` ignores it.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, model_validator


class ChatPayload(BaseModel):
    """Validated chat request body."""

    message: str
    session_id: str | None = None
    # 2-context scope
    context_scope: Literal["project", "global"] = "project"
    project_name: str | None = None
    # Aliases for backward compat: "project" key used by old frontend
    project: str | None = None
    knode_id: str | None = None
    exercise_id: str | None = None
    # Legacy fields (still accepted, user_id always overridden)
    user_id: str = "default"
    agent: str | None = None
    node_id: int | None = None
    active_tab: str | None = None
    page_index: int | None = None
    # Confirm response metadata (optional)
    confirm_response: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _normalize_and_validate(self) -> "ChatPayload":
        # Merge legacy "project" alias
        if self.project and not self.project_name:
            self.project_name = self.project
        # Merge legacy "node_id" alias
        if self.node_id is not None and not self.knode_id:
            self.knode_id = str(self.node_id)

        if self.context_scope == "project":
            if not self.project_name:
                raise ValueError(
                    "context_scope='project' requires project_name"
                )
        elif self.context_scope == "global":
            if self.project_name:
                raise ValueError(
                    "context_scope='global' conflicts with project_name — "
                    "set project_name=null for global scope"
                )
            if self.knode_id:
                raise ValueError(
                    "context_scope='global' conflicts with knode_id"
                )
        return self

    def thread_id(self, user_id: str) -> str:
        """Build the LangGraph thread_id per context-matrix.md section 5."""
        if self.context_scope == "project":
            return f"{user_id}:{self.project_name}:project-main"
        return f"{user_id}:global"


__all__ = ["ChatPayload"]
