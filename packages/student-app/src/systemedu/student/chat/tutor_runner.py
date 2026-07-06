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


def _make_tool_context(payload: ChatPayload, user_id: str):
    """Build the ToolContext installed for the duration of a graph run.

    spec 043 P1: this is what lets the skills' tool loops actually
    execute — `require_tool_context()` raises without it. We inject:
      - the authenticated user_id (never trust an LLM-supplied one)
      - a StudentDataProvider (tools read/write via `ctx.data.*`)
      - the active project/knode for scope-aware tools

    NOTE: the audit log_sink is intentionally not wired yet. The core
    `make_log_sink` writes to `core.storage`'s `ToolCallLog` table via a
    bare session factory, but student-app uses a contextmanager session
    and its own schema (no `tool_call_log` table). Persisting tool-call
    audit into student-app's DB is a follow-up (T1.5 audit) — the tool
    loop itself does not depend on it.
    """
    from systemedu.core.tutor.tools import ToolContext

    from ..library_proxy.client import get_library_client
    from .tool_data import StudentDataProvider

    return ToolContext(
        user_id=user_id,
        session_id=payload.session_id,
        project_name=payload.library_slug,
        knode_id=payload.module_id,
        data=StudentDataProvider(library_client=get_library_client()),
    )


# ---------------------------------------------------------------------------
# HITL (spec 043 T1.9/1C): interrupt payload <-> WS `tool_confirm` event
# ---------------------------------------------------------------------------
def _extract_interrupt_value(obj: Any) -> dict[str, Any] | None:
    """Pull the HumanInTheLoopMiddleware interrupt value out of a graph result.

    `graph.ainvoke(...)` returns a dict that carries `__interrupt__` (a tuple
    of `Interrupt` objects) when the run paused. `astream_events` surfaces the
    same under an `on_chain_stream`/`on_chain_end` chunk. In both cases we want
    the first interrupt's `.value`, which HITL shapes as
    `{"action_requests": [{name, args, description}], "review_configs": [...]}`.
    """
    if not isinstance(obj, dict):
        return None
    interrupts = obj.get("__interrupt__")
    if not interrupts:
        return None
    first = interrupts[0] if isinstance(interrupts, (list, tuple)) else interrupts
    value = getattr(first, "value", None)
    if value is None and isinstance(first, dict):
        value = first.get("value")
    return value if isinstance(value, dict) else None


def _confirm_from_interrupt_value(value: dict[str, Any]) -> dict[str, Any] | None:
    """Turn a HITL interrupt value into a `tool_confirm` WS event payload.

    We surface the first pending action (parallel_tool_calls=False guarantees at
    most one). `confirm_id` is the thread's resume token from the frontend's POV
    — a fresh id per pause so a stale card can't resume the wrong interrupt.
    """
    requests = value.get("action_requests") or []
    if not requests:
        return None
    req = requests[0]
    import uuid

    return {
        "confirm_id": f"c-{uuid.uuid4().hex[:12]}",
        "tool": req.get("name"),
        "args": req.get("args") or {},
        "description": req.get("description") or "",
    }


def _interrupt_to_confirm(result: dict[str, Any]) -> dict[str, Any] | None:
    """Convenience: result dict -> `tool_confirm` payload (or None)."""
    value = _extract_interrupt_value(result)
    if value is None:
        return None
    return _confirm_from_interrupt_value(value)


# ---------------------------------------------------------------------------
# Output-side safety (spec 043 P5 A6): the tutor's OWN final reply is checked
# before it reaches the student. Symmetric to the input-side safety_gate.
# ---------------------------------------------------------------------------
def _safe_reply(reply: str) -> tuple[str, dict[str, Any] | None]:
    """Return (reply_to_send, safety_blocked_event_or_None).

    Runs the local output filter. On a block, swaps in SAFE_FALLBACK and returns
    an event describing what was caught (for the frontend + audit). Never raises
    — the filter fails open, so a normal reply always flows.
    """
    from systemedu.core.tutor.safety import SAFE_FALLBACK, check_output_safety

    verdict = check_output_safety(reply)
    if not verdict.blocked:
        return reply, None
    log.warning(
        "output safety blocked a tutor reply: categories=%s", verdict.categories
    )
    event = {
        "type": "safety_blocked",
        "categories": verdict.categories,
        "escalate": verdict.should_escalate,
    }
    return SAFE_FALLBACK, event


