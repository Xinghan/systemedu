"""Tutor graph lifecycle for the gateway (spec 014 T5.2).

Builds and holds the tutor graph instance, translating gateway requests
into `graph.ainvoke()` / `graph.astream_events()` calls.

The graph is built once on first use and cached.
The LLM, SkillLoader, Checkpointer, and ToolRegistry are wired in
from the application config.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage

from systemedu.gateway.chat_payload import ChatPayload
from systemedu.tutor.state import TutorState

log = logging.getLogger(__name__)

_graph = None
_checkpointer = None
_checkpointer_cm = None  # must keep the context-manager alive to prevent GC


def _skills_root() -> Path:
    """Built-in skills live in the package tree."""
    return Path(__file__).resolve().parents[1] / "tutor" / "skills"


async def _get_graph():
    """Build or return the cached tutor graph."""
    global _graph, _checkpointer, _checkpointer_cm

    if _graph is not None:
        return _graph

    from systemedu.core.config import get_config
    from systemedu.core.llm_client import get_llm
    from systemedu.tutor.checkpoint import get_checkpointer
    from systemedu.tutor.graph import build_tutor_graph
    from systemedu.tutor.skills import SkillLoader

    cfg = get_config()
    tutor_cfg = cfg.tutor

    # LLM
    try:
        llm = get_llm()
    except Exception:
        log.warning("tutor_runner: LLM not configured; graph will run without skills")
        llm = None

    # Skills
    loader = SkillLoader([_skills_root()])
    loader.scan()
    log.info("tutor_runner: loaded %d skills", len(loader.list_all()))

    # Checkpointer (stays open for the process lifetime).
    # We must hold a reference to the context-manager object itself;
    # otherwise GC will finalize the generator and close the underlying
    # aiosqlite connection.
    _checkpointer_cm = get_checkpointer(tutor_cfg)
    _checkpointer = await _checkpointer_cm.__aenter__()

    _graph = build_tutor_graph(
        loader=loader,
        llm=llm,
        checkpointer=_checkpointer,
    )
    return _graph


async def shutdown():
    """Close the checkpointer on gateway shutdown."""
    global _checkpointer, _checkpointer_cm
    if _checkpointer_cm is not None:
        await _checkpointer_cm.__aexit__(None, None, None)
        _checkpointer_cm = None
        _checkpointer = None


def _build_input(payload: ChatPayload, user_id: str) -> dict[str, Any]:
    """Translate a ChatPayload into a TutorState-compatible input dict."""
    messages = [HumanMessage(
        content=payload.message,
        additional_kwargs=(
            {"confirm_response": payload.confirm_response}
            if payload.confirm_response
            else {}
        ),
    )]
    state: dict[str, Any] = {
        "messages": messages,
        "user_id": user_id,
        "project_name": payload.project_name,
        "knode_id": payload.knode_id,
        "active_tab": payload.active_tab,
    }
    if payload.session_id:
        state["session_id"] = payload.session_id
    return state


def _build_config(payload: ChatPayload, user_id: str) -> dict[str, Any]:
    """Build the LangGraph config dict (thread_id for checkpointer)."""
    return {
        "configurable": {
            "thread_id": payload.thread_id(user_id),
        }
    }


async def invoke(
    payload: ChatPayload,
    user_id: str,
) -> dict[str, Any]:
    """Run one turn through the tutor graph (non-streaming)."""
    graph = await _get_graph()
    state_input = _build_input(payload, user_id)
    config = _build_config(payload, user_id)
    result = await graph.ainvoke(state_input, config=config)
    # Extract the AI reply
    ai_msgs = [m for m in result.get("messages", []) if isinstance(m, AIMessage)]
    reply = ai_msgs[-1].content if ai_msgs else ""
    return {
        "response": reply,
        "active_skill": result.get("active_skill"),
        "skill_decision": result.get("skill_decision"),
        "confirm_required": result.get("confirm_required"),
        "_safety_triggered": result.get("_safety_triggered", False),
    }


async def stream(
    payload: ChatPayload,
    user_id: str,
) -> AsyncIterator[dict[str, Any]]:
    """Stream LangGraph events, yielding gateway-format dicts.

    Event types emitted:
    - {"type": "start", "active_skill": ...}
    - {"type": "skill", "action": ..., "target_skill": ..., "reason": ...}
    - {"type": "chunk", "content": ...}
    - {"type": "tool_call", "tool": ..., "args": ..., "result": ...}
    - {"type": "tool_confirm", "confirm_id": ..., "tool": ..., "args": ...}
    """
    graph = await _get_graph()
    state_input = _build_input(payload, user_id)
    config = _build_config(payload, user_id)

    final_state: dict[str, Any] = {}

    async for event in graph.astream_events(state_input, config=config, version="v2"):
        kind = event.get("event")

        if kind == "on_chain_end" and event.get("name") == "LangGraph":
            final_state = event.get("data", {}).get("output", {})

        # Token streaming from LLM calls inside skill subgraphs.
        # Filter out tokens from skill_router (its LLM call produces
        # JSON decisions, not student-facing text).
        if kind == "on_chat_model_stream":
            # LangGraph v2: tags include node path, metadata has langgraph_node
            tags = event.get("tags") or []
            meta = event.get("metadata") or {}
            node = meta.get("langgraph_node") or ""
            if (
                any("skill_router" in t for t in tags)
                or node == "skill_router"
            ):
                continue
            chunk = event.get("data", {}).get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                yield {"type": "chunk", "content": chunk.content}

    # After stream is done, emit structured events from final state
    decision = final_state.get("skill_decision") or {}
    if decision:
        yield {
            "type": "skill",
            "action": decision.get("action"),
            "target_skill": decision.get("target_skill"),
            "reason": decision.get("reason"),
        }

    confirm = final_state.get("confirm_required")
    if confirm:
        yield {
            "type": "tool_confirm",
            "confirm_id": confirm.get("confirm_id"),
            "tool": confirm.get("tool"),
            "args": confirm.get("args"),
        }

    if final_state.get("_safety_triggered"):
        yield {
            "type": "escalation",
            "severity": "urgent",
            "contact_info": "12355 青少年心理热线",
        }


__all__ = ["invoke", "stream", "shutdown"]
