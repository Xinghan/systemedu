"""SystemEdu Gateway - HTTP + WebSocket server using Starlette."""

import argparse
import asyncio
import json
import logging
import time
from datetime import datetime
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

from systemedu.gateway.auth import (  # noqa: E402
    CREDENTIALS,
    create_token,
    require_auth,
    revoke_token,
    verify_token,
    _extract_token,
)

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


def _create_project_runtime(project_name: str, agent_name: str | None = None, user_id: str = "default"):
    """Create an AgentRuntime with full project context: skills, MCP, backend selection."""
    from systemedu.core.runtime import AgentRuntime
    from systemedu.education.project_loader import load_project_context

    ctx = load_project_context(project_name, user_id=user_id)

    # Extract project-level agent config
    agent_key = agent_name or "tutor"
    agent_config = ctx.project.agents.get(agent_key)

    # Collect skill names from project config
    skill_names = [agent_key]  # Always include the agent name as a skill
    if agent_config and agent_config.skills:
        skill_names.extend(agent_config.skills)

    # Determine LLM provider from project config
    provider = None
    if agent_config and agent_config.llm:
        provider = agent_config.llm

    # Determine backend from project config agent type
    backend = None
    if agent_config:
        # agent type "builtin:tutor" → use default; "deepagent:xxx" → use deepagents
        if agent_config.type.startswith("deepagent"):
            backend = "deepagents"

    # Load project-level MCP servers
    mcp_manager = None
    if ctx.project.mcp:
        try:
            from systemedu.mcp.manager import MCPManager

            mcp_manager = MCPManager()
            # Note: MCP servers are started asynchronously; they will be lazy-loaded
            # when tools are first accessed via _setup_mcp_tools in the runtime.
            logger.info(f"Project MCP servers configured: {list(ctx.project.mcp.keys())}")
        except Exception as e:
            logger.warning(f"Failed to init project MCP manager: {e}")

    return AgentRuntime(
        provider=provider,
        skill_names=skill_names,
        mcp_manager=mcp_manager,
        project_context=ctx,
        backend=backend,
    )


def _format_uptime(seconds: float) -> str:
    hours, remainder = divmod(int(seconds), 3600)
    minutes, secs = divmod(remainder, 60)
    if hours > 0:
        return f"{hours}h {minutes}m"
    if minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


# --- Auth Endpoints ---


async def api_auth_login(request: Request) -> JSONResponse:
    """POST /api/auth/login - Authenticate and get token."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    username = body.get("username", "")
    password = body.get("password", "")
    if CREDENTIALS.get(username) != password:
        return JSONResponse({"error": "Invalid credentials"}, status_code=401)
    token = create_token(username)
    return JSONResponse({"token": token, "username": username})


async def api_auth_logout(request: Request) -> JSONResponse:
    """POST /api/auth/logout - Revoke current token."""
    token = _extract_token(request)
    if token:
        revoke_token(token)
    return JSONResponse({"status": "ok"})


async def api_auth_me(request: Request) -> JSONResponse:
    """GET /api/auth/me - Check token validity."""
    token = _extract_token(request)
    if not token or not verify_token(token):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return JSONResponse({"username": "root", "valid": True})


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
            runtime = _create_project_runtime(project_name, agent_name, user_id)
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

    Client sends: {"message": "...", "session_id": "...", "project": "...", "agent": "..."}
    Server sends: {"type": "chunk", "content": "..."} for each chunk
                  {"type": "done", "session_id": "..."} when complete
                  {"type": "error", "message": "..."} on error
    """
    await websocket.accept()

    # Cache per-project runtimes for this WebSocket connection
    project_runtimes: dict[str, object] = {}

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "").strip()
            session_id = data.get("session_id")
            project_name = data.get("project")
            agent_name = data.get("agent")
            user_id = data.get("user_id", "default")
            node_id = data.get("node_id")  # Active learning node (optional)
            active_tab = data.get("active_tab")  # Current lesson tab (concept/examples/etc.)
            page_index = data.get("page_index")  # Current page index within tab

            if not message:
                await websocket.send_json({"type": "error", "message": "message is required"})
                continue

            # Choose runtime: project-specific or global
            runtime = _get_runtime()
            if project_name:
                cache_key = f"{project_name}:{agent_name or 'default'}"
                if cache_key not in project_runtimes:
                    try:
                        project_runtimes[cache_key] = _create_project_runtime(
                            project_name, agent_name, user_id
                        )
                    except Exception as e:
                        logger.warning(f"Failed to create project runtime: {e}")
                if cache_key in project_runtimes:
                    runtime = project_runtimes[cache_key]

            session = None
            if session_id:
                session = _get_session_manager().get_session(session_id)
            if session is None:
                session = _get_session_manager().create_session(
                    agent_name=agent_name,
                    project_name=project_name,
                )

            try:
                async for event in runtime.stream_message(message, session, user_id=user_id, node_id=node_id, active_tab=active_tab, page_index=page_index):
                    await websocket.send_json(event)
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

    from systemedu.storage.db import LocalProject, get_session as get_db_session

    # Build cover_image_url lookup from DB
    db = get_db_session()
    try:
        db_projects = {p.name: p for p in db.query(LocalProject).all()}
    finally:
        db.close()

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
                    proj_name = data.get("name", sub.name)
                    db_proj = db_projects.get(proj_name)
                    projects.append(
                        {
                            "name": proj_name,
                            "title": data.get("title", sub.name),
                            "description": data.get("description", ""),
                            "category": data.get("category", "other"),
                            "age_range": data.get("age_range", [6, 18]),
                            "estimated_hours": data.get("estimated_hours", 10),
                            "tags": data.get("tags", []),
                            "path": str(sub),
                            "cover_image_url": (db_proj.cover_image_url or "") if db_proj else "",
                        }
                    )
                except Exception as e:
                    logger.warning(f"Failed to load project {sub.name}: {e}")

    return JSONResponse(projects)


async def api_create_project(request: Request) -> JSONResponse:
    """POST /api/projects - Create a new project from uploaded knowledge tree JSON."""
    from systemedu.education.project_loader import create_project
    from systemedu.education.services import (
        convert_uploaded_tree,
        extract_project_meta,
        validate_knowledge_tree,
    )

    body = await request.json()
    name = body.get("name", "").strip()
    tree_data = body.get("tree_data")
    title = body.get("title", "")

    if not name:
        return JSONResponse({"error": "name is required"}, status_code=400)
    if not tree_data or not isinstance(tree_data, dict):
        return JSONResponse({"error": "tree_data is required and must be a JSON object"}, status_code=400)

    try:
        converted = convert_uploaded_tree(tree_data)
    except ValueError as e:
        return JSONResponse({"error": f"Format error: {e}"}, status_code=400)

    errors = validate_knowledge_tree(converted)
    if errors:
        return JSONResponse({"error": "Validation failed", "errors": errors}, status_code=400)

    meta = extract_project_meta(tree_data)
    if not title:
        title = meta.get("title", name)

    # Merge explicit meta fields from request body (override tree-extracted values)
    for key in ("description", "tags", "category", "age_range"):
        val = body.get(key)
        if val is not None:
            meta[key] = val

    try:
        project_dir = create_project(name, title, converted, meta)
    except FileExistsError as e:
        return JSONResponse({"error": str(e)}, status_code=409)

    # Auto-scan first-layer nodes and enqueue missing objects (non-fatal)
    try:
        from systemedu.education.object_scan import scan_and_enqueue_project_nodes
        enqueued = scan_and_enqueue_project_nodes(name)
        if enqueued:
            logger.info(f"Auto-enqueued {len(enqueued)} objects for {name!r}: {enqueued}")
    except Exception:
        logger.exception("Auto-enqueue scan failed (non-fatal)")

    # Trigger async cover image generation
    try:
        from systemedu.core.config import SYSTEMEDU_HOME
        from systemedu.education.image_gen import generate_project_cover
        from systemedu.storage.db import LocalProject, get_session as get_db_session

        save_path = SYSTEMEDU_HOME / "media" / "projects" / name / "cover.jpg"

        async def _gen_cover():
            ok = await generate_project_cover(title, meta.get("description", ""), save_path)
            if ok:
                cover_url = f"/api/media/projects/{name}/cover.jpg"
                db = get_db_session()
                try:
                    proj = db.query(LocalProject).filter_by(name=name).first()
                    if proj:
                        proj.cover_image_url = cover_url
                        db.commit()
                finally:
                    db.close()
                logger.info(f"Auto-generated cover for {name!r}: {cover_url}")

        asyncio.create_task(_gen_cover())
    except Exception:
        logger.exception("Auto cover generation failed (non-fatal)")

    return JSONResponse({"name": name, "created": True, "path": str(project_dir)})


