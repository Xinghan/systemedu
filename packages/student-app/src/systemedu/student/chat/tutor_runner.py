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


# spec 040: 按用户 LLM 配置缓存的 graph (custom 用户专属; default 用户共享 _graph)
_user_graphs: dict[str, Any] = {}
_shared_deps: dict[str, Any] = {}  # loader / injector / checkpointer, 跨 graph 复用


async def _ensure_shared_deps() -> dict[str, Any]:
    """构建 skills loader / memory injector / checkpointer (一次, 跨所有 graph 复用)。"""
    global _checkpointer, _checkpointer_cm
    if _shared_deps:
        return _shared_deps

    from systemedu.core.config import TutorConfig, get_config
    from systemedu.core.tutor.checkpoint import get_checkpointer
    from systemedu.core.tutor.skills import SkillLoader
    from .memory_layers import CloudInjectorAdapter, StudentMemoryInjector

    loader = SkillLoader([_skills_root()])
    loader.scan()
    log.info("tutor_runner(student): loaded %d skills", len(loader.list_all()))

    tutor_cfg = TutorConfig(
        checkpoint_backend="sqlite",
        checkpoint_sqlite_path=_checkpoint_path(),
    )
    _checkpointer_cm = get_checkpointer(tutor_cfg)
    _checkpointer = await _checkpointer_cm.__aenter__()

    mem0_client = None
    cfg = get_config()
    if cfg.memory.enabled:
        try:
            from systemedu.core.tutor.memory.mem0_adapter import Mem0AsyncAdapter
            mem0_client = Mem0AsyncAdapter()
        except Exception as e:
            log.warning("Mem0 init failed (%s); L4 disabled", e)

    from ..library_proxy.client import get_library_client
    library_client = get_library_client()
    injector = CloudInjectorAdapter(
        StudentMemoryInjector(mem0_client=mem0_client, library_client=library_client)
    )
    _shared_deps.update(loader=loader, injector=injector, checkpointer=_checkpointer)
    return _shared_deps


def _build_graph_with_llm(llm: Any):
    """用给定 llm 构建一个 tutor graph (复用共享 deps)。"""
    from systemedu.core.tutor.graph import build_tutor_graph

    return build_tutor_graph(
        loader=_shared_deps["loader"],
        llm=llm,
        checkpointer=_shared_deps["checkpointer"],
        memory_injector=_shared_deps["injector"],
    )


async def _get_graph():
    """默认共享 graph (系统默认 provider). 预热 + default 用户用。"""
    global _graph
    if _graph is not None:
        return _graph

    from systemedu.core.llm_client import get_llm

    await _ensure_shared_deps()
    try:
        llm = get_llm()
    except Exception as e:
        log.warning("tutor_runner(student): LLM not configured (%s); graph runs sans LLM", e)
        llm = None
    _graph = _build_graph_with_llm(llm)
    log.info("tutor_runner(student): default graph built, checkpoint=%s", _checkpoint_path())
    return _graph


async def _resolve_user_graph(user_id: str) -> tuple[Any, bool]:
    """按用户 LLM 配置返回 (graph, fell_back)。

    - default / 无配置 → 共享默认 graph, fell_back=False
    - custom → 按配置指纹缓存/构建专属 graph; 构建或校验失败 → 回退默认 graph, fell_back=True
    """
    from ..db import get_user_llm_config

    try:
        cfg = get_user_llm_config(user_id)
    except Exception:
        log.exception("read user llm config failed user=%s; use default", user_id)
        return await _get_graph(), False

    if cfg is None or cfg.mode != "custom":
        return await _get_graph(), False

    # custom: 解密 key + 构造 llm, 按指纹缓存
    return await _resolve_custom_graph(cfg)


async def _resolve_custom_graph(cfg) -> tuple[Any, bool]:
    from systemedu.core.llm_client import build_custom_llm
    from ..settings.crypto import LLMConfigCryptoUnavailable, decrypt_key

    cache_key = f"{cfg.base_url}|{cfg.model}|{cfg.api_key_enc}"
    cached = _user_graphs.get(cache_key)
    if cached is not None:
        return cached, False

    try:
        await _ensure_shared_deps()
        api_key = decrypt_key(cfg.api_key_enc) if cfg.api_key_enc else ""
        if not api_key:
            raise LLMConfigCryptoUnavailable("no key")
        llm = build_custom_llm(
            base_url=cfg.base_url, api_key=api_key, model=cfg.model,
            streaming=True, request_timeout=300,
        )
        graph = _build_graph_with_llm(llm)
        _user_graphs[cache_key] = graph
        log.info("tutor_runner(student): custom graph built model=%s", cfg.model)
        return graph, False
    except Exception as e:
        log.warning("custom graph build failed (%s); fall back to default", e)
        return await _get_graph(), True


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
    _user_graphs.clear()
    _shared_deps.clear()


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
        # spec 031: 借 active_tab 透传 page_kind 到 memory_inject_node
        # (CloudInjectorAdapter 读 active_tab 派生 page_kind)
        "active_tab": payload.page_kind,
        "page_kind": payload.page_kind,
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
    graph, fell_back = await _resolve_user_graph(user_id)
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
        "llm_fallback": fell_back,
    }


async def stream(payload: ChatPayload, user_id: str) -> AsyncIterator[dict[str, Any]]:
    """Stream LangGraph events as gateway-format dicts.

    Event types:
      {"type": "chunk", "content": str}
      {"type": "skill", "action": str, "target_skill": str, "reason": str}
      {"type": "tool_confirm", "confirm_id": str, "tool": str, "args": dict}
      {"type": "escalation", "severity": "urgent", "contact_info": str}
    """
    graph, fell_back = await _resolve_user_graph(user_id)
    if fell_back:
        # spec 040: 用户 custom 配置不可用, 已回退默认模型, 通知前端
        yield {"type": "llm_fallback"}
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