async def invoke(payload: ChatPayload, user_id: str) -> dict[str, Any]:
    """Run one turn through the tutor graph (non-streaming)."""
    from systemedu.core.tutor.tools import push_tool_context

    graph, fell_back = await _resolve_user_graph(user_id)
    state_input = _build_input(payload, user_id)
    config = _build_config(payload, user_id)
    with push_tool_context(_make_tool_context(payload, user_id)):
        result = await graph.ainvoke(state_input, config=config)
    ai_msgs = [m for m in result.get("messages", []) if isinstance(m, AIMessage)]
    reply = ai_msgs[-1].content if ai_msgs else ""
    # Output-side safety (spec 043 P5 A6): swap a dangerous reply for the fallback.
    reply, safety_event = _safe_reply(reply if isinstance(reply, str) else str(reply))
    # HITL note (spec 043 1C): a write tool interrupts the graph and `ainvoke`
    # returns with `__interrupt__` in the result instead of a final answer.
    # The non-streaming POST path can't do a pause→confirm→resume round-trip in
    # one request, so it surfaces the pending confirmation for the caller to
    # handle (the WS path in `stream()` drives the full interactive loop).
    confirm = _interrupt_to_confirm(result)
    out = {
        "response": reply,
        "active_skill": result.get("active_skill"),
        "skill_decision": result.get("skill_decision"),
        "confirm_required": confirm,
        "_safety_triggered": result.get("_safety_triggered", False),
        "llm_fallback": fell_back,
    }
    if safety_event is not None:
        out["safety_blocked"] = safety_event
    return out


async def _stream_one_segment(
    graph: Any, graph_input: Any, config: dict[str, Any]
) -> AsyncIterator[dict[str, Any]]:
    """Stream chunk events for one graph segment (initial run OR a resume).

    Yields only student-facing `chunk` events here; structured trailer events
    (skill / escalation) are emitted by the caller from the post-run state so
    they fire exactly once per turn, not once per segment.
    """
    async for event in graph.astream_events(graph_input, config=config, version="v2"):
        if event.get("event") != "on_chat_model_stream":
            continue
        tags = event.get("tags") or []
        meta = event.get("metadata") or {}
        node = meta.get("langgraph_node") or ""
        # skill_router 的 LLM 调用是 JSON 决策, 不是给学生看的
        if any("skill_router" in t for t in tags) or node == "skill_router":
            continue
        chunk = event.get("data", {}).get("chunk")
        if chunk and hasattr(chunk, "content") and chunk.content:
            yield {"type": "chunk", "content": chunk.content}


def _decision_to_resume(decision: dict[str, Any] | None) -> dict[str, Any]:
    """Map a frontend decision to a HITL resume value.

    HITL middleware does `interrupt(req)["decisions"]`, so the resume value is
    `{"decisions": [<one decision per pending call>]}`. parallel_tool_calls=False
    means at most one pending call, so we always send a single-element list.
    A missing/unknown decision is treated as a reject (fail safe: never run a
    write tool the student didn't approve).
    """
    dtype = (decision or {}).get("type")
    if dtype == "approve":
        return {"decisions": [{"type": "approve"}]}
    msg = (decision or {}).get("message") or "学生未确认该操作。"
    return {"decisions": [{"type": "reject", "message": msg}]}