async def api_preview_tree(request: Request) -> JSONResponse:
    """POST /api/projects/preview-tree - Preview/validate an uploaded knowledge tree without creating a project."""
    from systemedu.education.services import (
        convert_uploaded_tree,
        extract_project_meta,
        validate_knowledge_tree,
    )

    body = await request.json()
    tree_data = body.get("tree_data")

    if not tree_data or not isinstance(tree_data, dict):
        return JSONResponse({"error": "tree_data is required and must be a JSON object"}, status_code=400)

    try:
        converted = convert_uploaded_tree(tree_data)
    except ValueError as e:
        return JSONResponse({"error": f"Format error: {e}"}, status_code=400)

    errors = validate_knowledge_tree(converted)

    # Compute stats
    milestones = converted.get("milestones", [])
    total_nodes = sum(len(ms.get("knodes", [])) for ms in milestones)
    total_minutes = sum(
        kn.get("estimated_minutes", 15)
        for ms in milestones
        for kn in ms.get("knodes", [])
    )

    meta = extract_project_meta(tree_data)

    return JSONResponse({
        "valid": len(errors) == 0,
        "milestones": milestones,
        "stats": {
            "milestone_count": len(milestones),
            "node_count": total_nodes,
            "total_minutes": total_minutes,
            "estimated_hours": max(1, round(total_minutes / 60)),
        },
        "meta": meta,
        "errors": errors,
    })


async def api_generate_description(request: Request) -> JSONResponse:
    """POST /api/projects/generate-description - AI-generate a project description from title + age + complexity."""
    from langchain_core.messages import HumanMessage, SystemMessage
    from systemedu.core.llm_client import get_llm

    body = await request.json()
    title = body.get("title", "").strip()
    age = int(body.get("age", 9))
    node_count = int(body.get("node_count", 25))

    if not title:
        return JSONResponse({"error": "title is required"}, status_code=400)

    complexity = "入门级（核心概念，约5-50个知识节点）" if node_count <= 50 else "中等深度（系统学习，约50-200个知识节点）" if node_count <= 200 else "专家级（工业深度，200+个知识节点）"
    age_desc = "6岁以下儿童" if age < 6 else f"{age}岁左右的学生"

    prompt = (
        f"请为一个名为《{title}》的学习项目生成内容，目标学生是{age_desc}，课程深度为{complexity}。\n\n"
        f"请严格按照以下JSON格式输出，不要输出任何其他内容：\n"
        f'{{"description": "100-150字的项目描述，说明学什么、能学到什么、为什么有趣，语言生动自然", '
        f'"tags": ["标签1", "标签2", "标签3", "标签4"]}}\n\n'
        f"标签要求：3-5个简短标签（2-6字），反映学科领域、技能或特色，例如：编程思维、数学建模、实验探究等。"
    )

    try:
        import json as json_lib
        llm = get_llm(streaming=False)
        response = await llm.ainvoke([
            SystemMessage(content="你是一名教育内容策划专家。严格按照要求的JSON格式输出，不添加任何额外文字。"),
            HumanMessage(content=prompt),
        ])
        content = response.content.strip()
        # 尝试解析JSON，提取 description 和 tags
        try:
            # 去掉可能的 markdown 代码块
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            parsed = json_lib.loads(content)
            description = parsed.get("description", "").strip()
            tags = parsed.get("tags", [])
            if not isinstance(tags, list):
                tags = []
        except Exception:
            # 解析失败时把整个内容当描述
            description = content
            tags = []
        return JSONResponse({"description": description, "tags": tags})
    except Exception as e:
        logger.error(f"Description generation failed: {e}")
        return JSONResponse({"error": f"生成失败: {e}"}, status_code=500)


async def api_generate_tree(request: Request) -> JSONResponse:
    """POST /api/projects/generate-tree - AI-generate a knowledge tree from title + description."""
    from systemedu.education.tree_generator import generate_knowledge_tree

    body = await request.json()
    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    age = body.get("age", 12)
    node_count = max(5, min(500, int(body.get("node_count", 20))))

    if not title or not description:
        return JSONResponse(
            {"error": "title and description are required"}, status_code=400
        )

    try:
        tree = await generate_knowledge_tree(title, description, user_age=age, target_nodes=node_count)
    except Exception as e:
        logger.error(f"AI tree generation failed: {e}")
        return JSONResponse(
            {"error": f"AI 生成失败: {e}"}, status_code=500
        )

    milestones = [ms.model_dump() for ms in tree.milestones]
    total_nodes = sum(len(ms.get("knodes", [])) for ms in milestones)
    total_minutes = sum(
        kn.get("estimated_minutes", 15)
        for ms in milestones
        for kn in ms.get("knodes", [])
    )

    return JSONResponse({
        "valid": True,
        "milestones": milestones,
        "stats": {
            "milestone_count": len(milestones),
            "node_count": total_nodes,
            "total_minutes": total_minutes,
            "estimated_hours": max(1, round(total_minutes / 60)),
        },
        "meta": {"title": title, "description": description},
        "errors": [],
    })


async def api_project_detail(request: Request) -> JSONResponse:
    """GET /api/projects/{name} - Project detail with tree and progress."""
    name = request.path_params["name"]
    try:
        from systemedu.education.project_loader import load_project_context

        ctx = load_project_context(name)

        # Serialize tree — use global sequential id so knode.id is unique across all milestones
        milestones = []
        global_idx = 0
        for ms in ctx.tree.milestones:
            knodes_serialized = []
            for node in ms.knodes:
                knodes_serialized.append(
                    {
                        "id": global_idx,
                        "title": node.title,
                        "summary": node.summary,
                        "difficulty_level": node.difficulty_level,
                        "content_type": node.content_type.value,
                        "acceptance_type": node.acceptance_type.value,
                        "estimated_minutes": node.estimated_minutes,
                        "xp_reward": node.xp_reward,
                        "prerequisite_indices": node.prerequisite_indices,
                    }
                )
                global_idx += 1
            milestones.append(
                {
                    "title": ms.title,
                    "description": ms.description,
                    "order": ms.order,
                    "xp_reward": ms.xp_reward,
                    "knodes": knodes_serialized,
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

        # Fetch enrollment if exists
        from systemedu.storage.db import Enrollment, get_session as get_db_session

        enrollment_data = None
        db = get_db_session()
        try:
            enrollment = (
                db.query(Enrollment)
                .filter_by(user_id="default", project_name=name)
                .first()
            )
            if enrollment:
                enrollment_data = {
                    "status": enrollment.status,
                    "started_at": enrollment.started_at.isoformat() if enrollment.started_at else None,
                    "last_activity_at": enrollment.last_activity_at.isoformat() if enrollment.last_activity_at else None,
                    "total_time_seconds": enrollment.total_time_seconds,
                    "nodes_passed": enrollment.nodes_passed,
                    "total_nodes": enrollment.total_nodes,
                }
        finally:
            db.close()

        # Fetch cover_image_url from DB
        from systemedu.storage.db import LocalProject, get_session as get_db_session

        cover_url = ""
        _db = get_db_session()
        try:
            _db_proj = _db.query(LocalProject).filter_by(name=name).first()
            if _db_proj:
                cover_url = _db_proj.cover_image_url or ""
        finally:
            _db.close()

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
                    "cover_image_url": cover_url,
                },
                "milestones": milestones,
                "progress": progress,
                "enrollment": enrollment_data,
            }
        )
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)
    except Exception as e:
        logger.exception(f"Failed to load project {name}")
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_update_project(request: Request) -> JSONResponse:
    """PATCH /api/projects/{name} - Update project metadata (title, description, etc.)."""
    from systemedu.education.project_loader import find_project_dir

    name = request.path_params["name"]
    try:
        project_dir = find_project_dir(name)
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    # Load current project.yaml
    import yaml as _yaml
    yaml_path = project_dir / "project.yaml"
    data = _yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}

    # Apply only allowed fields
    allowed = {"title", "description", "category", "age_range", "estimated_hours", "tags", "author"}
    for key in allowed:
        if key in body:
            data[key] = body[key]

    # Write back
    yaml_path.write_text(_yaml.dump(data, allow_unicode=True, default_flow_style=False), encoding="utf-8")

    return JSONResponse({"name": name, "updated": True})


async def api_delete_project(request: Request) -> JSONResponse:
    """DELETE /api/projects/{name} - Delete a project and all associated data."""
    import shutil
    from systemedu.education.project_loader import find_project_dir
    from systemedu.storage.db import (
        LocalProject, ProgressRecord, NodeContextCache, Enrollment,
        Highlight, PracticeSubmission, LessonGenerationProgress, LessonContent,
        NodeResource, NodeSearchStatus, LessonQueueItem, UserNote,
        get_session as get_db_session,
    )

    name = request.path_params["name"]

    # Locate project directory (may not exist if only in DB)
    project_dir: Path | None = None
    try:
        project_dir = find_project_dir(name)
    except FileNotFoundError:
        pass

    db = get_db_session()
    try:
        # Check project exists in DB
        proj = db.query(LocalProject).filter_by(name=name).first()
        if proj is None and project_dir is None:
            return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)

        # Cascade-delete all related records
        for model in (
            ProgressRecord, NodeContextCache, Enrollment, Highlight,
            PracticeSubmission, LessonGenerationProgress, LessonContent,
            NodeResource, NodeSearchStatus, LessonQueueItem, UserNote,
        ):
            db.query(model).filter_by(project_name=name).delete(synchronize_session=False)

        if proj:
            db.delete(proj)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[api_delete_project] DB error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()

    # Delete project directory from disk
    if project_dir and project_dir.exists():
        try:
            shutil.rmtree(project_dir)
        except Exception as e:
            logger.warning(f"[api_delete_project] Failed to delete directory {project_dir}: {e}")

    logger.info(f"[api_delete_project] Deleted project '{name}'")
    return JSONResponse({"status": "deleted", "name": name})


