"""Tutor LLM tools (spec 014 §8).

Tools are LangChain-compatible callables decorated with `@tutor_tool`.
The decorator pulls session/user context from a ContextVar (populated
by the main graph before the skill subgraph runs), so LLM-supplied
`user_id` arguments are ignored — the authenticated user always wins.
"""

from __future__ import annotations

from langchain_core.tools import BaseTool

from .binding import bind_tutor_tools, is_dashscope_llm, tutor_tool_bind_kwargs
from .data_provider import TutorDataProvider
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


def all_builtin_tools() -> list[BaseTool]:
    """Return every built-in `@tutor_tool` object.

    Importing the tool modules materialises the decorated tool objects
    (module-level singletons). We collect them here so callers get a
    stable list without importing each module by hand.
    """
    from . import memory, meta, practice, progress

    return [
        memory.search_student_facts,
        memory.search_memory,
        progress.get_progress,
        progress.complete_node,
        progress.get_knode_prerequisites,
        progress.get_knode_content,
        practice.get_practice_exercises,
        practice.grade_submission,
        meta.escalate_to_human,
    ]


def build_default_registry() -> ToolRegistry:
    """Build a `ToolRegistry` populated with all built-in tutor tools."""
    reg = ToolRegistry()
    reg.register_many(all_builtin_tools())
    return reg


__all__ = [
    "ToolContext",
    "ToolMeta",
    "ToolRegistry",
    "TutorDataProvider",
    "all_builtin_tools",
    "bind_tutor_tools",
    "build_default_registry",
    "current_tool_context",
    "is_dashscope_llm",
    "tutor_tool_bind_kwargs",
    "get_tool_meta",
    "get_tool_raw_fn",
    "push_tool_context",
    "require_tool_context",
    "tutor_tool",
]
