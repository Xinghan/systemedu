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
    """POST /api/chat - Send a message (synchronous response).

    Supports optional project/agent context:
      {"message": "...", "session_id": "...", "project": "train-ai-model", "agent": "tutor"}
    """
    body = await request.json()
    message = body.get("message", "").strip()
    session_id = body.get("session_id")
    user_id = body.get("user_id", "default")
    project_name = body.get("project")
    agent_name = body.get("agent")

    if not message:
        return JSONResponse({"error": "message is required"}, status_code=400)

    # If project/agent specified and no existing session, create a contextual runtime
    runtime = _get_runtime()
    if project_name and not session_id:
        try:
            from systemedu.core.runtime import AgentRuntime
            from systemedu.education.project_loader import load_project_context

            ctx = load_project_context(project_name, user_id=user_id)
            skill_names = [agent_name] if agent_name else None
            runtime = AgentRuntime(
                project_context=ctx,
                skill_names=skill_names,
            )
        except Exception as e:
            logger.warning(f"Failed to load project context: {e}")

    session = None
    if session_id:
        session = _get_session_manager().get_session(session_id)

    if session is None:
        session = _get_session_manager().create_session(
            agent_name=agent_name,
            project_name=project_name,
        )

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


async def api_projects(request: Request) -> JSONResponse:
    """GET /api/projects - List local projects."""
    from systemedu.core.config import SYSTEMEDU_HOME

    projects = []
    search_dirs = [
        Path.cwd() / "projects",
        Path.home() / "projects",
        SYSTEMEDU_HOME / "projects",
    ]

    seen = set()
    for d in search_dirs:
        if not d.is_dir():
            continue
        for sub in sorted(d.iterdir()):
            yaml_file = sub / "project.yaml"
            if sub.is_dir() and yaml_file.exists() and sub.name not in seen:
                seen.add(sub.name)
                try:
                    import yaml as _yaml

                    data = _yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
                    projects.append(
                        {
                            "name": data.get("name", sub.name),
                            "title": data.get("title", sub.name),
                            "description": data.get("description", ""),
                            "category": data.get("category", "other"),
                            "age_range": data.get("age_range", [6, 18]),
                            "estimated_hours": data.get("estimated_hours", 10),
                            "tags": data.get("tags", []),
                            "path": str(sub),
                        }
                    )
                except Exception as e:
                    logger.warning(f"Failed to load project {sub.name}: {e}")

    return JSONResponse(projects)


async def api_project_detail(request: Request) -> JSONResponse:
    """GET /api/projects/{name} - Project detail with tree and progress."""
    name = request.path_params["name"]
    try:
        from systemedu.education.project_loader import load_project_context

        ctx = load_project_context(name)

        # Serialize tree
        milestones = []
        for ms in ctx.tree.milestones:
            milestones.append(
                {
                    "title": ms.title,
                    "description": ms.description,
                    "order": ms.order,
                    "xp_reward": ms.xp_reward,
                    "knodes": [
                        {
                            "id": i,
                            "title": node.title,
                            "summary": node.summary,
                            "difficulty_level": node.difficulty_level,
                            "content_type": node.content_type.value,
                            "acceptance_type": node.acceptance_type.value,
                            "estimated_minutes": node.estimated_minutes,
                            "xp_reward": node.xp_reward,
                            "prerequisite_indices": node.prerequisite_indices,
                        }
                        for i, node in enumerate(ms.knodes)
                    ],
                }
            )

        # Serialize progress
        progress = [
            {
                "knode_id": p.knode_id,
                "status": p.status.value,
                "attempts": p.attempts,
                "best_score": p.best_score,
                "passed_at": p.passed_at.isoformat() if p.passed_at else None,
            }
            for p in ctx.progress
        ]

        return JSONResponse(
            {
                "project": {
                    "name": ctx.project.name,
                    "title": ctx.project.title,
                    "description": ctx.project.description,
                    "category": ctx.project.category.value,
                    "age_range": ctx.project.age_range,
                    "estimated_hours": ctx.project.estimated_hours,
                    "tags": ctx.project.tags,
                },
                "milestones": milestones,
                "progress": progress,
            }
        )
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)
    except Exception as e:
        logger.exception(f"Failed to load project {name}")
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_agents(request: Request) -> JSONResponse:
    """GET /api/agents - List available agent types."""
    agents = [
        {
            "name": "tutor",
            "type": "builtin:tutor",
            "description": "AI 导师 — 引导式教学，辅助项目学习",
        },
        {
            "name": "planner",
            "type": "builtin:planner",
            "description": "知识树规划器 — 生成项目知识树",
        },
        {
            "name": "assessor",
            "type": "builtin:assessor",
            "description": "知识评估器 — 评估学习成果",
        },
    ]
    return JSONResponse(agents)


