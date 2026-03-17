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

    try:
        project_dir = create_project(name, title, converted, meta)
    except FileExistsError as e:
        return JSONResponse({"error": str(e)}, status_code=409)

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
                "enrollment": enrollment_data,
            }
        )
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)
    except Exception as e:
        logger.exception(f"Failed to load project {name}")
        return JSONResponse({"error": str(e)}, status_code=500)


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
                    "content_type": "text",
                    "generated_at": None,
                }
            )
    finally:
        db.close()


async def api_generate_lesson(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/lesson/generate - Generate lesson content."""
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

    try:
        from systemedu.education.lesson_generator import generate_lesson

        result = generate_lesson(name, node_id)
        return JSONResponse(result)
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=404)
    except Exception as e:
        logger.exception(f"Failed to generate lesson for {name}/{node_id}")
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_lesson_progress(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/lesson/progress - Get lesson generation pipeline progress."""
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    from systemedu.storage.db import LessonGenerationProgress, get_session as get_db_session

    db = get_db_session()
    try:
        records = (
            db.query(LessonGenerationProgress)
            .filter_by(project_name=name, knode_id=node_id)
            .order_by(LessonGenerationProgress.id)
            .all()
        )
        return JSONResponse([
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
        ])
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
        Route("/api/projects", api_projects, methods=["GET"]),
        Route("/api/projects", api_create_project, methods=["POST"]),
        Route("/api/projects/preview-tree", api_preview_tree, methods=["POST"]),
        Route("/api/projects/{name}/enroll", api_enroll, methods=["POST"]),
        Route("/api/projects/{name}/enrollment", api_get_enrollment, methods=["GET"]),
        Route("/api/projects/{name}/enrollment", api_update_enrollment, methods=["PATCH"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/context", api_node_context),
        Route("/api/projects/{name}/nodes/{node_id:int}/lesson", api_node_lesson, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/lesson/generate", api_generate_lesson, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/lesson/progress", api_lesson_progress, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/progress", api_update_progress, methods=["PATCH"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/highlights", api_get_highlights, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/highlights", api_create_highlight, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/highlights/{highlight_id:int}", api_delete_highlight, methods=["DELETE"]),
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
