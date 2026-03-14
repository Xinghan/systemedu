"""SystemEdu Gateway - HTTP + WebSocket server using Starlette."""

import argparse
import asyncio
import json
import logging
import time
from pathlib import Path

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)

# Track server start time for uptime calculation
_start_time: float = 0.0

# Shared runtime instance (created on startup)
_runtime = None
_session_manager = None


def _get_runtime():
    global _runtime
    if _runtime is None:
        from systemedu.core.runtime import AgentRuntime

        _runtime = AgentRuntime()
    return _runtime


def _get_session_manager():
    return _get_runtime().session_manager


def _format_uptime(seconds: float) -> str:
    hours, remainder = divmod(int(seconds), 3600)
    minutes, secs = divmod(remainder, 60)
    if hours > 0:
        return f"{hours}h {minutes}m"
    if minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


# --- API Endpoints ---


async def api_status(request: Request) -> JSONResponse:
    """GET /api/status - System status."""
    from systemedu.core.config import get_config

    config = get_config()
    sessions = _get_session_manager().list_sessions()

    return JSONResponse(
        {
            "version": "0.1.0",
            "running": True,
            "uptime": _format_uptime(time.time() - _start_time),
            "uptime_seconds": int(time.time() - _start_time),
            "llm": {
                "default": config.llm.default,
                "providers": list(config.llm.providers.keys()),
            },
            "sessions": len(sessions),
            "port": config.gateway.port,
        }
    )


async def api_config(request: Request) -> JSONResponse:
    """GET /api/config - Current config (sanitized, no API keys)."""
    from systemedu.core.config import get_config

    config = get_config()

    # Sanitize: mask API keys
    providers = {}
    for name, prov in config.llm.providers.items():
        providers[name] = {
            "base_url": prov.base_url,
            "model": prov.model,
            "api_key": "***" if prov.api_key else "(not set)",
            "temperature": prov.temperature,
        }

    return JSONResponse(
        {
            "llm": {"default": config.llm.default, "providers": providers},
            "gateway": {"port": config.gateway.port, "host": config.gateway.host},
            "sandbox": {"enabled": config.sandbox.enabled},
            "memory": {"enabled": config.memory.enabled, "backend": config.memory.backend},
        }
    )


async def api_sessions(request: Request) -> JSONResponse:
    """GET /api/sessions - List active sessions."""
    sessions = _get_session_manager().list_sessions()
    return JSONResponse(
        [
            {
                "id": s.id,
                "agent": s.agent_name,
                "project": s.project_name,
                "messages": len(s.messages),
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions
        ]
    )


async def api_session_detail(request: Request) -> JSONResponse:
    """GET /api/sessions/{id} - Session details with messages."""
    session_id = request.path_params["id"]
    session = _get_session_manager().get_session(session_id)

    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    return JSONResponse(
        {
            "id": session.id,
            "agent": session.agent_name,
            "project": session.project_name,
            "created_at": session.created_at.isoformat(),
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "timestamp": m.timestamp.isoformat(),
                }
                for m in session.messages
            ],
        }
    )


async def api_chat(request: Request) -> JSONResponse:
    """POST /api/chat - Send a message (synchronous response)."""
    body = await request.json()
    message = body.get("message", "").strip()
    session_id = body.get("session_id")
    user_id = body.get("user_id", "default")

    if not message:
        return JSONResponse({"error": "message is required"}, status_code=400)

    runtime = _get_runtime()

    session = None
    if session_id:
        session = _get_session_manager().get_session(session_id)

    if session is None:
        session = _get_session_manager().create_session()

    response = await runtime.process_message(message, session, user_id=user_id)

    return JSONResponse(
        {
            "session_id": session.id,
            "response": response,
        }
    )


async def ws_chat_stream(websocket: WebSocket) -> None:
    """WS /api/chat/stream - Streaming chat via WebSocket.

    Client sends: {"message": "...", "session_id": "..."}
    Server sends: {"type": "chunk", "content": "..."} for each chunk
                  {"type": "done", "session_id": "..."} when complete
                  {"type": "error", "message": "..."} on error
    """
    await websocket.accept()

    runtime = _get_runtime()

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "").strip()
            session_id = data.get("session_id")

            if not message:
                await websocket.send_json({"type": "error", "message": "message is required"})
                continue

            session = None
            if session_id:
                session = _get_session_manager().get_session(session_id)
            if session is None:
                session = _get_session_manager().create_session()

            try:
                async for chunk in runtime.stream_message(message, session):
                    await websocket.send_json({"type": "chunk", "content": chunk})
                await websocket.send_json({"type": "done", "session_id": session.id})
            except Exception as e:
                logger.exception("Error in streaming chat")
                await websocket.send_json({"type": "error", "message": str(e)})

    except Exception:
        pass  # Client disconnected


async def dashboard(request: Request) -> HTMLResponse:
    """GET / - Serve the dashboard HTML."""
    static_dir = Path(__file__).parent / "static"
    index_file = static_dir / "index.html"

    if index_file.exists():
        return HTMLResponse(index_file.read_text(encoding="utf-8"))

    return HTMLResponse(
        "<html><body><h1>SystemEdu Dashboard</h1>"
        "<p>Dashboard static files not found.</p></body></html>"
    )


# --- App Factory ---


async def _on_startup():
    """Initialize runtime and auto-connect configured MCP servers on startup."""
    global _runtime
    from systemedu.core.config import get_config
    from systemedu.core.runtime import AgentRuntime

    config = get_config()
    mcp_manager = None

    if config.mcp.servers:
        try:
            from systemedu.mcp.manager import MCPManager

            mcp_manager = MCPManager()
            for name, srv_config in config.mcp.servers.items():
                try:
                    await mcp_manager.start_server(name, srv_config)
                    logger.info(f"MCP server '{name}' auto-connected")
                except Exception as e:
                    logger.warning(f"MCP server '{name}' auto-connect failed: {e}")
        except Exception as e:
            logger.warning(f"MCP manager init failed: {e}")

    _runtime = AgentRuntime(mcp_manager=mcp_manager)


def create_app() -> Starlette:
    """Create the Starlette ASGI application."""
    global _start_time
    _start_time = time.time()

    routes = [
        Route("/", dashboard),
        Route("/api/status", api_status),
        Route("/api/config", api_config),
        Route("/api/sessions", api_sessions),
        Route("/api/sessions/{id}", api_session_detail),
        Route("/api/chat", api_chat, methods=["POST"]),
        WebSocketRoute("/api/chat/stream", ws_chat_stream),
    ]

    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        ),
    ]

    app = Starlette(
        routes=routes,
        middleware=middleware,
        on_startup=[_on_startup],
    )
    return app


# --- CLI Entry Point (for daemon subprocess) ---


def main():
    """Run the gateway server (used by daemon subprocess)."""
    import uvicorn

    parser = argparse.ArgumentParser(description="SystemEdu Gateway")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18820)
    args = parser.parse_args()

    app = create_app()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