async def stream(
    payload: ChatPayload,
    user_id: str,
    resume_provider: Any = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream LangGraph events as gateway-format dicts, with HITL support.

    Event types:
      {"type": "chunk", "content": str}
      {"type": "skill", "action": str, "target_skill": str, "reason": str}
      {"type": "tool_confirm", "confirm_id": str, "tool": str, "args": dict}
      {"type": "safety_blocked", "categories": [str], "escalate": bool}
      {"type": "escalation", "severity": "urgent", "contact_info": str}

    Output safety (spec 043 P5 A6): the student-facing reply is BUFFERED and run
    through the output filter before emission; a dangerous reply is swapped for a
    safe fallback and a `safety_blocked` event is emitted. This trades the
    token-by-token typing effect for the guarantee that unsafe content never
    leaves the backend.

    HITL (spec 043 1C): when a write tool interrupts the graph, we emit a
    `tool_confirm` event. If `resume_provider` is given (the WS handler passes
    one), we `await resume_provider(confirm_payload)` for the student's decision
    and resume the SAME thread with `Command(resume=...)`, streaming the
    continuation. Without a provider (e.g. simple callers), the stream ends at
    `tool_confirm` and the caller must re-drive the resume itself.

    `resume_provider` signature: `async (confirm: dict) -> dict | None`, returning
    a decision like `{"type": "approve"}` / `{"type": "reject", "message": str}`.
    """
    from langgraph.types import Command

    from systemedu.core.tutor.tools import push_tool_context

    graph, fell_back = await _resolve_user_graph(user_id)
    if fell_back:
        # spec 040: 用户 custom 配置不可用, 已回退默认模型, 通知前端
        yield {"type": "llm_fallback"}
    config = _build_config(payload, user_id)

    # First segment runs the fresh input; later segments resume the same thread.
    graph_input: Any = _build_input(payload, user_id)

    # spec 043 P1: install ToolContext for the whole graph run so skill
    # tool loops can execute (require_tool_context raises otherwise).
    #
    # Output-side safety (spec 043 P5 A6) forces a design choice: to guarantee a
    # dangerous reply never reaches the student, the final reply must be checked
    # BEFORE it leaves the backend. So we BUFFER each segment's student-facing
    # tokens instead of streaming them live, run check_output_safety on the
    # assembled text, then emit it as one chunk (or the fallback). Mid-turn
    # control events (tool_confirm) are still emitted immediately — they aren't
    # the tutor's spoken reply.
    with push_tool_context(_make_tool_context(payload, user_id)):
        while True:
            buffered: list[str] = []
            async for chunk_event in _stream_one_segment(graph, graph_input, config):
                if chunk_event.get("type") == "chunk" and chunk_event.get("content"):
                    buffered.append(chunk_event["content"])

            # After a segment, either the graph finished or it interrupted for a
            # write-tool confirmation. Read the persisted state to tell which.
            state = await graph.aget_state(config)
            interrupted = bool(getattr(state, "next", None)) and bool(
                getattr(state, "interrupts", None)
            )

            if interrupted:
                # Any partial pre-interrupt text still gets safety-checked before
                # it's shown, then the confirm card follows.
                if buffered:
                    safe_text, safety_event = _safe_reply("".join(buffered))
                    yield {"type": "chunk", "content": safe_text}
                    if safety_event is not None:
                        yield safety_event
                confirm = _confirm_from_interrupt_value(state.interrupts[0].value)
                if confirm:
                    yield {"type": "tool_confirm", **confirm}
                # No way to collect a decision inline → stop here; the caller
                # re-drives resume on a later call.
                if resume_provider is None:
                    return
                decision = await resume_provider(confirm)
                graph_input = Command(resume=_decision_to_resume(decision))
                continue  # stream the continuation segment

            # Graph finished this turn — safety-check the assembled reply, then
            # emit it (or the fallback) as one chunk.
            if buffered:
                safe_text, safety_event = _safe_reply("".join(buffered))
                yield {"type": "chunk", "content": safe_text}
                if safety_event is not None:
                    yield safety_event

            # Trailer events from final state.
            final_state = getattr(state, "values", None) or {}
            skill_decision = final_state.get("skill_decision") or {}
            if skill_decision:
                yield {
                    "type": "skill",
                    "action": skill_decision.get("action"),
                    "target_skill": skill_decision.get("target_skill"),
                    "reason": skill_decision.get("reason"),
                }
            if final_state.get("_safety_triggered"):
                yield {
                    "type": "escalation",
                    "severity": "urgent",
                    "contact_info": "12355 青少年心理热线",
                }
            return


__all__ = ["invoke", "stream", "preload_graph", "shutdown_graph"]
