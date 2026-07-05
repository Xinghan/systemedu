"""@tutor_tool decorator + ContextVar plumbing (spec 014 T4.1).

Design §8.2 pillar 3: the authenticated `user_id` comes from the
gateway session, not from the LLM. To enforce that without threading
state through every tool call, we stash a `ToolContext` in a
ContextVar before the skill subgraph runs. The decorator then:

1. overrides any LLM-supplied `user_id` / `session_id` with the
   ContextVar's value (defence in depth — the tool also refuses to
   run when the ContextVar is missing);
2. logs each invocation to ToolCallLog (T4.4 hook — the helper is
   optional right now so decorator tests don't need a DB).

The decorator returns a LangChain `BaseTool` so the result plugs
straight into `llm.bind_tools(...)`.

Confirmation of write-class tools (spec 043 T1.9/1C) is owned by the
official `HumanInTheLoopMiddleware` in `build_agent_subgraph`, which
interrupts the graph *before* a write tool runs and resumes on the
student's decision. The decorator no longer carries its own
`confirm=True` short-circuit — the two mechanisms collided (the
short-circuit would swallow the call even after the middleware
approved it). Write intent is still declared via `access="write"`,
which is what the middleware selects on.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import inspect
import logging
import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Iterator, Literal

from langchain_core.tools import BaseTool, StructuredTool

log = logging.getLogger(__name__)


Access = Literal["read", "write"]
Scope = Literal["user_self", "project", "global"]


# ---------------------------------------------------------------------------
# Context / Meta types
# ---------------------------------------------------------------------------
@dataclass
class ToolContext:
    """Per-call state injected by the main graph.

    Every field except `user_id` is optional so tests can build a
    minimal context without wiring a full session.
    """

    user_id: str
    session_id: str | None = None
    active_skill: str | None = None
    project_name: str | None = None
    knode_id: str | None = None
    # Optional hook so the decorator can write audit rows. Wired by
    # T4.4. Signature: `(record: dict) -> None`.
    log_sink: Callable[[dict[str, Any]], Any] | None = None
    # DB session factory for tools that query business tables directly.
    # Legacy path (cloud-app schema) — prefer `data` below.
    db: Callable[[], Any] | None = None
    # spec 043 P1 (direction A): abstract data-access provider the host
    # app injects. Tools call `ctx.data.*` so they don't hard-depend on
    # any one storage schema. Typed as Any here to avoid importing the
    # protocol into this low-level module; see tools/data_provider.py.
    data: Any | None = None


@dataclass
class ToolMeta:
    """Declarative metadata attached to each `@tutor_tool` function."""

    name: str
    access: Access = "read"
    scope: Scope = "user_self"
    description: str = ""
    # Arguments the LLM is not allowed to supply — will be overridden
    # by the ContextVar regardless of what the LLM sends.
    reserved_args: tuple[str, ...] = field(default_factory=lambda: ("user_id", "session_id"))


# Side tables indexed by id(tool_obj) — StructuredTool is a pydantic
# model with extra='forbid', so we can't attach arbitrary attributes.
_TOOL_META: dict[int, ToolMeta] = {}
_TOOL_RAW_FN: dict[int, Callable[..., Awaitable[Any]]] = {}


def get_tool_meta(tool: BaseTool) -> ToolMeta | None:
    """Return the `ToolMeta` attached by `@tutor_tool`, or None."""
    return _TOOL_META.get(id(tool))


def get_tool_raw_fn(tool: BaseTool) -> Callable[..., Awaitable[Any]] | None:
    """Return the underlying async fn before decoration (for tests)."""
    return _TOOL_RAW_FN.get(id(tool))


# ---------------------------------------------------------------------------
# ContextVar plumbing
# ---------------------------------------------------------------------------
_tool_context: ContextVar[ToolContext | None] = ContextVar(
    "systemedu_tool_context", default=None
)


def current_tool_context() -> ToolContext | None:
    """Return the active `ToolContext` or None when unset."""
    return _tool_context.get()


def require_tool_context() -> ToolContext:
    ctx = _tool_context.get()
    if ctx is None:
        raise RuntimeError(
            "tutor_tool invoked outside push_tool_context — main graph "
            "must wrap every skill subgraph with push_tool_context(...)."
        )
    return ctx


@contextlib.contextmanager
def push_tool_context(ctx: ToolContext) -> Iterator[ToolContext]:
    """Install `ctx` as the active context for the scope of the `with`."""
    token = _tool_context.set(ctx)
    try:
        yield ctx
    finally:
        _tool_context.reset(token)


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------
def _strip_reserved(kwargs: dict[str, Any], reserved: tuple[str, ...]) -> None:
    """Drop reserved kwargs in-place. LLM has no business filling them."""
    for name in reserved:
        kwargs.pop(name, None)


def _log_safely(ctx: ToolContext, record: dict[str, Any]) -> None:
    """Fire the audit sink but never raise out of tool execution."""
    sink = ctx.log_sink
    if sink is None:
        return
    try:
        result = sink(record)
        if inspect.isawaitable(result):
            # Run to completion without blocking the caller longer than
            # needed. We're already in an async tool; schedule and await.
            asyncio.ensure_future(result)  # noqa: RUF006
    except Exception:  # noqa: BLE001
        log.exception("tool_call_log sink failed for %s", record.get("tool_name"))


def tutor_tool(
    *,
    access: Access = "read",
    scope: Scope = "user_self",
    name: str | None = None,
    description: str | None = None,
    reserved_args: tuple[str, ...] = ("user_id", "session_id"),
) -> Callable[[Callable[..., Awaitable[Any]]], BaseTool]:
    """Decorate an async function to turn it into a tutor tool.

    Usage:

        @tutor_tool(access="read", scope="user_self")
        async def get_progress(project_name: str) -> dict:
            ctx = require_tool_context()
            ...

    The resulting object is a `langchain_core.tools.BaseTool` and can
    be passed to `llm.bind_tools`, or to `SkillBase.build_subgraph`.

    `access="write"` declares a mutating tool. Confirmation of write
    tools is enforced upstream by `HumanInTheLoopMiddleware` (the graph
    pauses before the tool runs); the decorator itself no longer
    short-circuits on confirmation.
    """

    def _decorate(fn: Callable[..., Awaitable[Any]]) -> BaseTool:
        if not inspect.iscoroutinefunction(fn):
            raise TypeError(
                f"@tutor_tool target '{fn.__name__}' must be an async function"
            )

        tool_name = name or fn.__name__
        meta = ToolMeta(
            name=tool_name,
            access=access,
            scope=scope,
            description=description or (fn.__doc__ or "").strip().split("\n", 1)[0],
            reserved_args=reserved_args,
        )

        @functools.wraps(fn)
        async def _runner(**kwargs: Any) -> Any:
            ctx = require_tool_context()
            # Pillar 3: LLM-supplied user_id / session_id are discarded.
            _strip_reserved(kwargs, meta.reserved_args)

            started = time.perf_counter()
            error: str | None = None
            result: Any = None
            try:
                result = await fn(**kwargs)
                return result
            except Exception as e:  # noqa: BLE001
                error = f"{type(e).__name__}: {e}"
                raise
            finally:
                latency_ms = int((time.perf_counter() - started) * 1000)
                _log_safely(
                    ctx,
                    {
                        "tool_name": meta.name,
                        "user_id": ctx.user_id,
                        "session_id": ctx.session_id,
                        "active_skill": ctx.active_skill,
                        "args": dict(kwargs),
                        "result": result if error is None else None,
                        # If a write tool's body ran, HITL already approved it
                        # upstream; read tools have no approval concept.
                        "approved": True if meta.access == "write" else None,
                        "latency_ms": latency_ms,
                        "error": error,
                    },
                )

        # Preserve the original signature so LangChain builds an args
        # schema matching the function's own parameters (not **kwargs).
        try:
            _runner.__signature__ = inspect.signature(fn)  # type: ignore[attr-defined]
        except (TypeError, ValueError):
            pass

        tool_obj: BaseTool = StructuredTool.from_function(
            coroutine=_runner,
            name=meta.name,
            description=meta.description or meta.name,
        )
        # StructuredTool is a Pydantic model with extra='forbid' — use the
        # side registry so `tool.meta` / `tool.raw_fn` still work from
        # callers without touching the model itself.
        _TOOL_META[id(tool_obj)] = meta
        _TOOL_RAW_FN[id(tool_obj)] = fn
        return tool_obj

    return _decorate


__all__ = [
    "Access",
    "Scope",
    "ToolContext",
    "ToolMeta",
    "current_tool_context",
    "get_tool_meta",
    "get_tool_raw_fn",
    "require_tool_context",
    "push_tool_context",
    "tutor_tool",
]
