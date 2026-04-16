"""Tutor main graph skeleton (spec 014 §7.6, Phase 1 baseline).

Wires 5 no-op nodes so downstream phases can slot in real logic.

Edge topology:
    START -> confirm_handler -> safety_gate -> memory_inject
          -> skill_router -> output_stream -> END

Safety short-circuit (inactive in Phase 1 because safety_gate returns
empty): when `_safety_triggered` is set, we jump from safety_gate
straight to output_stream. Skill subgraph fan-out (§7.6) lands in
Phase 3; Phase 1 collapses skill_router -> output_stream directly.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from systemedu.tutor.nodes import (
    confirm_handler_node,
    memory_inject_node,
    output_stream_node,
    safety_gate_node,
    skill_router_node,
)
from systemedu.tutor.state import TutorState


def _after_safety(state: TutorState) -> str:
    """Safety gate short-circuits to output when `_safety_triggered`."""
    if state.get("_safety_triggered"):
        return "output_stream"
    return "memory_inject"


def build_tutor_graph(*, checkpointer=None):
    """Compile the Phase-1 tutor skeleton.

    Args:
        checkpointer: LangGraph checkpointer (e.g. AsyncSqliteSaver).
            Optional — if omitted, the graph compiles without persistence.

    Returns:
        A compiled LangGraph app ready for `ainvoke` / `astream_events`.
    """
    g = StateGraph(TutorState)

    g.add_node("confirm_handler", confirm_handler_node)
    g.add_node("safety_gate", safety_gate_node)
    g.add_node("memory_inject", memory_inject_node)
    g.add_node("skill_router", skill_router_node)
    g.add_node("output_stream", output_stream_node)

    g.add_edge(START, "confirm_handler")
    g.add_edge("confirm_handler", "safety_gate")
    g.add_conditional_edges(
        "safety_gate",
        _after_safety,
        {"output_stream": "output_stream", "memory_inject": "memory_inject"},
    )
    g.add_edge("memory_inject", "skill_router")
    # Phase 1: skill subgraphs not yet loaded; collapse straight to output.
    g.add_edge("skill_router", "output_stream")
    g.add_edge("output_stream", END)

    if checkpointer is not None:
        return g.compile(checkpointer=checkpointer)
    return g.compile()


__all__ = ["build_tutor_graph"]
