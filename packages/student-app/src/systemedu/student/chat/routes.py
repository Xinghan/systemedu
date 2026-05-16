"""spec 028 P1.8: chat HTTP + WebSocket routes.

POST   /api/chat                单轮 chat (非流式)
WS     /api/chat/stream         流式 chat (主路径)
GET    /api/chat/sessions       当前 user 所有 sessions
GET    /api/chat/sessions/{id}  单 session messages
POST   /api/chat/sessions       新建 session
DELETE /api/chat/sessions/{id}  删除 session
"""

from __future__ import annotations

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

from ..auth.deps import require_login
from . import session as session_store
from .auth_ws import authenticate_ws
from .payload import ChatPayload
from . import tutor_runner

log = logging.getLogger(__name__)


def _default_title(message: str) -> str:
    t = (message or "").strip().splitlines()[0] if message else "新对话"
    return t[:40] if len(t) > 40 else t


async def _ensure_session(
    user_id: str,
    payload: ChatPayload,
) -> str:
    """如果 payload 没带 session_id, 新建一个并返回它."""
    if payload.session_id:
        s = session_store.get_session_for_user(payload.session_id, user_id)
        if s is not None:
            return s["id"]
    s = session_store.create_session(
        user_id=user_id,
        library_slug=payload.library_slug,
        module_id=payload.module_id,
        title=_default_title(payload.message),
    )
    return s["id"]


# ---------------------------------------------------------------------------
# POST /api/chat — 非流式
# ---------------------------------------------------------------------------

async def api_chat(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        body = await request.json()
        payload = ChatPayload(**body)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)

    session_id = await _ensure_session(user_id, payload)
    # 落 user message
    session_store.append_message(
        session_id=session_id,
        user_id=user_id,
        library_slug=payload.library_slug,
        module_id=payload.module_id,
        role="user",
        content=payload.message,
    )

    try:
        result = await tutor_runner.invoke(payload, user_id)
    except Exception as e:
        log.exception("tutor invoke failed")
        return JSONResponse({"error": "tutor_invoke_failed", "detail": str(e)}, status_code=500)

    # 落 assistant message
    session_store.append_message(
        session_id=session_id,
        user_id=user_id,
        library_slug=payload.library_slug,
        module_id=payload.module_id,
        role="assistant",
        content=str(result.get("response") or ""),
        skill=result.get("active_skill"),
    )

    resp = {
        "response": result.get("response") or "",
        "session_id": session_id,
        "thread_id": payload.thread_id(user_id),
    }
    if result.get("active_skill"):
        resp["active_skill"] = result["active_skill"]
    if result.get("confirm_required"):
        resp["confirm_required"] = result["confirm_required"]
    if result.get("_safety_triggered"):
        resp["_safety_triggered"] = True
    return JSONResponse(resp)


# ---------------------------------------------------------------------------
# WS /api/chat/stream — 流式
# ---------------------------------------------------------------------------

async def ws_chat_stream(websocket: WebSocket) -> None:
    user_id = await authenticate_ws(websocket)
    if user_id is None:
        await websocket.close(code=4401)
        return
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            try:
                payload = ChatPayload(**data)
            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})
                continue

            session_id = await _ensure_session(user_id, payload)
            session_store.append_message(
                session_id=session_id,
                user_id=user_id,
                library_slug=payload.library_slug,
                module_id=payload.module_id,
                role="user",
                content=payload.message,
            )
            await websocket.send_json({
                "type": "session",
                "session_id": session_id,
                "thread_id": payload.thread_id(user_id),
            })

            collected: list[str] = []
            active_skill = None
            try:
                async for event in tutor_runner.stream(payload, user_id):
                    await websocket.send_json(event)
                    if event.get("type") == "chunk" and event.get("content"):
                        collected.append(event["content"])
                    if event.get("type") == "skill" and event.get("target_skill"):
                        active_skill = event["target_skill"]
            except Exception as e:
                log.exception("ws_chat_stream tutor.stream error")
                await websocket.send_json({"type": "error", "message": str(e)})
                continue

            full_reply = "".join(collected)
            if full_reply:
                session_store.append_message(
                    session_id=session_id,
                    user_id=user_id,
                    library_slug=payload.library_slug,
                    module_id=payload.module_id,
                    role="assistant",
                    content=full_reply,
                    skill=active_skill,
                )
            await websocket.send_json({
                "type": "done",
                "session_id": session_id,
                "thread_id": payload.thread_id(user_id),
            })
    except WebSocketDisconnect:
        return


# ---------------------------------------------------------------------------
# /api/chat/sessions/* — CRUD
# ---------------------------------------------------------------------------

async def api_sessions_list(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    library_slug = request.query_params.get("library_slug")
    module_id = request.query_params.get("module_id")
    sessions = session_store.list_sessions(user_id, library_slug, module_id)
    return JSONResponse(sessions)


async def api_sessions_get(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    session_id = request.path_params["session_id"]
    s = session_store.get_session_for_user(session_id, user_id)
    if s is None:
        return JSONResponse({"error": "not_found"}, status_code=404)
    msgs = session_store.get_messages(session_id)
    return JSONResponse({"session": s, "messages": msgs})


async def api_sessions_create(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        body = await request.json()
    except Exception:
        body = {}
    library_slug = body.get("library_slug")
    module_id = body.get("module_id")
    title = body.get("title") or "新对话"
    s = session_store.create_session(user_id, library_slug, module_id, title)
    return JSONResponse(s, status_code=201)


async def api_sessions_delete(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    session_id = request.path_params["session_id"]
    ok = session_store.delete_session(session_id, user_id)
    if not ok:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return JSONResponse({"deleted": True})


ROUTES = [
    Route("/api/chat", api_chat, methods=["POST"]),
    WebSocketRoute("/api/chat/stream", ws_chat_stream),
    Route("/api/chat/sessions", api_sessions_list, methods=["GET"]),
    Route("/api/chat/sessions", api_sessions_create, methods=["POST"]),
    Route("/api/chat/sessions/{session_id}", api_sessions_get, methods=["GET"]),
    Route("/api/chat/sessions/{session_id}", api_sessions_delete, methods=["DELETE"]),
]
