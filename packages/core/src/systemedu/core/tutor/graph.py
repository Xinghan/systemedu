"""Tutor main graph (spec 014 §7.6).

Phase 3 completion: wires the six built-in skill subgraphs under the
router. The edge topology is:

    START -> confirm_handler -> safety_gate
          -> memory_inject -> skill_router
          -> (conditional route_to_skill)
          -> skill:<name>      \\
             ...                } -> output_stream -> END
          -> output_stream     /

Safety short-circuit: when `_safety_triggered` is set, we jump from
safety_gate straight to output_stream, skipping memory + skill work.

Skill subgraph integration:
- Each `SkillLoader.list_all()` entry becomes a `skill:<name>` node.
- The node wraps the subgraph to translate between main TutorState
  and the skill's per-turn state (messages + memory + skill_state in,
  AIMessage + updated turn_count + skill_state out).
- `route_to_skill` reads `skill_decision` from the router:
    - `continue` with an active skill → that skill's node
    - `switch` with a valid target    → target skill's node
    - `exit` or anything unexpected   → output_stream directly
"""

from __future__ import annotations

from typing import Any, Callable

from langchain_core.messages import AIMessage, BaseMessage
from langgraph.graph import END, START, StateGraph

from systemedu.core.tutor.memory import MemoryInjector
from systemedu.core.tutor.nodes import (
    confirm_handler_node,
    make_memory_inject_node,
    output_stream_node,
    safety_gate_node,
)
from systemedu.core.tutor.nodes.skill_router import make_skill_router_node, skill_router_node
from systemedu.core.tutor.skills import SkillBase, SkillLoader
from systemedu.core.tutor.state import TutorState


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _after_safety(state: TutorState) -> str:
    """Safety gate short-circuits to output when `_safety_triggered`."""
    if state.get("_safety_triggered"):
        return "output_stream"
    return "memory_inject"


def _skill_node_name(skill_name: str) -> str:
    """LangGraph reserves `:` and `|` in node names — swap with `__`."""
    safe = skill_name.replace("-", "_")
    return f"skill__{safe}"


def _wrap_subgraph(skill: SkillBase, llm: Any) -> Callable[[TutorState], Any]:
    """Adapter: main TutorState -> skill subgraph state -> main TutorState.

    The skill's subgraph owns its own state schema, but it needs to see
    the conversation + memory and its carried `skill_state`. We pass
    those in, run the subgraph, and fold the resulting skill_state +
    any new AIMessages back into the main state.
    """
    # Pre-compile once. Skill subgraphs are pure — re-invocation is safe.
    compiled = skill.build_subgraph(llm, list(skill.config.tools or []))

    async def _node(state: TutorState) -> dict:
        # On a `switch`, the previous skill's private state should not
        # bleed into the new skill — otherwise its turn_count carries
        # over. Only carry `skill_state` forward when the router said
        # `continue` AND we were already the active skill.
        decision = state.get("skill_decision") or {}
        active = state.get("active_skill")
        carry = (
            decision.get("action") == "continue"
            and active == skill.config.name
        )
        skill_state_in = dict(state.get("skill_state") or {}) if carry else {}
        # Seed the subgraph with the main conversation's messages so the
        # skill's LLM prompt can see student input. We intentionally pass
        # the full list; the subgraph reducer (add_messages) only appends
        # its own AIMessage, not the whole conversation back to the main.
        sub_input: dict[str, Any] = {
            "messages": list(state.get("messages") or []),
            "memory": state.get("memory") or {},
            # Carry the skill's accumulated private state forward.
            **skill_state_in,
        }

        sub_out = await compiled.ainvoke(sub_input)

        # Extract the AIMessage(s) the skill appended (delta from what we
        # fed in) so we can merge them back into the main messages.
        prior_ids = {id(m) for m in (state.get("messages") or [])}
        new_msgs: list[BaseMessage] = []
        for m in sub_out.get("messages") or []:
            if id(m) in prior_ids:
                continue
            if isinstance(m, AIMessage):
                new_msgs.append(m)

        # Everything the skill wrote except `messages` is its private state.
        next_skill_state: dict[str, Any] = {
            k: v for k, v in sub_out.items() if k != "messages"
        }

        update: dict[str, Any] = {
            "active_skill": skill.config.name,
            "skill_turn_count": int(next_skill_state.get("turn_count") or 0),
            "skill_state": next_skill_state,
        }
        if new_msgs:
            update["messages"] = new_msgs
        return update

    return _node


