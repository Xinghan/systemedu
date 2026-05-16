"""spec 028 P1.5: Tutor graph runner for student-app.

复制自 cloud-app/.../tutor_runner.py, 改造点:
- ChatPayload 来自学生端版本 (library_slug + module_id 字符串)
- checkpointer 路径独立 (~/.systemedu/tutor-checkpoint-student.db)
- MemoryInjector 的 db_session_factory 用 student.db (student_fact 表也写这里)

graph 在进程内单例缓存, 由 server.py lifespan 调 preload_graph() 预热.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage

from systemedu.core.tutor.state import TutorState  # noqa: F401  (type hint)

from .payload import ChatPayload

log = logging.getLogger(__name__)

_graph = None
_checkpointer = None
_checkpointer_cm = None


def _skills_root() -> Path:
    """Built-in skills live in systemedu-core (跨 package 解析)."""
    import systemedu.core as _core
    return Path(_core.__file__).parent / "tutor" / "skills"


def _checkpoint_path() -> str:
    """student-app 独立 checkpoint, 跟 cloud-app 不混."""
    override = os.environ.get("STUDENT_TUTOR_CHECKPOINT_PATH")
    if override:
        return override
    return str(Path.home() / ".systemedu" / "tutor-checkpoint-student.db")


async def _get_graph():
    """Build or return the cached tutor graph."""
    global _graph, _checkpointer, _checkpointer_cm

    if _graph is not None:
        return _graph

    from systemedu.core.config import TutorConfig
    from systemedu.core.llm_client import get_llm
    from systemedu.core.tutor.checkpoint import get_checkpointer
    from systemedu.core.tutor.graph import build_tutor_graph
    from systemedu.core.tutor.memory import MemoryInjector
    from systemedu.core.tutor.skills import SkillLoader

    # LLM
    try:
        llm = get_llm()
    except Exception as e:
        log.warning("tutor_runner(student): LLM not configured (%s); graph runs sans LLM", e)
        llm = None

    # Skills
    loader = SkillLoader([_skills_root()])
    loader.scan()
    log.info("tutor_runner(student): loaded %d skills", len(loader.list_all()))

    # Checkpointer — 独立 SQLite db, 不跟 cloud-app 混
    tutor_cfg = TutorConfig(
        checkpoint_backend="sqlite",
        checkpoint_sqlite_path=_checkpoint_path(),
    )
    _checkpointer_cm = get_checkpointer(tutor_cfg)
    _checkpointer = await _checkpointer_cm.__aenter__()

    # Memory injector — student.db 作为 student_fact 落点
    from ..db import get_session as get_student_db_session

    injector = MemoryInjector(db_session_factory=get_student_db_session)

    _graph = build_tutor_graph(
        loader=loader,
        llm=llm,
        checkpointer=_checkpointer,
        memory_injector=injector,
    )
    log.info("tutor_runner(student): graph built, checkpoint=%s", _checkpoint_path())
    return _graph


async def preload_graph() -> None:
    """Server startup: build graph eagerly so first chat doesn't pay 5-10s cold start."""
    try:
        await _get_graph()
    except Exception:
        log.exception("preload_graph failed (will retry on first request)")


async def shutdown_graph() -> None:
    """Server shutdown: close checkpointer connection."""
    global _checkpointer, _checkpointer_cm, _graph
    if _checkpointer_cm is not None:
        try:
            await _checkpointer_cm.__aexit__(None, None, None)
        except Exception:
            log.exception("shutdown_graph: checkpointer close failed")
        _checkpointer_cm = None
        _checkpointer = None
    _graph = None


def _build_input(payload: ChatPayload, user_id: str) -> dict[str, Any]:
    """Translate ChatPayload into a TutorState-compatible input dict.

    TutorState 字段名沿用 cloud-app 时期的 project_name / knode_id, 我们映射:
      library_slug → project_name (str slug)
      module_id    → knode_id (str module id 而不是 int — TutorState 不强类型)
    """
    messages = [
        HumanMessage(
            content=payload.message,
            additional_kwargs=(
                {"confirm_response": payload.confirm_response}
                if payload.confirm_response
                else {}
            ),
        )
    ]
    state: dict[str, Any] = {
        "messages": messages,
        "user_id": user_id,
        "project_name": payload.library_slug,
        "knode_id": payload.module_id,
        "active_tab": None,
    }
    if payload.session_id:
        state["session_id"] = payload.session_id
    return state


def _build_config(payload: ChatPayload, user_id: str) -> dict[str, Any]:
    return {
        "configurable": {
            "thread_id": payload.thread_id(user_id),
        }
    }


async def invoke(payload: ChatPayload, user_id: str) -> dict[str, Any]:
    """Run one turn through the tutor graph (non-streaming)."""
    graph = await _get_graph()
    state_input = _build_input(payload, user_id)
    config = _build_config(payload, user_id)
    result = await graph.ainvoke(state_input, config=config)
    ai_msgs = [m for m in result.get("messages", []) if isinstance(m, AIMessage)]
    reply = ai_msgs[-1].content if ai_msgs else ""
    return {
        "response": reply,
        "active_skill": result.get("active_skill"),
        "skill_decision": result.get("skill_decision"),
        "confirm_required": result.get("confirm_required"),
        "_safety_triggered": result.get("_safety_triggered", False),
    }


async def stream(payload: ChatPayload, user_id: str) -> AsyncIterator[dict[str, Any]]:
    """Stream LangGraph events as gateway-format dicts.

    Event types:
      {"type": "chunk", "content": str}
      {"type": "skill", "action": str, "target_skill": str, "reason": str}
      {"type": "tool_confirm", "confirm_id": str, "tool": str, "args": dict}
      {"type": "escalation", "severity": "urgent", "contact_info": str}
    """
    graph = await _get_graph()
    state_input = _build_input(payload, user_id)
    config = _build_config(payload, user_id)

    final_state: dict[str, Any] = {}

    async for event in graph.astream_events(state_input, config=config, version="v2"):
        kind = event.get("event")

        if kind == "on_chain_end" and event.get("name") == "LangGraph":
            final_state = event.get("data", {}).get("output", {})

        if kind == "on_chat_model_stream":
            tags = event.get("tags") or []
            meta = event.get("metadata") or {}
            node = meta.get("langgraph_node") or ""
            # skill_router 的 LLM 调用是 JSON 决策, 不是给学生看的
            if any("skill_router" in t for t in tags) or node == "skill_router":
                continue
            chunk = event.get("data", {}).get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                yield {"type": "chunk", "content": chunk.content}

    # 流末尾, 把结构化事件追加发出
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


__all__ = ["invoke", "stream", "preload_graph", "shutdown_graph"]