async def api_skills(request: Request) -> JSONResponse:
    """GET /api/skills - List all loaded skills."""
    from systemedu.core.config import SYSTEMEDU_HOME
    from systemedu.skills.loader import SkillLoader

    loader = SkillLoader()
    loader.load_builtin()

    user_skills_dir = SYSTEMEDU_HOME / "skills"
    if user_skills_dir.exists():
        loader.load_directory(user_skills_dir, priority=1)

    skills = [
        {
            "name": s.name,
            "description": s.description,
            "user_invocable": s.user_invocable,
            "source": s.source_path,
        }
        for s in loader.list_skills()
    ]
    return JSONResponse(skills)


async def api_mcp_servers(request: Request) -> JSONResponse:
    """GET /api/mcp/servers - List MCP server configs and status."""
    from systemedu.core.config import get_config

    config = get_config()
    servers = []
    for name, srv in config.mcp.servers.items():
        servers.append(
            {
                "name": name,
                "command": srv.command,
                "args": srv.args,
                "env": {k: "***" for k in srv.env},
                "status": "configured",
            }
        )
    return JSONResponse(servers)


async def api_mcp_add(request: Request) -> JSONResponse:
    """POST /api/mcp/servers - Add an MCP server to config."""
    import yaml as _yaml

    from systemedu.core.config import CONFIG_FILE, get_config, reset_config, save_config

    body = await request.json()
    name = body.get("name", "").strip()
    command = body.get("command", "").strip()
    args = body.get("args", [])

    if not name or not command:
        return JSONResponse({"error": "name and command are required"}, status_code=400)

    config_path = CONFIG_FILE
    raw = {}
    if config_path.exists():
        raw = _yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}

    raw.setdefault("mcp", {}).setdefault("servers", {})
    raw["mcp"]["servers"][name] = {"command": command, "args": args}
    save_config(raw)

    return JSONResponse({"status": "added", "name": name})


async def api_mcp_remove(request: Request) -> JSONResponse:
    """DELETE /api/mcp/servers/{name} - Remove an MCP server from config."""
    import yaml as _yaml

    from systemedu.core.config import CONFIG_FILE, reset_config, save_config

    name = request.path_params["name"]
    config_path = CONFIG_FILE
    if not config_path.exists():
        return JSONResponse({"error": "Config not found"}, status_code=404)

    raw = _yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    servers = raw.get("mcp", {}).get("servers", {})
    if name not in servers:
        return JSONResponse({"error": f"MCP server '{name}' not found"}, status_code=404)

    del servers[name]
    save_config(raw)

    return JSONResponse({"status": "removed", "name": name})


async def api_config_update(request: Request) -> JSONResponse:
    """PUT /api/config - Update config values."""
    import yaml as _yaml

    from systemedu.core.config import CONFIG_FILE, reset_config, save_config

    body = await request.json()

    config_path = CONFIG_FILE
    raw = {}
    if config_path.exists():
        raw = _yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}

    # Merge top-level keys
    for key, value in body.items():
        if isinstance(value, dict) and isinstance(raw.get(key), dict):
            raw[key].update(value)
        else:
            raw[key] = value

    save_config(raw)

    return JSONResponse({"status": "updated"})


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
        Route("/api/config", api_config, methods=["GET"]),
        Route("/api/config", api_config_update, methods=["PUT"]),
        Route("/api/sessions", api_sessions),
        Route("/api/sessions/{id}", api_session_detail),
        Route("/api/chat", api_chat, methods=["POST"]),
        Route("/api/projects", api_projects),
        Route("/api/projects/{name}", api_project_detail),
        Route("/api/agents", api_agents),
        Route("/api/skills", api_skills),
        Route("/api/mcp/servers", api_mcp_servers, methods=["GET"]),
        Route("/api/mcp/servers", api_mcp_add, methods=["POST"]),
        Route("/api/mcp/servers/{name}", api_mcp_remove, methods=["DELETE"]),
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
