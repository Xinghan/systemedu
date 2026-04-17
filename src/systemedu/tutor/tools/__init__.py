"""Tutor LLM tools (spec 014 §8).

Tools are LangChain-compatible callables decorated with `@tutor_tool`.
The decorator pulls session/user context from a ContextVar (populated
by the main graph before the skill subgraph runs), so LLM-supplied
`user_id` arguments are ignored — the authenticated user always wins.
"""

from __future__ import annotations

from .decorator import (
    ToolContext,
    ToolMeta,
    current_tool_context,
    get_tool_meta,
    get_tool_raw_fn,
    push_tool_context,
    require_tool_context,
    tutor_tool,
)
from .registry import ToolRegistry

__all__ = [
    "ToolContext",
    "ToolMeta",
    "ToolRegistry",
    "current_tool_context",
    "get_tool_meta",
    "get_tool_raw_fn",
    "push_tool_context",
    "require_tool_context",
    "tutor_tool",
]