async def api_project_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/PATCH/DELETE /api/projects/{name}."""
    if request.method == "GET":
        return await api_project_detail(request)
    if request.method == "PATCH":
        return await api_update_project(request)
    if request.method == "DELETE":
        return await api_delete_project(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_projects_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/POST /api/projects."""
    if request.method == "GET":
        return await api_projects(request)
    if request.method == "POST":
        return await api_create_project(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_enrollment_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/PATCH /api/projects/{name}/enrollment."""
    if request.method == "GET":
        return await api_get_enrollment(request)
    if request.method == "PATCH":
        return await api_update_enrollment(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_lessons_queue_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/DELETE /api/projects/{name}/lessons/queue."""
    if request.method == "GET":
        return await api_get_lesson_queue(request)
    if request.method == "DELETE":
        return await api_cancel_lesson_queue(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_highlights_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/POST /api/projects/{name}/nodes/{node_id}/highlights."""
    if request.method == "GET":
        return await api_get_highlights(request)
    if request.method == "POST":
        return await api_create_highlight(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_resources_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/POST /api/projects/{name}/nodes/{node_id}/resources."""
    if request.method == "GET":
        return await api_get_resources(request)
    if request.method == "POST":
        return await api_add_resource(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_note_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/PUT /api/projects/{name}/nodes/{node_id}/note."""
    if request.method == "GET":
        return await api_get_note(request)
    if request.method == "PUT":
        return await api_upsert_note(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_mcp_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/POST /api/mcp/servers."""
    if request.method == "GET":
        return await api_mcp_servers(request)
    if request.method == "POST":
        return await api_mcp_add(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_upload_project_cover(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/cover - Upload a cover image for a project."""
    from systemedu.core.config import SYSTEMEDU_HOME
    from systemedu.storage.db import LocalProject, get_session as get_db_session

    name = request.path_params["name"]

    try:
        form = await request.form()
        file_field = form.get("file")
        if file_field is None or not hasattr(file_field, "read"):
            return JSONResponse({"error": "No file provided"}, status_code=400)

        content = await file_field.read()
        filename = getattr(file_field, "filename", "cover.jpg") or "cover.jpg"
        ext = Path(filename).suffix.lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"

        save_path = SYSTEMEDU_HOME / "media" / "projects" / name / f"cover{ext}"
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_bytes(content)

        cover_url = f"/api/media/projects/{name}/cover{ext}"

        db = get_db_session()
        try:
            proj = db.query(LocalProject).filter_by(name=name).first()
            if proj:
                proj.cover_image_url = cover_url
                db.commit()
        finally:
            db.close()

        return JSONResponse({"url": cover_url})
    except Exception as e:
        logger.exception(f"Cover upload failed for {name}")
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_generate_cover_preview(request: Request) -> JSONResponse:
    """POST /api/projects/generate-cover-preview - Generate a cover image immediately and return the URL.

    Used in the new-project form before the project is created.
    Saves to a temp path and returns a media URL for preview.
    """
    from systemedu.core.config import SYSTEMEDU_HOME
    from systemedu.education.image_gen import generate_project_cover

    body = await request.json()
    title = body.get("title", "").strip()
    description = body.get("description", "").strip()

    if not title:
        return JSONResponse({"error": "title is required"}, status_code=400)

    # Save to a predictable temp path based on title slug
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "preview"
    save_path = SYSTEMEDU_HOME / "media" / "_preview" / f"{slug}.jpg"

    ok = await generate_project_cover(title, description, save_path)
    if not ok:
        return JSONResponse({"error": "Cover generation failed. Check your DashScope API key and try again."}, status_code=500)

    cover_url = f"/api/media/_preview/{slug}.jpg"
    return JSONResponse({"url": cover_url})


async def api_generate_project_cover(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/cover/generate - Trigger async AI cover image generation."""
    from systemedu.core.config import SYSTEMEDU_HOME
    from systemedu.education.image_gen import generate_project_cover
    from systemedu.storage.db import LocalProject, get_session as get_db_session

    name = request.path_params["name"]

    # Load project info for prompt
    try:
        from systemedu.education.project_loader import find_project_dir
        import yaml as _yaml
        project_dir = find_project_dir(name)
        yaml_data = _yaml.safe_load((project_dir / "project.yaml").read_text(encoding="utf-8")) or {}
        title = yaml_data.get("title", name)
        description = yaml_data.get("description", "")
    except Exception:
        title = name
        description = ""

    save_path = SYSTEMEDU_HOME / "media" / "projects" / name / "cover.jpg"

    async def _bg_generate():
        ok = await generate_project_cover(title, description, save_path)
        if ok:
            cover_url = f"/api/media/projects/{name}/cover.jpg"
            db = get_db_session()
            try:
                proj = db.query(LocalProject).filter_by(name=name).first()
                if proj:
                    proj.cover_image_url = cover_url
                    db.commit()
                else:
                    new_proj = LocalProject(
                        name=name,
                        title=title,
                        description=description,
                        path=str(save_path.parent.parent),
                        category="other",
                        cover_image_url=cover_url,
                    )
                    db.add(new_proj)
                    db.commit()
            finally:
                db.close()
            logger.info(f"Cover generated and saved for {name!r}: {cover_url}")

    asyncio.create_task(_bg_generate())
    return JSONResponse({"status": "generating", "name": name})


async def api_objects_registry(request: Request) -> JSONResponse:
    """GET /api/objects/registry - Return all objects in ObjectRegistry with metadata."""
    from systemedu.agents.builtin.gameagent.objects import ObjectRegistry

    keys = ObjectRegistry.supported_keys()
    items = []
    for key in keys:
        meta = ObjectRegistry.get_meta(key)
        family = key.split(".")[0]
        variant = key.split(".", 1)[1] if "." in key else key
        items.append({
            "object_key": key,
            "family": family,
            "variant": variant,
            "views": meta.get("views", []),
            "must_have": meta.get("must_have", []),
            "optional": meta.get("optional", []),
            "labelable": meta.get("labelable", []),
            "source": "registry",
        })

    # Also include done items from FactoryQueue (promoted to registry)
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue
    queue = FactoryQueue()
    staging_items = []
    for item in queue.all_items():
        if item.status in ("pending", "in_progress", "done", "failed"):
            family = item.object_key.split(".")[0]
            variant = item.object_key.split(".", 1)[1] if "." in item.object_key else item.object_key
            staging_items.append({
                "object_key": item.object_key,
                "family": family,
                "variant": variant,
                "status": item.status,
                "source": "factory_queue",
                "project_name": item.project_name,
                "created_at": item.created_at,
                "error": item.error,
            })

    # Deduplicate: remove staging items already in registry
    registry_keys = {i["object_key"] for i in items}
    staging_items = [i for i in staging_items if i["object_key"] not in registry_keys]

    return JSONResponse({
        "registry": items,
        "staging": staging_items,
        "total_registry": len(items),
        "total_staging": len(staging_items),
    })


async def api_objects_queue(request: Request) -> JSONResponse:
    """GET /api/objects/queue - Return FactoryQueue items, optionally filtered by project."""
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue

    queue = FactoryQueue()
    project_filter = request.query_params.get("project", "").strip()

    if project_filter:
        items = queue.items_for_project(project_filter)
    else:
        items = queue.all_items()

    return JSONResponse(
        {
            "items": [i.model_dump() for i in items],
            "stats": queue.stats(),
        }
    )


async def api_objects_queue_add(request: Request) -> JSONResponse:
    """POST /api/objects/queue/add - Manually add an item to FactoryQueue."""
    from systemedu.agents.builtin.gameagent.object_factory import (
        FactoryQueue,
        FactoryQueueItem,
    )

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    object_key = body.get("object_key", "").strip()
    if not object_key:
        return JSONResponse({"error": "object_key is required"}, status_code=400)

    item = FactoryQueueItem(
        object_key=object_key,
        description=body.get("description", ""),
        source="manual",
        project_name=body.get("project_name", ""),
    )

    queue = FactoryQueue()
    added = queue.enqueue(item)
    return JSONResponse({"object_key": object_key, "added": added})


async def api_objects_queue_trigger(request: Request) -> JSONResponse:
    """POST /api/objects/queue/trigger - Trigger factory pipeline for pending/failed items.

    Query params:
      project=name   filter by project
      retry_failed=1 also retry failed items (reset to pending first)
    """
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue
    from systemedu.education.object_scan import trigger_factory_for_keys

    project_filter = request.query_params.get("project", "").strip()
    retry_failed = request.query_params.get("retry_failed", "0") == "1"
    queue = FactoryQueue()

    items = queue.items_for_project(project_filter) if project_filter else queue.all_items()

    # Optionally reset failed items so they can be re-triggered
    if retry_failed:
        for item in items:
            if item.status == "failed":
                # Reset by re-writing with pending status
                from systemedu.agents.builtin.gameagent.object_factory import FactoryQueueItem
                all_items = queue.all_items()
                for qi in all_items:
                    if qi.object_key == item.object_key and qi.status == "failed":
                        qi.status = "pending"
                        qi.error = ""
                queue._write_all(all_items)

    to_trigger = [(i.object_key, i.description) for i in queue.all_items()
                  if i.status == "pending"
                  and (not project_filter or i.project_name == project_filter)]

    if not to_trigger:
        return JSONResponse({"triggered": 0, "message": "no pending items"})

    trigger_factory_for_keys(to_trigger)
    return JSONResponse({"triggered": len(to_trigger), "object_keys": [k for k, _ in to_trigger]})


async def api_update_tree(request: Request) -> JSONResponse:
    """PUT /api/projects/{name}/tree - Full-replace the knowledge_tree.json for a project."""
    from systemedu.education.project_loader import find_project_dir
    from systemedu.education.services import validate_knowledge_tree

    name = request.path_params["name"]
    try:
        project_dir = find_project_dir(name)
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    milestones_data = body.get("milestones")
    if not isinstance(milestones_data, list):
        return JSONResponse({"error": "milestones must be a list"}, status_code=400)

    tree_dict = {"milestones": milestones_data}
    errors = validate_knowledge_tree(tree_dict)
    if errors:
        return JSONResponse({"error": errors[0]}, status_code=422)

    tree_path = project_dir / "knowledge_tree.json"
    tree_path.write_text(
        json.dumps(tree_dict, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return JSONResponse({"ok": True, "milestones": milestones_data})


async def api_node_context(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/context - AI-generated node knowledge context."""
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    from systemedu.storage.db import NodeContextCache, get_session as get_db_session

    # Check cache first
    db = get_db_session()
    try:
        cached = (
            db.query(NodeContextCache)
            .filter_by(project_name=name, knode_id=node_id)
            .first()
        )
        if cached:
            return JSONResponse(
                {
                    "knode_id": cached.knode_id,
                    "prerequisites_trace": cached.prerequisites_trace,
                    "learning_suggestions": cached.learning_suggestions,
                    "related_extensions": cached.related_extensions,
                }
            )
    finally:
        db.close()

    # Generate with LLM
    try:
        from systemedu.education.project_loader import load_project_context

        ctx = load_project_context(name)

        # Find the target node
        target_node = None
        target_milestone = None
        global_idx = 0
        for ms in ctx.tree.milestones:
            for knode in ms.knodes:
                if global_idx == node_id:
                    target_node = knode
                    target_milestone = ms
                    break
                global_idx += 1
            if target_node:
                break

        if not target_node:
            return JSONResponse({"error": "Node not found"}, status_code=404)

        # Build prerequisite names
        all_knodes = []
        for ms in ctx.tree.milestones:
            all_knodes.extend(ms.knodes)
        prereq_names = [
            all_knodes[i].title
            for i in target_node.prerequisite_indices
            if i < len(all_knodes)
        ]

        prompt = (
            f"你是一个教育 AI 助手。请为以下知识节点生成知识脉络分析。\n\n"
            f"节点标题：{target_node.title}\n"
            f"节点简介：{target_node.summary}\n"
            f"所属里程碑：{target_milestone.title}\n"
            f"前置节点：{', '.join(prereq_names) if prereq_names else '无'}\n"
            f"难度等级：{target_node.difficulty_level}/10\n\n"
            f"请严格按照以下格式输出，每段不超过 200 字：\n\n"
            f"[前置知识追溯]\n"
            f"（追溯这个节点需要的基础知识，梳理知识来龙去脉）\n\n"
            f"[学习建议]\n"
            f"（给出具体的学习方法和步骤建议）\n\n"
            f"[拓展方向]\n"
            f"（推荐相关的延伸学习方向和高阶主题）"
        )

        from systemedu.core.llm_client import get_llm

        llm = get_llm(streaming=False)
        from langchain_core.messages import HumanMessage

        response = llm.invoke([HumanMessage(content=prompt)])
        text = response.content

        # Parse the three sections
        sections = {"prerequisites_trace": "", "learning_suggestions": "", "related_extensions": ""}
        markers = [
            ("[前置知识追溯]", "prerequisites_trace"),
            ("[学习建议]", "learning_suggestions"),
            ("[拓展方向]", "related_extensions"),
        ]

        for i, (marker, key) in enumerate(markers):
            start = text.find(marker)
            if start == -1:
                continue
            start += len(marker)
            # Find the end: next marker or end of text
            end = len(text)
            for j in range(i + 1, len(markers)):
                next_start = text.find(markers[j][0])
                if next_start != -1:
                    end = next_start
                    break
            sections[key] = text[start:end].strip()

        # If parsing failed, put everything in prerequisites_trace
        if not any(sections.values()):
            sections["prerequisites_trace"] = text.strip()

        # Cache the result
        db = get_db_session()
        try:
            cache_entry = NodeContextCache(
                project_name=name,
                knode_id=node_id,
                prerequisites_trace=sections["prerequisites_trace"],
                learning_suggestions=sections["learning_suggestions"],
                related_extensions=sections["related_extensions"],
            )
            db.add(cache_entry)
            db.commit()
        finally:
            db.close()

        return JSONResponse(
            {
                "knode_id": node_id,
                **sections,
            }
        )

    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)
    except Exception as e:
        logger.exception(f"Failed to generate node context for {name}/{node_id}")
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_node_lesson(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/lesson - Get lesson content."""
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    from systemedu.storage.db import LessonContent, get_session as get_db_session

    db = get_db_session()
    try:
        lesson = (
            db.query(LessonContent)
            .filter_by(project_name=name, knode_id=node_id)
            .first()
        )
        if lesson:
            from systemedu.education.lesson_generator import _lesson_to_dict

            return JSONResponse(_lesson_to_dict(lesson))
        else:
            return JSONResponse(
                {
                    "project_name": name,
                    "knode_id": node_id,
                    "status": "pending",
                    "concept": "",
                    "examples": "",
                    "code_samples": "",
                    "practice": "",
                    "key_takeaways": "",
                    "quiz_data": "[]",
                    "interactive_lab": "",
                    "teacher_script": "",
                    "teacher_audio_url": "",
                    "teacher_timestamps": "[]",
                    "project_assignment": "",
                    "content_type": "text",
                    "generated_at": None,
                }
            )
    finally:
        db.close()


def _run_lesson_generation(name: str, node_id: int):
    """Run lesson generation in a background thread. Errors are caught and logged."""
    import asyncio
    try:
        from systemedu.education.lesson_generator import generate_lesson
        asyncio.run(generate_lesson(name, node_id))
        logger.info(f"Background lesson generation completed: {name}/{node_id}")
    except Exception:
        logger.exception(f"Background lesson generation failed: {name}/{node_id}")
        # Mark lesson as failed in DB so frontend can detect it
        from systemedu.storage.db import LessonContent, get_session as get_db_session
        db = get_db_session()
        try:
            lesson = db.query(LessonContent).filter_by(project_name=name, knode_id=node_id).first()
            if lesson:
                lesson.status = "failed"
                db.commit()
        finally:
            db.close()


# Track in-flight generation tasks to prevent duplicates
_generation_tasks: dict[str, bool] = {}

# Track in-flight resource search tasks
_search_tasks: dict[str, bool] = {}

# Track in-flight batch lesson generation tasks (project_name -> True)
_lesson_queue_tasks: dict[str, bool] = {}


async def api_generate_lesson(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/lesson/generate - Trigger async lesson generation.

    Returns immediately with status "generating". Frontend should poll progress endpoint.
    """
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    regenerate = body.get("regenerate", False)

    from systemedu.storage.db import LessonContent, get_session as get_db_session

    # Check if already generated (unless regenerate requested)
    if not regenerate:
        db = get_db_session()
        try:
            existing = (
                db.query(LessonContent)
                .filter_by(project_name=name, knode_id=node_id)
                .first()
            )
            if existing and existing.status == "ready":
                from systemedu.education.lesson_generator import _lesson_to_dict

                return JSONResponse(_lesson_to_dict(existing))
        finally:
            db.close()

    # Prevent duplicate generation
    task_key = f"{name}/{node_id}"
    if _generation_tasks.get(task_key):
        return JSONResponse({"status": "generating", "project_name": name, "knode_id": node_id})

    # Launch generation in background thread
    import threading
    _generation_tasks[task_key] = True

    def _run_and_cleanup():
        try:
            _run_lesson_generation(name, node_id)
        finally:
            _generation_tasks.pop(task_key, None)

    thread = threading.Thread(target=_run_and_cleanup, daemon=True)
    thread.start()

    # Trigger object scan for this node (fire-and-forget, non-blocking)
    try:
        from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes
        scan_and_enqueue_unlocked_nodes(name, [node_id])
    except Exception:
        logger.exception("api_generate_lesson: object scan failed (non-fatal)")

    return JSONResponse({"status": "generating", "project_name": name, "knode_id": node_id})


async def api_lesson_progress(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/lesson/progress - Get lesson generation pipeline progress.

    Returns steps array plus lesson_status to indicate overall completion.
    """
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    from systemedu.storage.db import LessonContent, LessonGenerationProgress, get_session as get_db_session

    db = get_db_session()
    try:
        records = (
            db.query(LessonGenerationProgress)
            .filter_by(project_name=name, knode_id=node_id)
            .order_by(LessonGenerationProgress.id)
            .all()
        )
        # Also check lesson status for completion detection
        lesson = (
            db.query(LessonContent)
            .filter_by(project_name=name, knode_id=node_id)
            .first()
        )
        lesson_status = lesson.status if lesson else "pending"

        return JSONResponse({
            "lesson_status": lesson_status,
            "steps": [
                {
                    "step_name": r.step_name,
                    "step_label": r.step_label,
                    "status": r.status,
                    "agent_name": r.agent_name or "",
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "output_preview": r.output_preview or "",
                }
                for r in records
            ],
        })
    finally:
        db.close()


async def api_update_progress(request: Request) -> JSONResponse:
    """PATCH /api/projects/{name}/nodes/{node_id}/progress - Update node progress status."""
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    body = await request.json()
    new_status = body.get("status")
    if not new_status:
        return JSONResponse({"error": "status is required"}, status_code=400)

    valid_statuses = {"locked", "available", "in_progress", "submitted", "passed", "failed"}
    if new_status not in valid_statuses:
        return JSONResponse({"error": f"Invalid status. Must be one of: {valid_statuses}"}, status_code=400)

    user_id = body.get("user_id", "default")

    from systemedu.storage.db import ProgressRecord, get_session as get_db_session

    db = get_db_session()
    try:
        record = (
            db.query(ProgressRecord)
            .filter_by(user_id=user_id, project_name=name, knode_id=node_id)
            .first()
        )
        if record is None:
            record = ProgressRecord(
                user_id=user_id,
                project_name=name,
                knode_id=node_id,
                status=new_status,
            )
            db.add(record)
        else:
            record.status = new_status
            if new_status == "passed":
                from datetime import datetime

                record.passed_at = datetime.now()
        db.commit()

        # When a node is passed, unlock dependent nodes and sync enrollment
        unlocked_ids: list[int] = []
        if new_status == "passed":
            from systemedu.education.project_loader import load_project_context, save_progress
            from systemedu.education.progress import unlock_next_nodes
            from systemedu.storage.db import Enrollment

            try:
                ctx = load_project_context(name, user_id=user_id)
                unlocked_ids = unlock_next_nodes(ctx.tree, ctx.progress, node_id)
                if unlocked_ids:
                    save_progress(user_id, name, ctx.progress)
            except Exception:
                logger.exception("Failed to unlock next nodes")

            # Scan newly unlocked nodes for missing objects and trigger factory
            if unlocked_ids:
                try:
                    from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes
                    scan_and_enqueue_unlocked_nodes(name, unlocked_ids)
                except Exception:
                    logger.exception("Failed to scan unlocked nodes for object factory (non-fatal)")

            enrollment = (
                db.query(Enrollment)
                .filter_by(user_id=user_id, project_name=name)
                .first()
            )
            if enrollment:
                from datetime import datetime as dt

                passed_count = (
                    db.query(ProgressRecord)
                    .filter_by(user_id=user_id, project_name=name, status="passed")
                    .count()
                )
                enrollment.nodes_passed = passed_count
                enrollment.last_activity_at = dt.now()
                if enrollment.total_nodes > 0 and passed_count >= enrollment.total_nodes:
                    enrollment.status = "completed"
                db.commit()

        # Return full progress list so frontend can update all nodes
        all_records = (
            db.query(ProgressRecord)
            .filter_by(user_id=user_id, project_name=name)
            .order_by(ProgressRecord.knode_id)
            .all()
        )
        progress_list = [
            {
                "knode_id": r.knode_id,
                "status": r.status,
                "attempts": r.attempts,
                "best_score": r.best_score,
                "passed_at": r.passed_at.isoformat() if r.passed_at else None,
            }
            for r in all_records
        ]

        return JSONResponse(
            {
                "knode_id": node_id,
                "status": record.status,
                "attempts": record.attempts,
                "best_score": record.best_score,
                "unlocked": unlocked_ids,
                "progress": progress_list,
            }
        )
    finally:
        db.close()


async def api_enroll(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/enroll - Enroll in a project (start learning)."""
    from datetime import datetime

    from systemedu.storage.db import Enrollment, get_session as get_db_session

    name = request.path_params["name"]
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    user_id = body.get("user_id", "default")

    # Count total nodes for this project
    total_nodes = 0
    try:
        from systemedu.education.project_loader import load_project_context

        ctx = load_project_context(name)
        for ms in ctx.tree.milestones:
            total_nodes += len(ms.knodes)
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)
    except Exception:
        pass

    db = get_db_session()
    try:
        enrollment = (
            db.query(Enrollment)
            .filter_by(user_id=user_id, project_name=name)
            .first()
        )
        now = datetime.now()
        if enrollment is None:
            enrollment = Enrollment(
                user_id=user_id,
                project_name=name,
                status="active",
                started_at=now,
                last_activity_at=now,
                total_nodes=total_nodes,
            )
            db.add(enrollment)
        else:
            enrollment.status = "active"
            enrollment.last_activity_at = now
            if not enrollment.started_at:
                enrollment.started_at = now
            if total_nodes > 0:
                enrollment.total_nodes = total_nodes
        db.commit()
        return JSONResponse({
            "status": enrollment.status,
            "started_at": enrollment.started_at.isoformat() if enrollment.started_at else None,
            "last_activity_at": enrollment.last_activity_at.isoformat() if enrollment.last_activity_at else None,
            "total_time_seconds": enrollment.total_time_seconds,
            "nodes_passed": enrollment.nodes_passed,
            "total_nodes": enrollment.total_nodes,
        })
    finally:
        db.close()


async def api_get_enrollment(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/enrollment - Get enrollment status."""
    from systemedu.storage.db import Enrollment, get_session as get_db_session

    name = request.path_params["name"]
    user_id = request.query_params.get("user_id", "default")

    db = get_db_session()
    try:
        enrollment = (
            db.query(Enrollment)
            .filter_by(user_id=user_id, project_name=name)
            .first()
        )
        if enrollment is None:
            return JSONResponse(None)
        return JSONResponse({
            "status": enrollment.status,
            "started_at": enrollment.started_at.isoformat() if enrollment.started_at else None,
            "last_activity_at": enrollment.last_activity_at.isoformat() if enrollment.last_activity_at else None,
            "total_time_seconds": enrollment.total_time_seconds,
            "nodes_passed": enrollment.nodes_passed,
            "total_nodes": enrollment.total_nodes,
        })
    finally:
        db.close()


async def api_update_enrollment(request: Request) -> JSONResponse:
    """PATCH /api/projects/{name}/enrollment - Update enrollment (add time, pause/resume)."""
    from datetime import datetime

    from systemedu.storage.db import Enrollment, get_session as get_db_session

    name = request.path_params["name"]
    body = await request.json()
    user_id = body.get("user_id", "default")

    db = get_db_session()
    try:
        enrollment = (
            db.query(Enrollment)
            .filter_by(user_id=user_id, project_name=name)
            .first()
        )
        if enrollment is None:
            return JSONResponse({"error": "Not enrolled"}, status_code=404)

        add_time = body.get("add_time_seconds", 0)
        if add_time > 0:
            enrollment.total_time_seconds = (enrollment.total_time_seconds or 0) + add_time

        new_status = body.get("status")
        if new_status in ("active", "paused", "completed"):
            enrollment.status = new_status

        enrollment.last_activity_at = datetime.now()
        db.commit()

        return JSONResponse({
            "status": enrollment.status,
            "started_at": enrollment.started_at.isoformat() if enrollment.started_at else None,
            "last_activity_at": enrollment.last_activity_at.isoformat() if enrollment.last_activity_at else None,
            "total_time_seconds": enrollment.total_time_seconds,
            "nodes_passed": enrollment.nodes_passed,
            "total_nodes": enrollment.total_nodes,
        })
    finally:
        db.close()


async def api_sessions_full(request: Request) -> JSONResponse:
    """GET /api/sessions/full - List sessions with full message history (for chat hydration)."""
    sessions = _get_session_manager().list_sessions()
    # Sort by created_at desc, limit to most recent 50
    sessions.sort(key=lambda s: s.created_at, reverse=True)
    sessions = sessions[:50]

    return JSONResponse([
        {
            "id": s.id,
            "agent": s.agent_name,
            "project": s.project_name,
            "created_at": s.created_at.isoformat(),
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "timestamp": m.timestamp.isoformat(),
                }
                for m in s.messages
                if m.role in ("user", "assistant")
            ],
        }
        for s in sessions
        if any(m.role in ("user", "assistant") for m in s.messages)
    ])


async def api_agents(request: Request) -> JSONResponse:
    """GET /api/agents - List available agent types."""
    agents = [
        {
            "name": "tutor",
            "type": "builtin:tutor",
            "description": "AI 导师「小龟老师」— 引导式教学，辅助项目学习",
            "display_name": "小龟老师",
            "role": "tutor",
        },
        {
            "name": "teacher",
            "type": "builtin:teacher",
            "description": "AI 课堂老师「星星老师」— 系统讲解知识点",
            "display_name": "星星老师",
            "role": "teacher",
        },
        {
            "name": "student",
            "type": "builtin:student",
            "description": "AI 同学「小豆同学」— 一起讨论学习",
            "display_name": "小豆同学",
            "role": "student",
        },
        {
            "name": "planner",
            "type": "builtin:planner",
            "description": "知识树规划器 — 生成项目知识树",
            "display_name": "规划器",
            "role": "system",
        },
        {
            "name": "assessor",
            "type": "builtin:assessor",
            "description": "知识评估器 — 评估学习成果",
            "display_name": "评估器",
            "role": "system",
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

    # Resume any pending FactoryQueue items from previous sessions (non-fatal)
    try:
        from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue
        from systemedu.education.object_scan import trigger_factory_for_keys

        queue = FactoryQueue()
        # Reset stale in_progress items (crashed mid-run) back to pending
        for item in queue.all_items():
            if item.status == "in_progress":
                queue.mark_failed(item.object_key, error="reset: server restarted mid-run")

        pending = queue.pending_items()
        if pending:
            logger.info(f"Startup: resuming {len(pending)} pending factory queue items")
            trigger_factory_for_keys([(i.object_key, i.description) for i in pending])
    except Exception:
        logger.exception("Startup factory queue resume failed (non-fatal)")


async def api_get_highlights(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/highlights - List highlights for a node."""
    from systemedu.storage.db import Highlight, get_session as get_db_session

    project_name = request.path_params["name"]
    node_id = request.path_params["node_id"]
    user_id = request.query_params.get("user_id", "default")

    db = get_db_session()
    try:
        highlights = (
            db.query(Highlight)
            .filter_by(user_id=user_id, project_name=project_name, knode_id=node_id)
            .order_by(Highlight.tab, Highlight.page_index, Highlight.start_offset)
            .all()
        )
        return JSONResponse([
            {
                "id": h.id,
                "tab": h.tab,
                "page_index": h.page_index,
                "text": h.text,
                "start_offset": h.start_offset,
                "end_offset": h.end_offset,
                "note": h.note,
                "color": h.color,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in highlights
        ])
    finally:
        db.close()


async def api_create_highlight(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/highlights - Create a highlight."""
    from systemedu.storage.db import Highlight, get_session as get_db_session

    project_name = request.path_params["name"]
    node_id = request.path_params["node_id"]
    body = await request.json()

    db = get_db_session()
    try:
        h = Highlight(
            user_id=body.get("user_id", "default"),
            project_name=project_name,
            knode_id=node_id,
            tab=body["tab"],
            page_index=body.get("page_index", 0),
            text=body["text"],
            start_offset=body["start_offset"],
            end_offset=body["end_offset"],
            note=body.get("note", ""),
            color=body.get("color", "yellow"),
        )
        db.add(h)
        db.commit()
        db.refresh(h)
        return JSONResponse(
            {
                "id": h.id,
                "tab": h.tab,
                "page_index": h.page_index,
                "text": h.text,
                "start_offset": h.start_offset,
                "end_offset": h.end_offset,
                "note": h.note,
                "color": h.color,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            },
            status_code=201,
        )
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        db.close()


async def api_delete_highlight(request: Request) -> JSONResponse:
    """DELETE /api/projects/{name}/nodes/{node_id}/highlights/{highlight_id} - Delete a highlight."""
    from systemedu.storage.db import Highlight, get_session as get_db_session

    highlight_id = request.path_params["highlight_id"]

    db = get_db_session()
    try:
        h = db.query(Highlight).filter_by(id=highlight_id).first()
        if not h:
            return JSONResponse({"error": "Not found"}, status_code=404)
        db.delete(h)
        db.commit()
        return JSONResponse({"status": "deleted", "id": highlight_id})
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=400)
    finally:
        db.close()


async def api_submit_practice(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/practice/submit - Submit and grade practice."""
    from systemedu.storage.db import LessonContent, PracticeSubmission, get_session as get_db_session

    name = request.path_params["name"]
    node_id = request.path_params["node_id"]

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    user_answers = body.get("answers", [])
    user_id = body.get("user_id", "default")
    if not user_answers:
        return JSONResponse({"error": "No answers provided"}, status_code=400)

    db = get_db_session()
    try:
        # Load the lesson to get practice exercises
        lesson = (
            db.query(LessonContent)
            .filter_by(project_name=name, knode_id=node_id)
            .first()
        )
        if not lesson or not lesson.practice:
            return JSONResponse({"error": "Lesson or practice not found"}, status_code=404)

        # Parse practice JSON
        practice_text = lesson.practice.strip()
        if practice_text.startswith("```"):
            lines = practice_text.split("\n")
            practice_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            practice_text = practice_text.strip()
        try:
            practice_data = json.loads(practice_text)
        except (json.JSONDecodeError, TypeError):
            return JSONResponse({"error": "Practice data is not structured JSON"}, status_code=400)

        exercises = practice_data.get("exercises", [])
        total_points = practice_data.get("total_points", 0)

        # Determine attempt number
        prev_count = (
            db.query(PracticeSubmission)
            .filter_by(user_id=user_id, project_name=name, knode_id=node_id)
            .count()
        )
        attempt = prev_count + 1

        # Grade each answer
        feedback = []
        total_score = 0.0
        for ans in user_answers:
            idx = ans.get("exercise_idx", -1)
            user_answer = str(ans.get("user_answer", "")).strip()
            if idx < 0 or idx >= len(exercises):
                feedback.append({
                    "exercise_idx": idx,
                    "correct": False,
                    "points_earned": 0,
                    "feedback": "题目索引无效",
                })
                continue

            ex = exercises[idx]
            ex_type = ex.get("type", "")
            points = ex.get("points", 10)
            fb_item = {"exercise_idx": idx, "correct": False, "points_earned": 0, "feedback": ""}

            if ex_type == "choice":
                correct_idx = ex.get("correct", -1)
                if user_answer == str(correct_idx):
                    fb_item["correct"] = True
                    fb_item["points_earned"] = points
                    fb_item["feedback"] = "回答正确！"
                else:
                    options = ex.get("options", [])
                    correct_text = options[correct_idx] if 0 <= correct_idx < len(options) else "?"
                    fb_item["feedback"] = f"回答错误。正确答案是：{correct_text}"
                    fb_item["correct_answer"] = str(correct_idx)

            elif ex_type == "fill_blank":
                expected = str(ex.get("answer", "")).strip()
                if user_answer.lower() == expected.lower():
                    fb_item["correct"] = True
                    fb_item["points_earned"] = points
                    fb_item["feedback"] = "回答正确！"
                else:
                    fb_item["feedback"] = f"回答错误。正确答案是：{expected}"
                    fb_item["correct_answer"] = expected

            elif ex_type == "short_answer":
                # Use LLM to grade short answers
                try:
                    from systemedu.core.llm_client import get_llm
                    from langchain_core.messages import HumanMessage

                    grading_llm = get_llm(streaming=False)
                    grading_prompt = (
                        f"你是一位严格但公正的阅卷老师。请根据参考答案批改学生的简答题回答。\n\n"
                        f"题目：{ex.get('question', '')}\n"
                        f"参考答案要点：{ex.get('answer', '')}\n"
                        f"学生回答：{user_answer}\n"
                        f"满分：{points}分\n\n"
                        f"请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：\n"
                        f'{{"score": <0到{points}的整数>, "feedback": "评语"}}\n'
                        f"评分标准：答案要点覆盖完整度、表述准确度。"
                    )
                    resp = grading_llm.invoke([HumanMessage(content=grading_prompt)])
                    grade_text = resp.content.strip()
                    if grade_text.startswith("```"):
                        lines = grade_text.split("\n")
                        grade_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                        grade_text = grade_text.strip()
                    grade_result = json.loads(grade_text)
                    earned = min(max(int(grade_result.get("score", 0)), 0), points)
                    fb_item["points_earned"] = earned
                    fb_item["correct"] = earned >= points * 0.6
                    fb_item["feedback"] = grade_result.get("feedback", "")
                    fb_item["correct_answer"] = ex.get("answer", "")
                except Exception as e:
                    logger.exception("LLM grading failed, falling back to partial credit")
                    fb_item["points_earned"] = 0
                    fb_item["feedback"] = f"批改出错，请稍后重试。({str(e)[:50]})"
                    fb_item["correct_answer"] = ex.get("answer", "")

            total_score += fb_item["points_earned"]
            feedback.append(fb_item)

        # Save submission to DB
        submission = PracticeSubmission(
            user_id=user_id,
            project_name=name,
            knode_id=node_id,
            attempt=attempt,
            answers_json=json.dumps(user_answers, ensure_ascii=False),
            score=total_score,
            total_points=total_points,
            feedback_json=json.dumps(feedback, ensure_ascii=False),
            status="graded",
            graded_at=datetime.now(),
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

        passed = total_score >= practice_data.get("pass_score", total_points * 0.6)

        return JSONResponse({
            "submission_id": submission.id,
            "attempt": attempt,
            "score": total_score,
            "total_points": total_points,
            "passed": passed,
            "feedback": feedback,
        })

    except Exception as e:
        db.rollback()
        logger.exception("Practice submission failed")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()


async def api_practice_submissions(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/practice/submissions - List submissions."""
    from systemedu.storage.db import PracticeSubmission, get_session as get_db_session

    name = request.path_params["name"]
    node_id = request.path_params["node_id"]
    user_id = request.query_params.get("user_id", "default")

    db = get_db_session()
    try:
        submissions = (
            db.query(PracticeSubmission)
            .filter_by(user_id=user_id, project_name=name, knode_id=node_id)
            .order_by(PracticeSubmission.attempt.desc())
            .all()
        )
        result = []
        for s in submissions:
            result.append({
                "submission_id": s.id,
                "attempt": s.attempt,
                "score": s.score,
                "total_points": s.total_points,
                "status": s.status,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "graded_at": s.graded_at.isoformat() if s.graded_at else None,
                "feedback": json.loads(s.feedback_json) if s.feedback_json else [],
            })
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()


async def api_search_resources(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/resources/search - Trigger resource search via SearchAgent."""
    import threading

    from systemedu.education.project_loader import load_project_context
    from systemedu.education.search_service import search_resources

    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    # Load node info from knowledge tree
    try:
        ctx = load_project_context(name)
        knode = ctx.get_node_by_id(node_id)
        if knode is None:
            return JSONResponse({"error": f"node {node_id} not found"}, status_code=404)
        node_title = knode.title
        node_summary = knode.summary
        difficulty = knode.difficulty_level
    except Exception as e:
        return JSONResponse({"error": f"failed to load project: {e}"}, status_code=500)

    task_key = f"{name}/{node_id}"
    if _search_tasks.get(task_key):
        return JSONResponse({"status": "searching"})

    _search_tasks[task_key] = True

    def _run_and_cleanup():
        try:
            search_resources(name, node_id, node_title, node_summary, difficulty)
        finally:
            _search_tasks.pop(task_key, None)

    thread = threading.Thread(target=_run_and_cleanup, daemon=True)
    thread.start()

    return JSONResponse({"status": "searching"})


async def api_get_resources(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/resources - Get resources and search status."""
    from systemedu.education.search_service import get_resources

    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    try:
        result = get_resources(name, node_id)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_all_resources(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/resources - Get all resources for a project, keyed by knode_id."""
    from systemedu.education.search_service import get_all_resources

    name = request.path_params["name"]
    try:
        result = get_all_resources(name)
        # JSON keys must be strings
        return JSONResponse({str(k): v for k, v in result.items()})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_add_resource(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/resources - Manually add a resource."""
    from systemedu.education.search_service import add_resource

    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    url = body.get("url", "").strip()
    if not url:
        return JSONResponse({"error": "url is required"}, status_code=400)

    title = body.get("title", "").strip()
    snippet = body.get("snippet", "").strip()

    try:
        result = add_resource(name, node_id, url, title, snippet)
        return JSONResponse(result, status_code=201)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_toggle_resource_saved(request: Request) -> JSONResponse:
    """PATCH /api/projects/{name}/nodes/{node_id}/resources/{resource_id} - Toggle saved flag."""
    from systemedu.education.search_service import toggle_resource_saved

    resource_id = int(request.path_params["resource_id"])

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    saved = bool(body.get("saved", False))

    result = toggle_resource_saved(resource_id, saved)
    if result is None:
        return JSONResponse({"error": "resource not found"}, status_code=404)
    return JSONResponse(result)


async def api_get_note(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/note - Get user note for a knowledge node."""
    from systemedu.storage.db import UserNote, get_session as get_db_session

    project_name = request.path_params["name"]
    node_id = request.path_params["node_id"]
    user_id = request.query_params.get("user_id", "default")

    db = get_db_session()
    try:
        note = db.query(UserNote).filter_by(
            user_id=user_id, project_name=project_name, knode_id=node_id
        ).first()
        if note is None:
            return JSONResponse({"id": None, "content": "", "updated_at": None})
        return JSONResponse({
            "id": note.id,
            "content": note.content,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        })
    finally:
        db.close()


async def api_upsert_note(request: Request) -> JSONResponse:
    """PUT /api/projects/{name}/nodes/{node_id}/note - Upsert user note."""
    from systemedu.storage.db import UserNote, get_session as get_db_session

    project_name = request.path_params["name"]
    node_id = request.path_params["node_id"]
    body = await request.json()
    content = body.get("content", "")
    user_id = body.get("user_id", "default")
    now = datetime.now()

    db = get_db_session()
    try:
        note = db.query(UserNote).filter_by(
            user_id=user_id, project_name=project_name, knode_id=node_id
        ).first()
        if note is None:
            note = UserNote(
                user_id=user_id,
                project_name=project_name,
                knode_id=node_id,
                content=content,
                created_at=now,
                updated_at=now,
            )
            db.add(note)
        else:
            note.content = content
            note.updated_at = now
        db.commit()
        db.refresh(note)
        return JSONResponse({
            "id": note.id,
            "content": note.content,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        })
    finally:
        db.close()


async def api_get_all_notes(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/notes - Get all non-empty notes for a project."""
    from systemedu.storage.db import UserNote, get_session as get_db_session

    project_name = request.path_params["name"]
    user_id = request.query_params.get("user_id", "default")

    db = get_db_session()
    try:
        notes = db.query(UserNote).filter(
            UserNote.project_name == project_name,
            UserNote.user_id == user_id,
            UserNote.content != "",
        ).all()
        result = {
            str(n.knode_id): {
                "id": n.id,
                "content": n.content,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }
            for n in notes
        }
        return JSONResponse(result)
    finally:
        db.close()


async def api_batch_generate_lessons(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/lessons/batch-generate - Batch pre-generate lessons for up to 10 nodes."""
    import threading

    name = request.path_params["name"]

    # Prevent duplicate batch runs for the same project
    if _lesson_queue_tasks.get(name):
        return JSONResponse({"error": f"Batch generation already running for project '{name}'"}, status_code=409)

    # Load project tree to get all knode_ids + titles
    try:
        from systemedu.education.project_loader import load_project_context
        ctx = load_project_context(name)
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

    # Collect all (knode_id, title) in global order
    all_knodes: list[tuple[int, str]] = []
    for ms in ctx.tree.milestones:
        for knode in ms.knodes:
            all_knodes.append((len(all_knodes), knode.title))

    if not all_knodes:
        return JSONResponse({"queued_knode_ids": [], "total": 0, "batch_id": 0})

    # Find which nodes already have status=ready in DB
    from systemedu.storage.db import LessonContent, LessonQueueItem, get_session as get_db_session

    db = get_db_session()
    try:
        ready_ids = {
            r.knode_id
            for r in db.query(LessonContent.knode_id)
            .filter_by(project_name=name)
            .filter(LessonContent.status == "ready")
            .all()
        }

        # Take first 10 nodes that are not ready
        queued_knodes = [(kid, title) for kid, title in all_knodes if kid not in ready_ids][:10]

        if not queued_knodes:
            return JSONResponse({"queued_knode_ids": [], "total": 0, "batch_id": 0})

        # Compute next batch_id
        last_batch = (
            db.query(LessonQueueItem.batch_id)
            .filter_by(project_name=name)
            .order_by(LessonQueueItem.batch_id.desc())
            .first()
        )
        batch_id = (last_batch[0] + 1) if last_batch else 1

        now = datetime.now()
        queue_items = []
        for kid, title in queued_knodes:
            item = LessonQueueItem(
                project_name=name,
                knode_id=kid,
                knode_title=title,
                batch_id=batch_id,
                status="pending",
                created_at=now,
            )
            db.add(item)
            queue_items.append(item)
        db.commit()
        # Refresh to get IDs
        for item in queue_items:
            db.refresh(item)
        item_ids = [item.id for item in queue_items]
    finally:
        db.close()

    queued_knode_ids = [kid for kid, _ in queued_knodes]

    def _run_batch():
        _lesson_queue_tasks[name] = True
        try:
            import asyncio as _asyncio
            from systemedu.education.lesson_generator import generate_lesson
            from systemedu.storage.db import LessonQueueItem as _LQI, get_session as _get_db

            for item_id, (knode_id, _title) in zip(item_ids, queued_knodes):
                db2 = _get_db()
                try:
                    item = db2.query(_LQI).filter_by(id=item_id).first()
                    if item is None:
                        continue
                    item.status = "generating"
                    item.started_at = datetime.now()
                    db2.commit()
                finally:
                    db2.close()

                try:
                    _asyncio.run(generate_lesson(name, knode_id))
                    db3 = _get_db()
                    try:
                        item = db3.query(_LQI).filter_by(id=item_id).first()
                        if item:
                            item.status = "done"
                            item.completed_at = datetime.now()
                            db3.commit()
                    finally:
                        db3.close()
                except Exception as e:
                    logger.exception(f"Batch lesson generation failed for {name}/{knode_id}")
                    db3 = _get_db()
                    try:
                        item = db3.query(_LQI).filter_by(id=item_id).first()
                        if item:
                            item.status = "failed"
                            item.error = str(e)[:500]
                            item.completed_at = datetime.now()
                            db3.commit()
                    finally:
                        db3.close()
        finally:
            _lesson_queue_tasks.pop(name, None)

    thread = threading.Thread(target=_run_batch, daemon=True)
    thread.start()

    return JSONResponse({
        "queued_knode_ids": queued_knode_ids,
        "total": len(queued_knode_ids),
        "batch_id": batch_id,
    })


async def api_get_lesson_queue(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/lessons/queue - Get latest batch queue status."""
    name = request.path_params["name"]

    from systemedu.storage.db import LessonQueueItem, get_session as get_db_session

    db = get_db_session()
    try:
        # Find the latest batch_id for this project
        last_batch = (
            db.query(LessonQueueItem.batch_id)
            .filter_by(project_name=name)
            .order_by(LessonQueueItem.batch_id.desc())
            .first()
        )

        if not last_batch:
            return JSONResponse({
                "items": [],
                "running": _lesson_queue_tasks.get(name, False),
                "batch_id": 0,
            })

        batch_id = last_batch[0]
        items = (
            db.query(LessonQueueItem)
            .filter_by(project_name=name, batch_id=batch_id)
            .order_by(LessonQueueItem.id)
            .all()
        )

        return JSONResponse({
            "items": [
                {
                    "id": item.id,
                    "project_name": item.project_name,
                    "knode_id": item.knode_id,
                    "knode_title": item.knode_title,
                    "batch_id": item.batch_id,
                    "status": item.status,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                    "started_at": item.started_at.isoformat() if item.started_at else None,
                    "completed_at": item.completed_at.isoformat() if item.completed_at else None,
                    "error": item.error or "",
                }
                for item in items
            ],
            "running": _lesson_queue_tasks.get(name, False),
            "batch_id": batch_id,
        })
    finally:
        db.close()


async def api_get_lesson_statuses(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/lessons/statuses - Get lesson generation status for all nodes."""
    name = request.path_params["name"]

    from systemedu.storage.db import LessonContent, get_session as get_db_session

    db = get_db_session()
    try:
        rows = (
            db.query(LessonContent.knode_id, LessonContent.status)
            .filter_by(project_name=name)
            .all()
        )
        return JSONResponse({
            "statuses": {str(knode_id): status for knode_id, status in rows}
        })
    finally:
        db.close()


async def api_cancel_lesson_queue(request: Request) -> JSONResponse:
    """DELETE /api/projects/{name}/lessons/queue - Skip pending items in current batch."""
    name = request.path_params["name"]

    from systemedu.storage.db import LessonQueueItem, get_session as get_db_session

    db = get_db_session()
    try:
        last_batch = (
            db.query(LessonQueueItem.batch_id)
            .filter_by(project_name=name)
            .order_by(LessonQueueItem.batch_id.desc())
            .first()
        )
        if not last_batch:
            return JSONResponse({"skipped": 0})

        batch_id = last_batch[0]
        pending_items = (
            db.query(LessonQueueItem)
            .filter_by(project_name=name, batch_id=batch_id, status="pending")
            .all()
        )
        for item in pending_items:
            item.status = "skipped"
        db.commit()
        return JSONResponse({"skipped": len(pending_items)})
    finally:
        db.close()


_AUTH_PUBLIC_PATHS = {"/api/auth/login", "/api/auth/logout", "/api/auth/me", "/api/status", "/"}


class _AuthMiddleware:
    """ASGI middleware that enforces Bearer token auth on all /api/* paths except public ones."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        # Only protect /api/* routes
        if not path.startswith("/api/"):
            await self.app(scope, receive, send)
            return

        # Public paths skip auth
        if path in _AUTH_PUBLIC_PATHS or path.startswith("/api/media/"):
            await self.app(scope, receive, send)
            return

        # Extract token: Authorization header (HTTP) or ?token= query param (WebSocket)
        headers = dict(scope.get("headers", []))
        auth = headers.get(b"authorization", b"").decode("utf-8", errors="replace")
        token = auth[7:] if auth.startswith("Bearer ") else ""

        # For WebSocket connections, browsers can't set custom headers — fall back to query param
        if not token and scope["type"] == "websocket":
            qs = scope.get("query_string", b"").decode("utf-8", errors="replace")
            for part in qs.split("&"):
                if part.startswith("token="):
                    token = part[6:]
                    break

        if not token or not verify_token(token):
            response = JSONResponse({"error": "Unauthorized"}, status_code=401)
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)


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
        Route("/api/sessions/full", api_sessions_full),
        Route("/api/sessions/{id}", api_session_detail),
        Route("/api/chat", api_chat, methods=["POST"]),
        Route("/api/projects", api_projects_dispatch, methods=["GET", "POST"]),
        Route("/api/projects/preview-tree", api_preview_tree, methods=["POST"]),
        Route("/api/projects/generate-description", api_generate_description, methods=["POST"]),
        Route("/api/projects/generate-tree", api_generate_tree, methods=["POST"]),
        Route("/api/projects/generate-cover-preview", api_generate_cover_preview, methods=["POST"]),
        Route("/api/projects/{name}/enroll", api_enroll, methods=["POST"]),
        Route("/api/projects/{name}/enrollment", api_enrollment_dispatch, methods=["GET", "PATCH"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/context", api_node_context),
        Route("/api/projects/{name}/nodes/{node_id:int}/lesson", api_node_lesson, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/lesson/generate", api_generate_lesson, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/lesson/progress", api_lesson_progress, methods=["GET"]),
        Route("/api/projects/{name}/lessons/batch-generate", api_batch_generate_lessons, methods=["POST"]),
        Route("/api/projects/{name}/lessons/statuses", api_get_lesson_statuses, methods=["GET"]),
        Route("/api/projects/{name}/lessons/queue", api_lessons_queue_dispatch, methods=["GET", "DELETE"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/progress", api_update_progress, methods=["PATCH"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/highlights", api_highlights_dispatch, methods=["GET", "POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/practice/submit", api_submit_practice, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/practice/submissions", api_practice_submissions, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/highlights/{highlight_id:int}", api_delete_highlight, methods=["DELETE"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/resources/search", api_search_resources, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/resources", api_resources_dispatch, methods=["GET", "POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/resources/{resource_id:int}", api_toggle_resource_saved, methods=["PATCH"]),
        Route("/api/projects/{name}/resources", api_get_all_resources, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/note", api_note_dispatch, methods=["GET", "PUT"]),
        Route("/api/projects/{name}/notes", api_get_all_notes, methods=["GET"]),
        Route("/api/projects/{name}/cover", api_upload_project_cover, methods=["POST"]),
        Route("/api/projects/{name}/cover/generate", api_generate_project_cover, methods=["POST"]),
        Route("/api/projects/{name}/tree", api_update_tree, methods=["PUT"]),
        Route("/api/projects/{name}", api_project_dispatch, methods=["GET", "PATCH", "DELETE"]),
        Route("/api/objects/registry", api_objects_registry, methods=["GET"]),
        Route("/api/objects/queue", api_objects_queue, methods=["GET"]),
        Route("/api/objects/queue/add", api_objects_queue_add, methods=["POST"]),
        Route("/api/objects/queue/trigger", api_objects_queue_trigger, methods=["POST"]),
        Route("/api/agents", api_agents),
        Route("/api/skills", api_skills),
        Route("/api/mcp/servers", api_mcp_dispatch, methods=["GET", "POST"]),
        Route("/api/mcp/servers/{name}", api_mcp_remove, methods=["DELETE"]),
        WebSocketRoute("/api/chat/stream", ws_chat_stream),
    ]

    # Mount media files directory for TTS audio serving
    from systemedu.core.config import SYSTEMEDU_HOME
    media_dir = SYSTEMEDU_HOME / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    routes.append(Mount("/api/media", StaticFiles(directory=str(media_dir)), name="media"))

    # Auth routes (public)
    routes.insert(0, Route("/api/auth/login", api_auth_login, methods=["POST"]))
    routes.insert(1, Route("/api/auth/logout", api_auth_logout, methods=["POST"]))
    routes.insert(2, Route("/api/auth/me", api_auth_me, methods=["GET"]))

    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        ),
        Middleware(_AuthMiddleware),
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

    # Configure logging so systemedu agent logs are visible in stdout
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s:%(name)s:%(message)s",
    )

    parser = argparse.ArgumentParser(description="SystemEdu Gateway")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18820)
    args = parser.parse_args()

    app = create_app()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