def _route_to_skill(skill_names: set[str]) -> Callable[[TutorState], str]:
    """Build the conditional-edge function from skill_router's decision.

    Returns the skill's display name (e.g. "socratic-questioning") —
    the caller maps that via the `ends` dict to a real node name.
    """

    def _route(state: TutorState) -> str:
        decision = state.get("skill_decision") or {}
        action = decision.get("action")
        if action == "exit":
            return "__finish__"
        if action == "continue":
            target = state.get("active_skill")
        else:  # switch
            target = decision.get("target_skill")
        if not target or target not in skill_names:
            # Unknown/missing target → don't fan out, just finish the turn.
            return "__finish__"
        return target

    return _route


# ---------------------------------------------------------------------------
# build_tutor_graph
# ---------------------------------------------------------------------------
def build_tutor_graph(
    *,
    checkpointer=None,
    memory_injector: MemoryInjector | None = None,
    loader: SkillLoader | None = None,
    llm: Any | None = None,
):
    """Compile the tutor graph.

    Args:
        checkpointer: LangGraph checkpointer (e.g. AsyncSqliteSaver).
            Optional — if omitted, the graph compiles without persistence.
        memory_injector: `MemoryInjector` instance used by the
            `memory_inject` node. If `None`, the node returns an empty
            snapshot (smoke-test behaviour).
        loader: `SkillLoader` providing teaching skills. When provided
            together with `llm`, each skill is registered as a
            `skill:<name>` node and the router's decision fans out to
            them. When `None`, `skill_router` collapses directly to
            `output_stream` (Phase-1 smoke test compat).
        llm: LLM handed to both the router and every skill's subgraph.

    Returns:
        A compiled LangGraph app ready for `ainvoke` / `astream_events`.
    """
    g = StateGraph(TutorState)

    g.add_node("confirm_handler", confirm_handler_node)
    g.add_node("safety_gate", safety_gate_node)
    g.add_node("memory_inject", make_memory_inject_node(memory_injector))

    if loader is not None and llm is not None:
        router = make_skill_router_node(loader=loader, llm=llm)
        skills = loader.list_all()
    else:
        router = skill_router_node
        skills = []

    g.add_node("skill_router", router)
    g.add_node("output_stream", output_stream_node)

    g.add_edge(START, "confirm_handler")
    g.add_edge("confirm_handler", "safety_gate")
    g.add_conditional_edges(
        "safety_gate",
        _after_safety,
        {"output_stream": "output_stream", "memory_inject": "memory_inject"},
    )
    g.add_edge("memory_inject", "skill_router")

    if skills:
        skill_names = {s.config.name for s in skills}
        skill_name_to_node = {s.config.name: _skill_node_name(s.config.name) for s in skills}

        for s in skills:
            g.add_node(_skill_node_name(s.config.name), _wrap_subgraph(s, llm))
            g.add_edge(_skill_node_name(s.config.name), "output_stream")

        g.add_conditional_edges(
            "skill_router",
            _route_to_skill(skill_names),
            {
                "__finish__": "output_stream",
                **skill_name_to_node,
            },
        )
    else:
        # No skills loaded: collapse straight through.
        g.add_edge("skill_router", "output_stream")

    g.add_edge("output_stream", END)

    if checkpointer is not None:
        return g.compile(checkpointer=checkpointer)
    return g.compile()


__all__ = ["build_tutor_graph"]
