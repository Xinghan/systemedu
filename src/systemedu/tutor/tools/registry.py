"""ToolRegistry + whitelist filter (spec 014 T4.2).

Design §8.2 pillar 1: each skill declares `tools: [...]` in its
SKILL.md. The main graph, before building a skill's subgraph, asks
the registry for the intersection with the skill's whitelist. Tools
the skill didn't declare never reach the LLM's bind_tools call, so
the LLM literally cannot call them.

The registry is intentionally tiny — a `register(tool)` that keys by
the tool's `meta.name` plus a `filter_by_whitelist(names)` that returns
the matching subset in whitelist order.
"""

from __future__ import annotations

import logging
from typing import Iterable

from langchain_core.tools import BaseTool

from .decorator import ToolMeta, get_tool_meta

log = logging.getLogger(__name__)


class ToolRegistry:
    """Central registry of all tutor tools."""

    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------
    def register(self, tool: BaseTool) -> None:
        """Register a `@tutor_tool`-decorated tool.

        Raises TypeError if the object is missing the `ToolMeta` our
        decorator attaches — this catches raw LangChain tools slipping
        in without the audit + confirm guarantees.
        """
        meta = get_tool_meta(tool)
        if not isinstance(meta, ToolMeta):
            raise TypeError(
                f"{tool.name!r} is not a @tutor_tool — refusing to register"
            )
        if meta.name in self._tools:
            log.warning("ToolRegistry: %s already registered; overwriting", meta.name)
        self._tools[meta.name] = tool

    def register_many(self, tools: Iterable[BaseTool]) -> None:
        for t in tools:
            self.register(t)

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------
    def get(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def all(self) -> list[BaseTool]:
        return list(self._tools.values())

    def names(self) -> list[str]:
        return list(self._tools.keys())

    # ------------------------------------------------------------------
    # Whitelist filter
    # ------------------------------------------------------------------
    def filter_by_whitelist(self, names: Iterable[str] | None) -> list[BaseTool]:
        """Return only the tools whose names appear in `names`.

        - `None` or empty → empty list (the skill forgot to declare
          tools, so it gets none). This is strictly safer than a
          "default to all" behaviour.
        - Unknown names are silently dropped with a warning so a typo in
          SKILL.md can't crash graph compilation.
        """
        if not names:
            return []
        out: list[BaseTool] = []
        for n in names:
            tool = self._tools.get(n)
            if tool is None:
                log.warning("ToolRegistry: skill whitelisted unknown tool %r", n)
                continue
            out.append(tool)
        return out


__all__ = ["ToolRegistry"]
