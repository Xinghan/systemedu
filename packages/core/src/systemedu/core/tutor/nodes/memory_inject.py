"""Memory injection node (spec 014 T2.7).

Wraps `MemoryInjector.inject(...)` into a LangGraph node. The injector
itself is passed in at graph-build time so the node stays a pure
`async state -> dict` function — exactly what LangGraph expects.

Scope derivation:
- gateway may already put `context_scope` into state (T5.1 payload)
- otherwise we default to `project` when `project_name` is set, else
  `global`. `MemoryInjector.inject` also safety-downgrades a project
  scope with no project_name to global, so a misrouted state never
  leaks project-shaped but empty memory.

If no injector was wired in (e.g. smoke-test graph, Phase 1 tests),
the node short-circuits with an empty snapshot instead of crashing.
"""

from __future__ import annotations

from datetime import datetime
from typing import Callable

from langchain_core.messages import HumanMessage

from systemedu.core.tutor.memory import ContextScope, MemoryInjector
from systemedu.core.tutor.state import MemorySnapshot, TutorState


def _last_user_message(state: TutorState) -> str:
    msgs = state.get("messages") or []
    for m in reversed(msgs):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
        content = getattr(m, "content", None)
        role = getattr(m, "type", None) or getattr(m, "role", None)
        if role in {"human", "user"} and isinstance(content, str):
            return content
    return ""


def _resolve_scope(state: TutorState) -> ContextScope:
    raw = state.get("active_tab")
    if raw in {"project", "global"}:
        return raw  # type: ignore[return-value]
    return "project" if state.get("project_name") else "global"


def make_memory_inject_node(
    injector: MemoryInjector | None,
) -> Callable[[TutorState], "dict"]:
    """Return an async node closed over the configured injector.

    Passing `None` yields a node that returns an empty snapshot — useful
    for Phase 1 smoke tests where no DB / Mem0 is wired up.
    """

    async def _node(state: TutorState) -> dict:
        if injector is None:
            return {
                "memory": MemorySnapshot(
                    l1_profile="",
                    l2_project_ctx="",
                    l3_knode_state="",
                    l4_semantic_recall=[],
                    l5_skill_ctx="",
                    injected_at=datetime.utcnow(),
                ),
            }

        snapshot = await injector.inject(
            user_id=state["user_id"],
            project_name=state.get("project_name"),
            knode_id=state.get("knode_id"),
            last_user_msg=_last_user_message(state),
            active_skill_state=state.get("skill_state") or None,
            context_scope=_resolve_scope(state),
            active_tab=state.get("active_tab"),
        )
        return {"memory": snapshot}

    return _node


async def memory_inject_node(state: TutorState) -> dict:
    """Phase-1 compatibility shim — empty snapshot.

    Kept so the default graph (no injector wired) keeps compiling.
    Downstream code should call `make_memory_inject_node(injector)`.
    """
    return await make_memory_inject_node(None)(state)


__all__ = ["memory_inject_node", "make_memory_inject_node"]
