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
from starlette.responses import HTMLResponse, JSONResponse, StreamingResponse
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

# Shared state
_fact_worker = None
_session_manager = None


def _get_session_manager():
    global _session_manager
    if _session_manager is None:
        from systemedu.core.session import SessionManager
        _session_manager = SessionManager()
    return _session_manager


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


def _mask_api_key(key: str) -> str:
    """spec 017: 脱敏展示 api_key。

    - 空字符串 → ""
    - 长度 <= 8 → 全 ***
    - 长度 > 8 → 前 3 字符 + *** + 后 4 字符（如 sk-***abcd）
    """
    if not key:
        return ""
    if len(key) <= 8:
        return "***"
    return f"{key[:3]}***{key[-4:]}"


# spec 017: web /config 页面只渲染这些 provider；其他系统侧 provider
# (qwen / 未来 wanx 等) UI 不显示。
LLM_USER_EDITABLE_PROVIDERS: tuple[str, ...] = ("creative",)


async def api_config(request: Request) -> JSONResponse:
    """GET /api/config - Current config (sanitized, no raw API keys)."""
    from systemedu.core.config import get_config

    config = get_config()

    providers = {}
    for name, prov in config.llm.providers.items():
        providers[name] = {
            "base_url": prov.base_url,
            "model": prov.model,
            "api_key": _mask_api_key(prov.api_key),
            "temperature": prov.temperature,
            "max_tokens": prov.max_tokens,
        }

    return JSONResponse(
        {
            "llm": {
                "default": config.llm.default,
                "user_editable": list(LLM_USER_EDITABLE_PROVIDERS),
                "providers": providers,
            },
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
    """POST /api/chat - Send a message through the tutor LangGraph (spec 014)."""
    from systemedu.gateway.chat_payload import ChatPayload
    from systemedu.gateway import tutor_runner

    body = await request.json()
    try:
        payload = ChatPayload(**body)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)

    message = payload.message.strip()
    if not message:
        return JSONResponse({"error": "message is required"}, status_code=400)

    # user_id: override with authenticated session (gateway is authority)
    user_id = body.get("user_id", "default")

    result = await tutor_runner.invoke(payload, user_id)
    resp: dict = {
        "response": result["response"],
        "thread_id": payload.thread_id(user_id),
    }
    if result.get("active_skill"):
        resp["active_skill"] = result["active_skill"]
    if result.get("confirm_required"):
        resp["confirm_required"] = result["confirm_required"]
    if result.get("_safety_triggered"):
        resp["_safety_triggered"] = True
    return JSONResponse(resp)


async def ws_chat_stream(websocket: WebSocket) -> None:
    """WS /api/chat/stream - Streaming chat through tutor LangGraph (spec 014)."""
    await websocket.accept()

    from systemedu.gateway.chat_payload import ChatPayload
    from systemedu.gateway import tutor_runner

    try:
        while True:
            data = await websocket.receive_json()

            # Validate payload
            try:
                payload = ChatPayload(**data)
            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})
                continue

            message = payload.message.strip()
            if not message:
                await websocket.send_json({"type": "error", "message": "message is required"})
                continue

            user_id = data.get("user_id", "default")
            logger.info(
                "ws_chat: user=%s project=%s knode=%s active_tab=%s msg=%s",
                user_id, payload.project_name, payload.knode_id,
                payload.active_tab, message[:50],
            )

            try:
                collected_chunks: list[str] = []
                async for event in tutor_runner.stream(payload, user_id):
                    await websocket.send_json(event)
                    if event.get("type") == "chunk" and event.get("content"):
                        collected_chunks.append(event["content"])

                session_id = payload.session_id or payload.thread_id(user_id)
                await websocket.send_json({
                    "type": "done",
                    "session_id": session_id,
                    "thread_id": payload.thread_id(user_id),
                })

                # Persist to SessionManager so /api/sessions/full returns
                # tutor chat history on page reload.
                try:
                    sm = _get_session_manager()
                    sess = sm.get_session(session_id)
                    if sess is None:
                        sess = sm.create_session(
                            agent_name="tutor",
                            project_name=payload.project_name,
                        )
                        # Re-register under the frontend's session_id
                        sm._sessions.pop(sess.id, None)
                        sess.id = session_id
                        sm._sessions[session_id] = sess
                        sm._persist_session(sess)
                    sess.add_message("user", message)
                    ai_text = "".join(collected_chunks)
                    if ai_text:
                        sess.add_message("assistant", ai_text)
                except Exception:
                    logger.debug("Failed to persist chat to SessionManager", exc_info=True)

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
                            "icon_svg": data.get("icon_svg", ""),
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
        validate_v5_tree,
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

    errors = validate_v5_tree(converted)
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

    # Insert DB record immediately so cover_image_url can be updated later
    from systemedu.storage.db import LocalProject, get_session as get_db_session
    db = get_db_session()
    try:
        existing = db.query(LocalProject).filter_by(name=name).first()
        if not existing:
            db.add(LocalProject(
                name=name,
                title=title,
                description=meta.get("description", "") if meta else "",
                path=str(project_dir),
                category=meta.get("category", "other") if meta else "other",
                cover_image_url="",
            ))
            db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to insert project DB record (non-fatal)")
    finally:
        db.close()

    # Background: generate cover image via DashScope Wanx
    async def _bg_generate_cover() -> None:
        try:
            from systemedu.core.config import SYSTEMEDU_HOME
            from systemedu.education.image_gen import generate_project_cover
            desc = meta.get("description", "") if meta else ""
            cover_path = SYSTEMEDU_HOME / "media" / "projects" / name / "cover.jpg"
            ok = await generate_project_cover(title, desc, cover_path)
            if ok:
                cover_url = f"/api/media/projects/{name}/cover.jpg"
                from systemedu.storage.db import LocalProject, get_session as get_db_session
                _db = get_db_session()
                try:
                    _proj = _db.query(LocalProject).filter_by(name=name).first()
                    if _proj:
                        _proj.cover_image_url = cover_url
                        _db.commit()
                        logger.info(f"Cover image URL saved for {name!r}: {cover_url}")
                except Exception:
                    _db.rollback()
                    logger.exception("Failed to update cover_image_url in DB")
                finally:
                    _db.close()
        except Exception:
            logger.exception(f"Background cover generation failed for {name!r}")

    asyncio.ensure_future(_bg_generate_cover())

    return JSONResponse({"name": name, "created": True, "path": str(project_dir)})


async def api_preview_tree(request: Request) -> JSONResponse:
    """POST /api/projects/preview-tree - Preview/validate an uploaded knowledge tree without creating a project."""
    from systemedu.education.services import (
        convert_uploaded_tree,
        extract_project_meta,
        validate_v5_tree,
    )
    from systemedu.education.tree_adapter import v5_to_milestones_view
    from systemedu.education.models import V5KnowledgeTree

    body = await request.json()
    tree_data = body.get("tree_data")

    if not tree_data or not isinstance(tree_data, dict):
        return JSONResponse({"error": "tree_data is required and must be a JSON object"}, status_code=400)

    try:
        converted = convert_uploaded_tree(tree_data)
    except ValueError as e:
        return JSONResponse({"error": f"Format error: {e}"}, status_code=400)

    errors = validate_v5_tree(converted)

    # Derive milestones view for frontend-compatible stats and preview
    v5_tree = V5KnowledgeTree.model_validate(converted)
    ms_view = v5_to_milestones_view(v5_tree)
    milestones = [
        {
            "title": ms.title,
            "description": ms.description,
            "knodes": [
                {
                    "title": kn.title,
                    "summary": kn.summary,
                    "difficulty_level": kn.difficulty_level,
                    "estimated_minutes": kn.estimated_minutes,
                    "prerequisite_indices": kn.prerequisite_indices,
                }
                for kn in ms.knodes
            ],
        }
        for ms in ms_view.milestones
    ]

    total_nodes = sum(len(ms.knodes) for ms in ms_view.milestones)
    total_minutes = sum(
        kn.estimated_minutes for ms in ms_view.milestones for kn in ms.knodes
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

    from systemedu.core.llm_client import LLMNotConfigured
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
    except LLMNotConfigured:
        # spec 017: 透传给全局 handler → 412 LLM_NOT_CONFIGURED
        raise
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

    from systemedu.core.llm_client import LLMNotConfigured
    try:
        tree = await generate_knowledge_tree(title, description, user_age=age, target_nodes=node_count)
    except LLMNotConfigured:
        # spec 017: 透传给全局 handler → 412 LLM_NOT_CONFIGURED
        raise
    except Exception as e:
        logger.error(f"AI tree generation failed: {e}")
        return JSONResponse(
            {"error": f"AI 生成失败: {e}"}, status_code=500
        )

    # tree is V5KnowledgeTree; derive milestones view for frontend
    from systemedu.education.tree_adapter import v5_to_milestones_view
    ms_view = v5_to_milestones_view(tree)
    milestones = [ms.model_dump() for ms in ms_view.milestones]
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
                knode_data: dict = {
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
                # v4.1 optional metadata — only include when non-empty
                if node.module_id:
                    knode_data["module_id"] = node.module_id
                if node.module_role:
                    knode_data["module_role"] = node.module_role
                if node.core_question:
                    knode_data["core_question"] = node.core_question
                if node.acceptance_artifacts:
                    knode_data["acceptance_artifacts"] = node.acceptance_artifacts
                if node.acceptance_standard:
                    knode_data["acceptance_standard"] = node.acceptance_standard
                if node.hands_on_components:
                    knode_data["hands_on_components"] = node.hands_on_components
                if node.outputs_produced:
                    knode_data["outputs_produced"] = node.outputs_produced
                knodes_serialized.append(knode_data)
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

        # Fetch cover_image_url from DB, fallback to filesystem
        from systemedu.core.config import SYSTEMEDU_HOME
        from systemedu.storage.db import LocalProject, get_session as get_db_session

        cover_url = ""
        _db = get_db_session()
        try:
            _db_proj = _db.query(LocalProject).filter_by(name=name).first()
            if _db_proj:
                cover_url = _db_proj.cover_image_url or ""
                # If DB record exists but has no cover, check filesystem
                if not cover_url:
                    fs_cover = SYSTEMEDU_HOME / "media" / "projects" / name / "cover.jpg"
                    if fs_cover.exists():
                        cover_url = f"/api/media/projects/{name}/cover.jpg"
                        _db_proj.cover_image_url = cover_url
                        _db.commit()
            else:
                # No DB record — check filesystem and auto-register
                fs_cover = SYSTEMEDU_HOME / "media" / "projects" / name / "cover.jpg"
                if fs_cover.exists():
                    cover_url = f"/api/media/projects/{name}/cover.jpg"
                # Create DB record so future updates work
                try:
                    project_path = find_project_dir(name)
                    _db.add(LocalProject(
                        name=name,
                        title=ctx.project.title,
                        description=ctx.project.description,
                        path=str(project_path),
                        category=ctx.project.category.value if hasattr(ctx.project.category, "value") else str(ctx.project.category),
                        cover_image_url=cover_url,
                    ))
                    _db.commit()
                except Exception:
                    _db.rollback()

            # If still no cover, trigger background generation
            if not cover_url:
                _cover_name = name
                _cover_title = ctx.project.title
                _cover_desc = ctx.project.description

                async def _bg_gen_cover_on_detail() -> None:
                    try:
                        from systemedu.education.image_gen import generate_project_cover

                        _path = SYSTEMEDU_HOME / "media" / "projects" / _cover_name / "cover.jpg"
                        ok = await generate_project_cover(_cover_title, _cover_desc, _path)
                        if ok:
                            _url = f"/api/media/projects/{_cover_name}/cover.jpg"
                            _s = get_db_session()
                            try:
                                _p = _s.query(LocalProject).filter_by(name=_cover_name).first()
                                if _p:
                                    _p.cover_image_url = _url
                                    _s.commit()
                                    logger.info(f"Auto-generated cover for {_cover_name!r}")
                            except Exception:
                                _s.rollback()
                            finally:
                                _s.close()
                    except Exception:
                        logger.exception(f"Background cover generation failed for {_cover_name!r}")

                asyncio.ensure_future(_bg_gen_cover_on_detail())
        finally:
            _db.close()

        # Build sub_projects with progress if available
        sub_projects_data = []
        if ctx.tree.sub_projects:
            status_map: dict[int, str] = {}
            for p in ctx.progress:
                status_map[p.knode_id] = p.status.value if hasattr(p.status, "value") else str(p.status)

            # First pass: compute knode progress per sub-project
            sp_progress: dict[str, tuple[int, int]] = {}  # sp.id -> (passed, total)
            for sp in ctx.tree.sub_projects:
                sp_node_ids: list[int] = []
                for ms_idx in sp.milestone_indices:
                    if ms_idx < len(ctx.tree.milestones):
                        ms_obj = ctx.tree.milestones[ms_idx]
                        start = sum(
                            len(ctx.tree.milestones[i].knodes) for i in range(ms_idx)
                        )
                        sp_node_ids.extend(
                            range(start, start + len(ms_obj.knodes))
                        )
                sp_passed = sum(
                    1 for nid in sp_node_ids if status_map.get(nid) == "passed"
                )
                sp_progress[sp.id] = (sp_passed, len(sp_node_ids))

            # Second pass: compute status with prerequisite check
            for sp in ctx.tree.sub_projects:
                sp_passed, sp_total = sp_progress[sp.id]

                if sp_total > 0 and sp_passed >= sp_total:
                    sp_status = "passed"
                elif sp_passed > 0:
                    sp_status = "in_progress"
                elif not sp.prerequisite_sub_project_ids:
                    sp_status = "available"
                else:
                    # Check if all prerequisites are completed
                    all_prereqs_done = all(
                        sp_progress.get(pid, (0, 1))[0] >= sp_progress.get(pid, (0, 1))[1]
                        and sp_progress.get(pid, (0, 1))[1] > 0
                        for pid in sp.prerequisite_sub_project_ids
                    )
                    sp_status = "available" if all_prereqs_done else "locked"

                sp_data: dict = {
                    "id": sp.id,
                    "title": sp.title,
                    "description": sp.description,
                    "stage_id": sp.stage_id,
                    "milestone_indices": sp.milestone_indices,
                    "prerequisite_sub_project_ids": sp.prerequisite_sub_project_ids,
                    "difficulty": sp.difficulty,
                    "estimated_hours": sp.estimated_hours,
                    "deliverables": sp.deliverables,
                    "display_order": sp.display_order,
                    "nodes_passed": sp_passed,
                    "nodes_total": sp_total,
                    "status": sp_status,
                }
                if sp.brief:
                    sp_data["brief"] = sp.brief
                if sp.task:
                    sp_data["task"] = sp.task
                if sp.core_problem:
                    sp_data["core_problem"] = sp.core_problem
                if sp.inputs:
                    sp_data["inputs"] = sp.inputs
                if sp.data_usage:
                    sp_data["data_usage"] = sp.data_usage
                if sp.demo_unit:
                    sp_data["demo_unit"] = sp.demo_unit
                if sp.why_separate:
                    sp_data["why_separate"] = sp.why_separate
                if sp.handover:
                    sp_data["handover"] = sp.handover
                if sp.acceptance_criteria:
                    sp_data["acceptance_criteria"] = sp.acceptance_criteria
                sub_projects_data.append(sp_data)

        # Load project_brief.json if available
        project_brief = None
        try:
            from systemedu.education.project_loader import find_project_dir

            proj_dir = find_project_dir(name)
            brief_file = proj_dir / "project_brief.json"
            if brief_file.exists():
                project_brief = json.loads(brief_file.read_text(encoding="utf-8"))
        except Exception:
            pass

        # Read knowledge_level from project.yaml (not in Pydantic model)
        _kl = "K1"
        try:
            from systemedu.education.project_loader import find_project_dir as _fpd
            import yaml as _yl
            _yaml_data = _yl.safe_load((_fpd(name) / "project.yaml").read_text(encoding="utf-8")) or {}
            _kl = _yaml_data.get("knowledge_level", "K1")
        except Exception:
            pass

        response_data: dict = {
            "project": {
                "name": ctx.project.name,
                "title": ctx.project.title,
                "description": ctx.project.description,
                "category": ctx.project.category.value,
                "age_range": ctx.project.age_range,
                "estimated_hours": ctx.project.estimated_hours,
                "tags": ctx.project.tags,
                "cover_image_url": cover_url,
                "knowledge_level": _kl,
            },
            "milestones": milestones,
            "progress": progress,
            "enrollment": enrollment_data,
        }
        if sub_projects_data:
            sub_projects_data.sort(key=lambda sp: sp.get("display_order", 50))
            response_data["sub_projects"] = sub_projects_data
        if project_brief:
            response_data["project_brief"] = project_brief

        return JSONResponse(response_data)
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
    allowed = {"title", "description", "category", "age_range", "estimated_hours", "tags", "author", "knowledge_level"}
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



async def api_highlights_dispatch(request: Request) -> JSONResponse:
    """Dispatch GET/POST /api/projects/{name}/nodes/{node_id}/highlights."""
    if request.method == "GET":
        return await api_get_highlights(request)
    if request.method == "POST":
        return await api_create_highlight(request)
    return JSONResponse({"error": "Method not allowed"}, status_code=405)


async def api_project_theories(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/theories - aggregate every theory across all knodes.

    Returns a flat list of theories sourced from course_content.theories of each
    lesson_content row, enriched with knode_id / knode_title / stage_title so the
    frontend can group / graph / filter them without re-querying.
    """
    err = await require_auth(request)
    if err:
        return err
    name = request.path_params["name"]
    try:
        import json as _json
        from systemedu.education.project_loader import load_project_context
        from systemedu.storage.db import LessonContent, get_session as get_db_session

        ctx = load_project_context(name)

        # Build milestone_idx -> sub_project map (first match wins)
        ms_to_sub: dict[int, dict] = {}
        sub_projects = getattr(ctx.tree, "sub_projects", None) or []
        for sp in sub_projects:
            sp_id = getattr(sp, "id", None)
            sp_title = getattr(sp, "title", "") or ""
            for ms_i in (getattr(sp, "milestone_indices", None) or []):
                if ms_i not in ms_to_sub:
                    ms_to_sub[ms_i] = {"sub_project_id": sp_id, "sub_project_title": sp_title}

        # Flatten knode_id -> (title, stage_title, stage_idx, order_in_stage, sub_project)
        knode_meta: dict[int, dict] = {}
        global_idx = 0
        for ms_idx, ms in enumerate(ctx.tree.milestones):
            sp_meta = ms_to_sub.get(ms_idx) or {"sub_project_id": None, "sub_project_title": ""}
            for kn_idx, kn in enumerate(ms.knodes):
                knode_meta[global_idx] = {
                    "knode_id": global_idx,
                    "knode_title": kn.title,
                    "stage_title": ms.title,
                    "stage_idx": ms_idx,
                    "order_in_stage": kn_idx,
                    "sub_project_id": sp_meta["sub_project_id"],
                    "sub_project_title": sp_meta["sub_project_title"],
                }
                global_idx += 1

        db = get_db_session()
        try:
            rows = (
                db.query(LessonContent)
                .filter(LessonContent.project_name == name)
                .filter(LessonContent.course_content != "")
                .all()
            )
        finally:
            db.close()

        theories_out: list[dict] = []
        for row in rows:
            if row.knode_id not in knode_meta:
                continue
            try:
                cc = _json.loads(row.course_content or "{}")
            except Exception:
                continue
            theories = cc.get("theories") or []
            for th in theories:
                if not isinstance(th, dict):
                    continue
                lb = th.get("level_bodies")
                levels: list[dict] = []
                if isinstance(lb, list):
                    for b in lb:
                        if isinstance(b, dict) and (b.get("body_markdown") or "").strip():
                            levels.append({
                                "level": (b.get("level") or "K1").upper(),
                                "body_markdown": b.get("body_markdown") or "",
                            })
                elif isinstance(lb, dict):
                    for k, v in lb.items():
                        if isinstance(v, str) and v.strip():
                            levels.append({"level": str(k).upper(), "body_markdown": v})
                # Legacy single-body fallback
                if not levels and (th.get("body_markdown") or "").strip():
                    levels.append({"level": "K1", "body_markdown": th["body_markdown"]})
                if not levels:
                    continue
                meta = knode_meta[row.knode_id]
                raw_tags = th.get("tags") or []
                tags = [t for t in raw_tags if isinstance(t, str) and t.strip()]
                theories_out.append({
                    "theory_id": th.get("theory_id") or f"{row.knode_id}-{th.get('title', 'untitled')}",
                    "title": th.get("title") or th.get("theory_id") or "",
                    "subject": th.get("subject") or th.get("tag") or "",
                    "tags": tags,
                    "levels": levels,
                    "knode_id": meta["knode_id"],
                    "knode_title": meta["knode_title"],
                    "stage_title": meta["stage_title"],
                    "stage_idx": meta["stage_idx"],
                    "order_in_stage": meta["order_in_stage"],
                    "sub_project_id": meta["sub_project_id"],
                    "sub_project_title": meta["sub_project_title"],
                    "animation_html": th.get("animation_html") or "",
                    "related_paragraph": th.get("related_paragraph") or "",
                })

        # Build subject tally (legacy single subject) and tag tally (multi)
        subject_counts: dict[str, int] = {}
        tag_counts: dict[str, int] = {}
        for t in theories_out:
            s = t["subject"] or "other"
            subject_counts[s] = subject_counts.get(s, 0) + 1
            for tg in t["tags"]:
                tag_counts[tg] = tag_counts.get(tg, 0) + 1

        # Load project's open vocab (for UI facet listing — even zero-count tags)
        from systemedu.education.project_loader import find_project_dir
        tag_vocab: list[dict] = []
        try:
            proj_dir = find_project_dir(name)
            vocab_path = Path(proj_dir) / "theory_tags.json"
            if vocab_path.exists():
                vocab = _json.loads(vocab_path.read_text())
                tag_vocab = vocab.get("tags") or []
        except Exception:
            tag_vocab = []

        return JSONResponse({
            "project_name": name,
            "total": len(theories_out),
            "subject_counts": subject_counts,
            "tag_counts": tag_counts,
            "tag_vocab": tag_vocab,
            "theories": theories_out,
        })
    except FileNotFoundError:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)
    except Exception as e:
        logger.exception("api_project_theories failed")
        return JSONResponse({"error": str(e)}, status_code=500)


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


async def api_generate_project_icon(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/icon/generate - Generate and save SVG icon for an existing project."""
    from systemedu.education.project_loader import find_project_dir
    import yaml as _yaml

    name = request.path_params["name"]
    try:
        project_dir = find_project_dir(name)
    except Exception:
        return JSONResponse({"error": f"Project '{name}' not found"}, status_code=404)

    yaml_path = project_dir / "project.yaml"
    try:
        data = _yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return JSONResponse({"error": "Failed to read project.yaml"}, status_code=500)

    # Skip if already has icon
    if data.get("icon_svg"):
        return JSONResponse({"status": "exists", "icon_svg": data["icon_svg"]})

    from systemedu.agents.builtin.icon_gen_agent import generate_project_icon
    svg = await generate_project_icon(
        title=data.get("title", name),
        category=data.get("category", "other"),
        description=data.get("description", ""),
    )
    if not svg:
        return JSONResponse({"error": "Icon generation failed"}, status_code=500)

    data["icon_svg"] = svg
    yaml_path.write_text(
        _yaml.dump(data, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )
    logger.info(f"Icon generated for existing project '{name}'")
    return JSONResponse({"status": "generated", "icon_svg": svg})


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


async def api_update_tree(request: Request) -> JSONResponse:
    """PUT /api/projects/{name}/tree - Full-replace the knowledge_tree.json for a project.

    Accepts milestones format from frontend, converts to v5 for storage,
    and merges with existing v5 metadata (stages, edges, special_nodes etc).
    """
    from systemedu.education.project_loader import find_project_dir
    from systemedu.education.services import validate_milestones_tree
    from systemedu.education.tree_adapter import milestones_to_v5

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
    errors = validate_milestones_tree(tree_dict)
    if errors:
        return JSONResponse({"error": errors[0]}, status_code=422)

    # Convert milestones to v5
    v5_dict = milestones_to_v5(tree_dict)

    # Merge with existing v5 metadata from disk (preserve edges, stage descriptions, etc.)
    tree_path = project_dir / "knowledge_tree.json"
    if tree_path.exists():
        try:
            existing = json.loads(tree_path.read_text(encoding="utf-8"))
            if "stages" in existing and "modules" in existing:
                # Preserve top-level metadata fields that frontend doesn't send
                for key in (
                    "schema_version", "tree_type", "title", "description",
                    "project_identity", "target_learner", "project_positioning",
                    "decomposition_strategy", "safety_boundaries", "knowledge_levels",
                    "stage_relationship_rule", "global_integration_rule",
                    "special_nodes",
                ):
                    if key in existing and key not in v5_dict:
                        v5_dict[key] = existing[key]
                # Preserve edges if not regenerated
                if "edges" not in v5_dict or not v5_dict["edges"]:
                    v5_dict["edges"] = existing.get("edges", [])
        except Exception:
            pass  # If existing file is corrupt, just overwrite

    tree_path.write_text(
        json.dumps(v5_dict, ensure_ascii=False, indent=2), encoding="utf-8"
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


# Track in-flight resource search tasks
_search_tasks: dict[str, bool] = {}


async def api_generate_course_v2(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/course/v2/generate - Generate v2 course content.

    Synchronous: awaits the full pipeline and returns the complete CourseContent.
    If course is already ready and regenerate=false, returns cached data immediately.
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

    if not regenerate:
        db = get_db_session()
        try:
            existing = (
                db.query(LessonContent)
                .filter_by(project_name=name, knode_id=node_id)
                .first()
            )
            if existing and existing.status == "ready" and existing.course_content:
                from systemedu.education.lesson_generator import _course_content_to_dict
                return JSONResponse(_course_content_to_dict(existing))
        finally:
            db.close()

    # Run the full pipeline synchronously (await in-process)
    try:
        from systemedu.education.lesson_generator import generate_course_v2
        result = await generate_course_v2(name, node_id)
        return JSONResponse(result)
    except Exception as exc:
        logger.exception(f"generate_course_v2 failed for {name}/{node_id}")
        return JSONResponse({"error": str(exc)}, status_code=500)


# Registry of active generation tasks: key = (project_name, node_id)
_generation_tasks: dict[tuple[str, int], "asyncio.Task[None]"] = {}


async def api_course_v2_stream(request: Request) -> StreamingResponse:
    """GET /api/projects/{name}/nodes/{node_id}/course/v2/stream - SSE stream for course generation.

    Streams generation progress events as Server-Sent Events.
    Supports auth via Authorization header OR ?token= query param.
    Query params:
      - regenerate=1  force regenerate even if already ready
    """
    err = await require_auth(request)
    if err:
        return err

    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])
    regenerate = request.query_params.get("regenerate", "0") == "1"

    task_key = (name, node_id)

    # Cancel any existing task for this node before starting a new one
    existing = _generation_tasks.get(task_key)
    if existing and not existing.done():
        existing.cancel()
        _generation_tasks.pop(task_key, None)

    queue: asyncio.Queue = asyncio.Queue()

    def progress_cb(event: str, data: dict):
        queue.put_nowait((event, data))

    async def generate():
        async def run():
            try:
                from systemedu.education.lesson_generator import generate_course_v2
                await generate_course_v2(name, node_id, progress_cb=progress_cb)
            except asyncio.CancelledError:
                queue.put_nowait(("cancelled", {}))
            except Exception as exc:
                logger.exception(f"course_v2_stream failed for {name}/{node_id}")
                queue.put_nowait(("error", {"message": str(exc)}))
            finally:
                _generation_tasks.pop(task_key, None)

        task = asyncio.ensure_future(run())
        _generation_tasks[task_key] = task

        try:
            while True:
                try:
                    event, data = await asyncio.wait_for(queue.get(), timeout=5.0)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue

                payload = json.dumps(data, ensure_ascii=False)
                yield f"event: {event}\ndata: {payload}\n\n"

                if event in ("done", "error", "cancelled"):
                    break
        finally:
            # SSE client disconnected — task keeps running unless explicitly cancelled
            pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def api_course_v2_cancel(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/course/v2/cancel - Cancel a running generation."""
    err = await require_auth(request)
    if err:
        return err

    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])
    task_key = (name, node_id)

    task = _generation_tasks.get(task_key)
    if task and not task.done():
        task.cancel()
        _generation_tasks.pop(task_key, None)
        # Mark DB status back to pending so user can regenerate cleanly
        from systemedu.storage.db import LessonContent, get_session as get_db_session
        db = get_db_session()
        try:
            lesson = db.query(LessonContent).filter_by(project_name=name, knode_id=node_id).first()
            if lesson and lesson.status == "generating":
                lesson.status = "pending"
                db.commit()
        finally:
            db.close()
        logger.info(f"Generation cancelled for {name}/{node_id}")
        return JSONResponse({"status": "cancelled"})

    return JSONResponse({"status": "not_running"})


async def api_get_course_v2(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/course/v2 - Get current v2 course content."""
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
        if lesson is None:
            return JSONResponse({"status": "pending", "course_content": {}})

        from systemedu.education.lesson_generator import _course_content_to_dict
        return JSONResponse(_course_content_to_dict(lesson))
    finally:
        db.close()


async def api_get_course_v3(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/course/v3[?version=<label>]
    读取 v3 (kimi-k2.6) 版本课程内容, 支持多版本。

    无 version 参数 → 返回当前 active 版本 (前端默认行为)。
    带 version 参数 → 返回指定版本内容。
    """
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])
    version_label = request.query_params.get("version")

    from systemedu.storage.db import LessonContentV3, get_session as get_db_session
    import json as _json

    db = get_db_session()
    try:
        q = db.query(LessonContentV3).filter_by(project_name=name, knode_id=node_id)
        if version_label:
            lesson = q.filter_by(version_label=version_label).first()
        else:
            # 默认: 当前 active 版本; 没有 active 时退回最近一条 (兼容 generating/failed 单版本)
            lesson = q.filter_by(is_active=True).first()
            if lesson is None:
                lesson = q.order_by(LessonContentV3.generated_at.desc().nullslast()).first()

        if lesson is None:
            return JSONResponse({
                "project_name": name, "knode_id": node_id,
                "version_label": None, "is_active": False,
                "status": "pending", "course_content": {},
            })
        cc = {}
        if lesson.course_content:
            try:
                cc = _json.loads(lesson.course_content)
            except Exception:
                pass
        return JSONResponse({
            "project_name": name, "knode_id": node_id,
            "version_label": lesson.version_label,
            "is_active": bool(lesson.is_active),
            "status": lesson.status,
            "generated_at": lesson.generated_at.isoformat() if lesson.generated_at else None,
            "course_content": cc,
        })
    finally:
        db.close()


async def api_list_course_v3_versions(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/course/v3/versions — 列出所有版本元数据。

    返回 [{version_label, is_active, status, generated_at}], 按生成时间倒序。
    """
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    from course_factory.factory import list_v3_versions
    versions = list_v3_versions(name, node_id)
    return JSONResponse({
        "project_name": name, "knode_id": node_id,
        "versions": versions,
    })


async def api_set_course_v3_active(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/course/v3/active
    body: {"version_label": "<label>"}
    切换指定版本为 active (前端默认显示版本)。
    """
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])
    try:
        body = await request.json()
    except Exception:
        body = {}
    version_label = (body or {}).get("version_label")
    if not version_label:
        return JSONResponse({"error": "version_label required"}, status_code=400)

    from course_factory.factory import set_active_v3_version
    ok = set_active_v3_version(name, node_id, version_label)
    if not ok:
        return JSONResponse(
            {"error": f"version {version_label!r} not found for {name}/{node_id}"},
            status_code=404,
        )
    return JSONResponse({"ok": True, "active_version": version_label})


# ----------------------------------------------------------------------
# Slides endpoints — 老师讲课模式 slide 数据
# ----------------------------------------------------------------------

async def api_list_course_v3_slides(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/course/v3/slides[?version=<label>]
    返回 slides 列表 (按 slide_index 升序)。

    无 version → 用当前 active 版本; version 不存在 slides → 返回空数组。
    """
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])
    version_label = request.query_params.get("version")

    if not version_label:
        # 取 active version
        from systemedu.storage.db import LessonContentV3, get_session as get_db_session
        db = get_db_session()
        try:
            row = (
                db.query(LessonContentV3)
                .filter_by(project_name=name, knode_id=node_id, is_active=True)
                .first()
            )
            if row:
                version_label = row.version_label
        finally:
            db.close()

    if not version_label:
        return JSONResponse({
            "project_name": name, "knode_id": node_id,
            "version_label": None, "slides": [],
        })

    from course_factory.factory import list_slides_v3
    slides = list_slides_v3(name, node_id, version_label)
    return JSONResponse({
        "project_name": name, "knode_id": node_id,
        "version_label": version_label, "slides": slides,
    })


async def api_regenerate_course_v3_slides(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/course/v3/slides/regenerate
    body: {"version_label": "<label>"}  (可选; 缺失则用 active)
    用 LLM 为该 version 重新生成全套 slides 并替换 DB 旧记录。
    """
    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])
    try:
        body = await request.json()
    except Exception:
        body = {}
    version_label = (body or {}).get("version_label")

    # 取 course_content + version_label
    import json as _json
    from systemedu.storage.db import LessonContentV3, get_session as get_db_session
    db = get_db_session()
    try:
        q = db.query(LessonContentV3).filter_by(project_name=name, knode_id=node_id)
        row = q.filter_by(version_label=version_label).first() if version_label else q.filter_by(is_active=True).first()
        if not row:
            return JSONResponse(
                {"error": "no matching course content"},
                status_code=404,
            )
        version_label = row.version_label
        course_content = _json.loads(row.course_content) if row.course_content else {}
    finally:
        db.close()

    # 拿 knode 上下文
    try:
        from course_factory.factory import load_knode_context
        ctx = load_knode_context(name, node_id)
        knode = ctx["knode"]
    except Exception as exc:
        return JSONResponse({"error": f"load_knode_context failed: {exc}"}, status_code=500)

    # 调 generate_slides
    from systemedu.course_factory_v3.steps.s67_slides import generate_slides
    try:
        slides = await generate_slides(
            project_name=name,
            knode_id=node_id,
            version_label=version_label,
            knode=knode,
            course_content=course_content,
        )
    except Exception as exc:
        logger.exception(f"[slides] regenerate failed for {name}/{node_id}")
        return JSONResponse({"error": str(exc)}, status_code=500)

    return JSONResponse({
        "project_name": name, "knode_id": node_id,
        "version_label": version_label,
        "count": len(slides),
        "slides": slides,
    })


async def api_get_course_v2_assignment(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/course/v2/assignment - Get generated assignment."""
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
        if lesson is None:
            return JSONResponse({"status": "pending", "assignment": ""})
        return JSONResponse({
            "status": lesson.status,
            "assignment": lesson.project_assignment or "",
        })
    finally:
        db.close()


async def api_lesson_statuses(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/lesson-statuses - Get lesson generation status for all nodes."""
    name = request.path_params["name"]

    from systemedu.storage.db import LessonContent, get_session as get_db_session

    db = get_db_session()
    try:
        rows = (
            db.query(LessonContent.knode_id, LessonContent.status)
            .filter_by(project_name=name)
            .all()
        )
        statuses = {str(row.knode_id): row.status for row in rows}
        return JSONResponse({"statuses": statuses})
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
        xp_updates: list[dict] = []
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

            # Add XP to career paths
            xp_updates = []
            try:
                from systemedu.education.career_path import add_xp
                from systemedu.education.project_loader import load_project_context

                ctx = load_project_context(name, user_id=user_id)
                xp_reward = 20  # default
                for ms in ctx.tree.milestones:
                    for kn in ms.knodes:
                        if kn.id == node_id:
                            xp_reward = kn.xp_reward
                            break
                xp_updates = add_xp(user_id, name, xp_reward)
                if xp_updates:
                    logger.info("XP update for %s node %d: %s", name, node_id, xp_updates)
            except Exception as e:
                logger.warning("Career path XP update failed: %s", e)

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

        result = {
            "knode_id": node_id,
            "status": record.status,
            "attempts": record.attempts,
            "best_score": record.best_score,
            "unlocked": unlocked_ids,
            "progress": progress_list,
        }
        if xp_updates:
            result["xp_updates"] = xp_updates
        return JSONResponse(result)
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

        # Auto-enroll in any career paths that include this project
        auto_enrolled_paths = []
        try:
            from systemedu.education.career_path import auto_enroll_for_project

            auto_enrolled_paths = auto_enroll_for_project(user_id, name)
        except Exception as e:
            logger.warning("Career path auto-enroll failed for %s/%s: %s", user_id, name, e)

        return JSONResponse({
            "status": enrollment.status,
            "started_at": enrollment.started_at.isoformat() if enrollment.started_at else None,
            "last_activity_at": enrollment.last_activity_at.isoformat() if enrollment.last_activity_at else None,
            "total_time_seconds": enrollment.total_time_seconds,
            "nodes_passed": enrollment.nodes_passed,
            "total_nodes": enrollment.total_nodes,
            "auto_enrolled_career_paths": auto_enrolled_paths,
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

        # Career path hook: when a project is completed, recalculate career path progress
        career_path_results = []
        if new_status == "completed":
            try:
                from systemedu.education.career_path import on_project_completed

                career_path_results = on_project_completed(user_id, name)
                if career_path_results:
                    logger.info(
                        "Career path update for %s completing %s: %s",
                        user_id, name, career_path_results,
                    )
            except Exception as e:
                logger.warning("Career path hook failed for %s/%s: %s", user_id, name, e)

        return JSONResponse({
            "status": enrollment.status,
            "started_at": enrollment.started_at.isoformat() if enrollment.started_at else None,
            "last_activity_at": enrollment.last_activity_at.isoformat() if enrollment.last_activity_at else None,
            "total_time_seconds": enrollment.total_time_seconds,
            "nodes_passed": enrollment.nodes_passed,
            "total_nodes": enrollment.total_nodes,
            "career_path_updates": career_path_results,
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


def _deep_merge(base: dict, patch: dict) -> dict:
    """递归 merge patch 进 base, dict 字段递归 merge, 其他字段覆盖。"""
    result = dict(base)
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


def _looks_like_mask(value: str) -> bool:
    """spec 017: 判断字段是否是脱敏 mask 而不是真 key。

    UI 把后端返回的 mask 原样回显时（用户没改），PUT 不应覆盖。
    mask 的判断标准: 包含 '***' 子串。
    """
    return isinstance(value, str) and "***" in value


async def api_config_update(request: Request) -> JSONResponse:
    """PUT /api/config - Update config values (deep merge).

    spec 017: api_key 字段如果是 mask 串（含 ***），保留旧 key 不覆盖。
    """
    import yaml as _yaml

    from systemedu.core.config import CONFIG_FILE, save_config

    body = await request.json()

    config_path = CONFIG_FILE
    raw: dict = {}
    if config_path.exists():
        raw = _yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}

    # spec 017: 在 deep merge 前清掉 patch 里的 mask api_key
    providers_patch = body.get("llm", {}).get("providers")
    if isinstance(providers_patch, dict):
        for prov_name, prov_fields in providers_patch.items():
            if isinstance(prov_fields, dict) and "api_key" in prov_fields:
                if _looks_like_mask(prov_fields["api_key"]) or prov_fields["api_key"] == "":
                    # 删掉这条字段，让 deep merge 保留旧 key
                    del prov_fields["api_key"]

    raw = _deep_merge(raw, body)

    save_config(raw)
    return JSONResponse({"status": "updated"})


async def api_test_llm(request: Request) -> JSONResponse:
    """POST /api/config/test-llm - 用指定 provider 发一次最小 ping 验证连通性。

    body: {"provider": "creative"}
    返回: {ok: bool, message: str, latency_ms: int}
    """
    import asyncio

    from langchain_core.messages import HumanMessage, SystemMessage

    from systemedu.core.llm_client import LLMNotConfigured, get_llm

    body = await request.json()
    provider = body.get("provider", "")
    if not provider:
        return JSONResponse({"ok": False, "message": "provider 字段必填", "latency_ms": 0}, status_code=400)

    started = time.time()
    try:
        llm = get_llm(provider=provider, streaming=False, max_tokens=8)
        async def _ping():
            return await llm.ainvoke([
                SystemMessage(content="reply with the single word: ok"),
                HumanMessage(content="ping"),
            ])
        await asyncio.wait_for(_ping(), timeout=10.0)
        elapsed = int((time.time() - started) * 1000)
        return JSONResponse({"ok": True, "message": "OK", "latency_ms": elapsed})
    except LLMNotConfigured as e:
        return JSONResponse(
            {"ok": False, "message": f"未配置 API Key: {e.provider_name}", "latency_ms": 0}
        )
    except asyncio.TimeoutError:
        return JSONResponse({"ok": False, "message": "超时（10s）", "latency_ms": 10000})
    except Exception as e:
        elapsed = int((time.time() - started) * 1000)
        return JSONResponse({"ok": False, "message": str(e)[:200], "latency_ms": elapsed})


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
    """Initialize tutor graph and background workers on startup."""
    # Pre-warm the tutor graph (non-fatal — lazy init works too)
    try:
        from systemedu.gateway import tutor_runner
        await tutor_runner._get_graph()
        logger.info("Tutor graph pre-warmed on startup")
    except Exception:
        logger.debug("Tutor graph pre-warm skipped (will lazy-init on first request)", exc_info=True)

    # Start FactExtractionWorker (non-fatal)
    global _fact_worker
    try:
        from systemedu.storage.db import get_session as _get_db
        from systemedu.tutor.memory import FactExtractor
        from systemedu.tutor.worker import FactExtractionWorker

        _fact_worker = FactExtractionWorker(
            db_session_factory=_get_db,
            extractor_factory=lambda db: FactExtractor(db=db, llm=None),
        )
        await _fact_worker.start()
        logger.info("FactExtractionWorker started")
    except Exception:
        logger.debug("FactExtractionWorker start failed (non-fatal)", exc_info=True)

    # Scan career paths directory and auto-enroll existing enrollments
    try:
        from systemedu.education.career_path import auto_enroll_for_project, scan_paths

        paths_dir = Path(__file__).resolve().parent.parent.parent.parent / "paths"
        if paths_dir.is_dir():
            loaded = scan_paths(paths_dir)
            if loaded:
                logger.info(f"Startup: loaded {len(loaded)} career paths: {loaded}")

                # Auto-enroll users who already have project enrollments
                from systemedu.storage.db import Enrollment, get_session as get_db_session

                db = get_db_session()
                try:
                    enrollments = db.query(Enrollment).filter(
                        Enrollment.status.in_(["active", "completed"])
                    ).all()
                    seen = set()
                    for e in enrollments:
                        key = (e.user_id, e.project_name)
                        if key in seen:
                            continue
                        seen.add(key)
                        try:
                            auto_enroll_for_project(e.user_id, e.project_name)
                        except Exception:
                            pass
                    if seen:
                        logger.info(f"Startup: checked {len(seen)} enrollments for career path auto-enroll")
                finally:
                    db.close()
    except Exception:
        logger.exception("Startup career path scan failed (non-fatal)")

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


# ── Capstone submission endpoints ──────────────────────────────────


def _grade_capstone_sync(
    submission_id: int,
    project_name: str,
    node_id: int,
    user_id: str,
    acceptance_standard: list[str],
    reflections: list[dict],
    checklist: list[dict],
) -> None:
    """Background thread: grade capstone reflections with LLM, update DB."""
    from systemedu.storage.db import (
        CapstoneSubmission,
        ProgressRecord,
        get_session as get_db_session,
    )

    db = get_db_session()
    try:
        sub = db.query(CapstoneSubmission).filter_by(id=submission_id).first()
        if not sub:
            return
        sub.status = "grading"
        db.commit()

        points_per = 100.0 / max(len(acceptance_standard), 1)
        feedback_items: list[dict] = []
        total_score = 0.0

        # Build a summary of checked artifacts
        checked_summary = ", ".join(
            c.get("title", c.get("artifact_id", ""))
            for c in checklist if c.get("checked")
        ) or "(none)"

        for idx, criterion in enumerate(acceptance_standard):
            reflection_text = ""
            for r in reflections:
                if r.get("criterion_idx") == idx:
                    reflection_text = r.get("description", "")
                    break

            fb_item: dict = {
                "criterion_idx": idx,
                "score": 0,
                "max_score": round(points_per, 1),
                "feedback": "",
            }

            if not reflection_text.strip():
                fb_item["feedback"] = "未填写自评说明，无法评分。"
                feedback_items.append(fb_item)
                continue

            try:
                from langchain_core.messages import HumanMessage
                from systemedu.core.llm_client import get_llm

                grading_llm = get_llm(streaming=False)
                prompt = (
                    f"你是一位严格但公正的阅卷老师，正在批改学生的大作业自评说明。\n\n"
                    f"验收标准：{criterion}\n"
                    f"学生自评说明：{reflection_text}\n"
                    f"学生勾选的交付物：{checked_summary}\n"
                    f"满分：{round(points_per)}分\n\n"
                    f"评分维度：\n"
                    f"1. 说明是否表明学生确实完成了该标准要求的内容\n"
                    f"2. 说明是否具体、有细节，而非泛泛而谈\n\n"
                    f"请严格按以下 JSON 格式输出（不要包含代码块标记）：\n"
                    f'{{"score": <0到{round(points_per)}的整数>, "feedback": "评语"}}'
                )
                resp = grading_llm.invoke([HumanMessage(content=prompt)])
                grade_text = resp.content.strip()
                if grade_text.startswith("```"):
                    lines = grade_text.split("\n")
                    grade_text = "\n".join(
                        lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                    )
                    grade_text = grade_text.strip()
                grade_result = json.loads(grade_text)
                earned = min(max(int(grade_result.get("score", 0)), 0), round(points_per))
                fb_item["score"] = earned
                fb_item["feedback"] = grade_result.get("feedback", "")
            except Exception as e:
                logger.exception("Capstone LLM grading failed for criterion %d", idx)
                fb_item["feedback"] = f"批改出错，请稍后重试。({str(e)[:80]})"

            total_score += fb_item["score"]
            feedback_items.append(fb_item)

        max_score = round(points_per * len(acceptance_standard), 1)
        passed = total_score >= max_score * 0.6

        sub.score = total_score
        sub.max_score = max_score
        sub.feedback_json = json.dumps(feedback_items, ensure_ascii=False)
        sub.status = "graded"
        sub.graded_at = datetime.now()
        db.commit()

        # Update progress
        record = (
            db.query(ProgressRecord)
            .filter_by(user_id=user_id, project_name=project_name, knode_id=node_id)
            .first()
        )
        if record:
            record.attempts = (record.attempts or 0) + 1
            if passed:
                record.status = "passed"
                record.passed_at = datetime.now()
                record.best_score = max(record.best_score or 0, total_score)
            else:
                record.status = "failed"
                record.best_score = max(record.best_score or 0, total_score)
            db.commit()

        # Unlock next nodes if passed
        if passed:
            try:
                from systemedu.education.progress import unlock_next_nodes
                from systemedu.education.project_loader import (
                    load_project_context,
                    save_progress,
                )

                ctx = load_project_context(project_name, user_id=user_id)
                unlocked = unlock_next_nodes(ctx.tree, ctx.progress, node_id)
                if unlocked:
                    save_progress(user_id, project_name, ctx.progress)
                    logger.info(
                        "Capstone passed: unlocked nodes %s for %s/%d",
                        unlocked, project_name, node_id,
                    )
            except Exception:
                logger.exception("Failed to unlock next nodes after capstone pass")

    except Exception:
        db.rollback()
        logger.exception("Capstone grading failed for submission %d", submission_id)
        # Mark as graded with zero score so frontend doesn't poll forever
        try:
            sub = db.query(CapstoneSubmission).filter_by(id=submission_id).first()
            if sub and sub.status != "graded":
                sub.status = "graded"
                sub.feedback_json = json.dumps(
                    [{"criterion_idx": 0, "score": 0, "max_score": 100, "feedback": "批改过程出错，请重新提交。"}],
                    ensure_ascii=False,
                )
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


async def api_submit_capstone(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/nodes/{node_id}/capstone/submit"""
    import threading

    from systemedu.core.config import SYSTEMEDU_HOME
    from systemedu.education.project_loader import load_project_context
    from systemedu.storage.db import (
        CapstoneSubmission,
        ProgressRecord,
        get_session as get_db_session,
    )

    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])

    try:
        form = await request.form()
    except Exception:
        return JSONResponse({"error": "Invalid form data"}, status_code=400)

    file_field = form.get("file")
    checklist_str = form.get("checklist", "[]")
    reflections_str = form.get("reflections", "[]")
    user_id = form.get("user_id", "default") or "default"

    # Parse JSON fields
    try:
        checklist = json.loads(checklist_str) if isinstance(checklist_str, str) else []
        reflections = json.loads(reflections_str) if isinstance(reflections_str, str) else []
    except (json.JSONDecodeError, TypeError):
        return JSONResponse({"error": "Invalid checklist or reflections JSON"}, status_code=400)

    if not reflections:
        return JSONResponse({"error": "Reflections are required"}, status_code=400)

    # Handle file upload (optional but encouraged)
    file_url = ""
    file_name_val = ""
    file_size_val = 0

    if file_field is not None and hasattr(file_field, "read"):
        content = await file_field.read()
        file_size_val = len(content)
        if file_size_val > 50 * 1024 * 1024:  # 50 MB
            return JSONResponse({"error": "File too large (max 50MB)"}, status_code=400)

        filename = getattr(file_field, "filename", "submission.zip") or "submission.zip"
        ext = Path(filename).suffix.lower()
        allowed = {".zip", ".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
        if ext not in allowed:
            return JSONResponse(
                {"error": f"File type {ext} not allowed. Allowed: {', '.join(sorted(allowed))}"},
                status_code=400,
            )
        file_name_val = filename

        db = get_db_session()
        try:
            prev_count = (
                db.query(CapstoneSubmission)
                .filter_by(user_id=user_id, project_name=name, knode_id=node_id)
                .count()
            )
        finally:
            db.close()
        attempt = prev_count + 1

        save_dir = (
            SYSTEMEDU_HOME / "media" / "capstone" / name
            / str(node_id) / user_id / f"attempt_{attempt}"
        )
        save_dir.mkdir(parents=True, exist_ok=True)
        save_path = save_dir / filename
        save_path.write_bytes(content)
        file_url = f"/api/media/capstone/{name}/{node_id}/{user_id}/attempt_{attempt}/{filename}"
    else:
        # No file — still allow submission (file is optional)
        db = get_db_session()
        try:
            prev_count = (
                db.query(CapstoneSubmission)
                .filter_by(user_id=user_id, project_name=name, knode_id=node_id)
                .count()
            )
        finally:
            db.close()
        attempt = prev_count + 1

    # Load acceptance_standard from knowledge tree
    acceptance_standard: list[str] = []
    try:
        ctx = load_project_context(name)
        knode = ctx.get_node_by_id(node_id)
        if knode and hasattr(knode, "acceptance_standard"):
            acceptance_standard = knode.acceptance_standard or []
    except Exception:
        logger.warning("Could not load acceptance_standard for %s/%d", name, node_id)

    # Save to DB
    db = get_db_session()
    try:
        submission = CapstoneSubmission(
            user_id=user_id,
            project_name=name,
            knode_id=node_id,
            attempt=attempt,
            checklist_json=json.dumps(checklist, ensure_ascii=False),
            reflections_json=json.dumps(reflections, ensure_ascii=False),
            file_url=file_url,
            file_name=file_name_val,
            file_size=file_size_val,
            status="submitted",
            submitted_at=datetime.now(),
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

        # Update progress to submitted
        record = (
            db.query(ProgressRecord)
            .filter_by(user_id=user_id, project_name=name, knode_id=node_id)
            .first()
        )
        if record:
            record.status = "submitted"
            db.commit()

        submission_id = submission.id

        # Launch background grading
        if acceptance_standard:
            thread = threading.Thread(
                target=_grade_capstone_sync,
                args=(
                    submission_id, name, node_id, user_id,
                    acceptance_standard, reflections, checklist,
                ),
                daemon=True,
            )
            thread.start()

        return JSONResponse({
            "submission_id": submission_id,
            "attempt": attempt,
            "status": "submitted",
            "file_url": file_url,
        })
    except Exception as e:
        db.rollback()
        logger.exception("Capstone submission failed")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()


async def api_capstone_submissions(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/capstone/submissions"""
    from systemedu.storage.db import CapstoneSubmission, get_session as get_db_session

    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])
    user_id = request.query_params.get("user_id", "default")

    db = get_db_session()
    try:
        submissions = (
            db.query(CapstoneSubmission)
            .filter_by(user_id=user_id, project_name=name, knode_id=node_id)
            .order_by(CapstoneSubmission.attempt.desc())
            .all()
        )
        result = []
        for s in submissions:
            result.append({
                "submission_id": s.id,
                "attempt": s.attempt,
                "checklist": json.loads(s.checklist_json) if s.checklist_json else [],
                "reflections": json.loads(s.reflections_json) if s.reflections_json else [],
                "file_url": s.file_url,
                "file_name": s.file_name,
                "score": s.score,
                "max_score": s.max_score,
                "feedback": json.loads(s.feedback_json) if s.feedback_json else [],
                "status": s.status,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "graded_at": s.graded_at.isoformat() if s.graded_at else None,
            })
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()


async def api_capstone_status(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/nodes/{node_id}/capstone/status"""
    from systemedu.storage.db import CapstoneSubmission, get_session as get_db_session

    name = request.path_params["name"]
    node_id = int(request.path_params["node_id"])
    user_id = request.query_params.get("user_id", "default")

    db = get_db_session()
    try:
        latest = (
            db.query(CapstoneSubmission)
            .filter_by(user_id=user_id, project_name=name, knode_id=node_id)
            .order_by(CapstoneSubmission.attempt.desc())
            .first()
        )
        if not latest:
            return JSONResponse({"status": "none", "submission_id": None})
        return JSONResponse({
            "status": latest.status,
            "submission_id": latest.id,
            "score": latest.score,
            "max_score": latest.max_score,
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()


async def api_submit_exercise_attempts(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/exercise-attempts - Batch record exercise attempts.

    Body: { user_id, attempts: [{knode_id, quiz_type, exercise_id, question,
            user_answer, correct_answer, is_correct, attempt_seq,
            time_spent_ms, error_analysis, explanation}] }
    """
    from systemedu.storage.db import ExerciseAttempt, get_session as get_db_session

    name = request.path_params["name"]
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    user_id = body.get("user_id", "default")
    attempts = body.get("attempts", [])
    if not attempts:
        return JSONResponse({"error": "No attempts provided"}, status_code=400)

    db = get_db_session()
    try:
        saved_ids = []
        for a in attempts:
            row = ExerciseAttempt(
                user_id=user_id,
                project_name=name,
                knode_id=a.get("knode_id", 0),
                quiz_type=a.get("quiz_type", ""),
                exercise_id=a.get("exercise_id", ""),
                question=a.get("question", ""),
                user_answer=str(a.get("user_answer", "")),
                correct_answer=str(a.get("correct_answer", "")),
                is_correct=bool(a.get("is_correct", False)),
                attempt_seq=a.get("attempt_seq", 1),
                time_spent_ms=a.get("time_spent_ms"),
                error_analysis=a.get("error_analysis"),
                explanation=a.get("explanation"),
            )
            db.add(row)
            db.flush()
            saved_ids.append(row.id)
        db.commit()
        return JSONResponse({"saved": len(saved_ids), "ids": saved_ids})
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()


async def api_get_exercise_attempts(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/exercise-attempts - Query exercise history.

    Query params: user_id, knode_id (optional), quiz_type (optional), limit (default 200).
    """
    from systemedu.storage.db import ExerciseAttempt, get_session as get_db_session

    name = request.path_params["name"]
    user_id = request.query_params.get("user_id", "default")
    knode_id = request.query_params.get("knode_id")
    quiz_type = request.query_params.get("quiz_type")
    limit = int(request.query_params.get("limit", "200"))

    db = get_db_session()
    try:
        q = (
            db.query(ExerciseAttempt)
            .filter_by(user_id=user_id, project_name=name)
        )
        if knode_id:
            q = q.filter(ExerciseAttempt.knode_id == int(knode_id))
        if quiz_type:
            q = q.filter(ExerciseAttempt.quiz_type == quiz_type)
        rows = q.order_by(ExerciseAttempt.created_at.desc()).limit(limit).all()

        return JSONResponse({"attempts": [
            {
                "id": r.id,
                "knode_id": r.knode_id,
                "quiz_type": r.quiz_type,
                "exercise_id": r.exercise_id,
                "question": r.question,
                "user_answer": r.user_answer,
                "correct_answer": r.correct_answer,
                "is_correct": r.is_correct,
                "attempt_seq": r.attempt_seq,
                "time_spent_ms": r.time_spent_ms,
                "error_analysis": r.error_analysis,
                "explanation": r.explanation,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()


async def api_get_exercise_stats(request: Request) -> JSONResponse:
    """GET /api/projects/{name}/exercise-stats - Aggregated exercise metrics for tutor agent.

    Query params: user_id, knode_id (optional).
    Returns per-exercise and per-knode accuracy, avg time, retry rate, weak spots.
    """
    from sqlalchemy import func

    from systemedu.storage.db import ExerciseAttempt, get_session as get_db_session

    name = request.path_params["name"]
    user_id = request.query_params.get("user_id", "default")
    knode_id = request.query_params.get("knode_id")

    db = get_db_session()
    try:
        base = db.query(ExerciseAttempt).filter_by(
            user_id=user_id, project_name=name,
        )
        if knode_id:
            base = base.filter(ExerciseAttempt.knode_id == int(knode_id))

        rows = base.all()
        if not rows:
            return JSONResponse({
                "total_attempts": 0,
                "first_try_accuracy": 0,
                "overall_accuracy": 0,
                "avg_time_ms": 0,
                "retry_rate": 0,
                "weak_exercises": [],
                "per_knode": {},
                "per_quiz_type": {},
            })

        # --- compute aggregated metrics ---
        total = len(rows)
        correct_count = sum(1 for r in rows if r.is_correct)
        first_tries = [r for r in rows if r.attempt_seq == 1]
        first_correct = sum(1 for r in first_tries if r.is_correct)
        retries = [r for r in rows if r.attempt_seq > 1]
        times = [r.time_spent_ms for r in rows if r.time_spent_ms is not None]

        # per-exercise: group by (knode_id, exercise_id)
        from collections import defaultdict
        ex_groups: dict[tuple, list] = defaultdict(list)
        knode_groups: dict[int, list] = defaultdict(list)
        quiz_type_groups: dict[str, list] = defaultdict(list)

        for r in rows:
            ex_groups[(r.knode_id, r.exercise_id)].append(r)
            knode_groups[r.knode_id].append(r)
            quiz_type_groups[r.quiz_type].append(r)

        # weak exercises: first-try wrong
        weak = []
        for (kid, eid), group in ex_groups.items():
            first = [g for g in group if g.attempt_seq == 1]
            if first and not first[0].is_correct:
                weak.append({
                    "knode_id": kid,
                    "exercise_id": eid,
                    "question": first[0].question,
                    "total_attempts": len(group),
                    "eventually_correct": any(g.is_correct for g in group),
                    "error_analysis": first[0].error_analysis or first[0].explanation or "",
                })

        # per-knode stats
        per_knode = {}
        for kid, group in knode_groups.items():
            ft = [g for g in group if g.attempt_seq == 1]
            per_knode[str(kid)] = {
                "total_attempts": len(group),
                "first_try_accuracy": round(sum(1 for g in ft if g.is_correct) / max(len(ft), 1), 2),
                "overall_accuracy": round(sum(1 for g in group if g.is_correct) / len(group), 2),
                "retry_count": sum(1 for g in group if g.attempt_seq > 1),
            }

        # per quiz_type stats
        per_qt = {}
        for qt, group in quiz_type_groups.items():
            ft = [g for g in group if g.attempt_seq == 1]
            per_qt[qt] = {
                "total_attempts": len(group),
                "first_try_accuracy": round(sum(1 for g in ft if g.is_correct) / max(len(ft), 1), 2),
                "overall_accuracy": round(sum(1 for g in group if g.is_correct) / len(group), 2),
            }

        return JSONResponse({
            "total_attempts": total,
            "first_try_accuracy": round(first_correct / max(len(first_tries), 1), 2),
            "overall_accuracy": round(correct_count / total, 2),
            "avg_time_ms": round(sum(times) / max(len(times), 1)) if times else 0,
            "retry_rate": round(len(retries) / total, 2),
            "weak_exercises": weak,
            "per_knode": per_knode,
            "per_quiz_type": per_qt,
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        db.close()


async def api_evaluate_qa(request: Request) -> JSONResponse:
    """POST /api/projects/{name}/evaluate-qa - AI-grade a QA (open-ended) answer.

    Body: { user_id, knode_id, exercise_id, question, user_answer,
            reference_answer, attempt_seq, time_spent_ms }
    Returns: { score, max_score, is_correct, feedback, error_analysis, attempt_id }
    Also persists the result as an ExerciseAttempt row.
    """
    from systemedu.storage.db import ExerciseAttempt, get_session as get_db_session

    name = request.path_params["name"]
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    user_id = body.get("user_id", "default")
    knode_id = body.get("knode_id", 0)
    exercise_id = body.get("exercise_id", "")
    question = body.get("question", "")
    user_answer = body.get("user_answer", "")
    reference_answer = body.get("reference_answer", "")
    attempt_seq = body.get("attempt_seq", 1)
    time_spent_ms = body.get("time_spent_ms")

    if not user_answer.strip():
        return JSONResponse({"error": "user_answer is empty"}, status_code=400)

    max_score = 10
    score = 0
    feedback = ""
    error_analysis = ""

    try:
        from systemedu.core.llm_client import get_llm
        from langchain_core.messages import HumanMessage

        grading_llm = get_llm(streaming=False)
        grading_prompt = (
            f"你是一位耐心且严格的阅卷老师，正在批改一道面向青少年学生的开放性问答题。\n\n"
            f"题目：{question}\n"
            f"参考答案要点：\n{reference_answer}\n\n"
            f"学生回答：{user_answer}\n"
            f"满分：{max_score}分\n\n"
            f"请严格按以下 JSON 格式输出（不要包含 markdown 代码块标记）：\n"
            f'{{"score": <0到{max_score}的整数>, "feedback": "对学生的鼓励性评语，指出优点和不足，50-100字", '
            f'"error_analysis": "如果扣分了，具体说明哪些要点没覆盖或理解有误，30-80字；满分则留空字符串"}}\n\n'
            f"评分标准：\n"
            f"- 核心概念是否正确（40%）\n"
            f"- 参考答案要点覆盖完整度（30%）\n"
            f"- 表述是否清晰有逻辑（20%）\n"
            f"- 有自己的思考或举例加分（10%）\n"
        )
        resp = grading_llm.invoke([HumanMessage(content=grading_prompt)])
        grade_text = resp.content.strip()
        if grade_text.startswith("```"):
            lines = grade_text.split("\n")
            grade_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            grade_text = grade_text.strip()
        grade_result = json.loads(grade_text)
        score = min(max(int(grade_result.get("score", 0)), 0), max_score)
        feedback = grade_result.get("feedback", "")
        error_analysis = grade_result.get("error_analysis", "")
    except Exception as e:
        logger.exception("LLM QA grading failed")
        score = 0
        feedback = f"AI 批改出错，请稍后重试。({str(e)[:60]})"
        error_analysis = ""

    is_correct = score >= max_score * 0.6

    # Persist to exercise_attempts
    db = get_db_session()
    attempt_id = None
    try:
        row = ExerciseAttempt(
            user_id=user_id,
            project_name=name,
            knode_id=knode_id,
            quiz_type="assignment",
            exercise_id=exercise_id,
            question=question,
            user_answer=user_answer,
            correct_answer=reference_answer,
            is_correct=is_correct,
            attempt_seq=attempt_seq,
            time_spent_ms=time_spent_ms,
            error_analysis=error_analysis,
            explanation=feedback,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        attempt_id = row.id
    except Exception as e:
        db.rollback()
        logger.exception("Failed to save QA evaluation to DB")
    finally:
        db.close()

    return JSONResponse({
        "score": score,
        "max_score": max_score,
        "is_correct": is_correct,
        "feedback": feedback,
        "error_analysis": error_analysis,
        "attempt_id": attempt_id,
    })


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
        if (
            path in _AUTH_PUBLIC_PATHS
            or path.startswith("/api/media/")
            or path.startswith("/api/course-images/")
        ):
            await self.app(scope, receive, send)
            return

        # Extract token: Authorization header (HTTP) or ?token= query param (WebSocket)
        headers = dict(scope.get("headers", []))
        auth = headers.get(b"authorization", b"").decode("utf-8", errors="replace")
        token = auth[7:] if auth.startswith("Bearer ") else ""

        # For WebSocket and SSE (HTTP streaming), browsers can't always set custom headers
        # Fall back to ?token= query param
        if not token:
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


# --- Career Path (Upgrade Route) API ---


async def api_career_paths_list(request: Request) -> JSONResponse:
    """GET /api/career-paths - List all career paths with basic progress."""
    from systemedu.education.career_path import list_paths

    paths = list_paths()
    return JSONResponse(paths)


async def api_career_path_detail(request: Request) -> JSONResponse:
    """GET /api/career-paths/{name} - Career path detail with progress."""
    from systemedu.education.career_path import get_path_progress

    name = request.path_params["name"]
    user_id = request.query_params.get("user_id", "default")
    progress = get_path_progress(user_id, name)
    if not progress:
        return JSONResponse({"error": "Career path not found"}, status_code=404)
    return JSONResponse(progress)


async def api_career_path_enroll(request: Request) -> JSONResponse:
    """POST /api/career-paths/{name}/enroll - Enroll in a career path."""
    from systemedu.education.career_path import enroll_path, load_path

    name = request.path_params["name"]
    body = await request.json()
    user_id = body.get("user_id", "default")

    cp = load_path(name)
    if not cp:
        return JSONResponse({"error": "Career path not found"}, status_code=404)

    result = enroll_path(user_id, name)
    return JSONResponse(result)


async def api_career_path_badge_svg(request: Request) -> JSONResponse:
    """GET /api/career-paths/{name}/badges/{order} - Get badge SVG."""
    from starlette.responses import Response

    from systemedu.education.career_path import get_badge_svg, load_path

    name = request.path_params["name"]
    order = int(request.path_params["order"])

    cp = load_path(name)
    if not cp:
        return JSONResponse({"error": "Career path not found"}, status_code=404)

    stage = next((s for s in cp.stages if s.order == order), None)
    if not stage or not stage.badge or not stage.badge.icon:
        return JSONResponse({"error": "Badge not found"}, status_code=404)

    svg = get_badge_svg(name, stage.badge.icon)
    if not svg:
        return JSONResponse({"error": "Badge SVG file not found"}, status_code=404)

    return Response(content=svg, media_type="image/svg+xml")


async def api_career_path_avatar_svg(request: Request) -> JSONResponse:
    """GET /api/career-paths/{name}/avatar/{stage} - Get avatar SVG."""
    from starlette.responses import Response

    from systemedu.education.career_path import get_avatar_svg

    name = request.path_params["name"]
    stage = int(request.path_params["stage"])

    svg = get_avatar_svg(name, stage)
    if not svg:
        return JSONResponse({"error": "Avatar SVG not found"}, status_code=404)

    return Response(content=svg, media_type="image/svg+xml")


async def api_all_badges(request: Request) -> JSONResponse:
    """GET /api/badges - Get all earned badges for a user."""
    from systemedu.education.career_path import get_all_earned_badges

    user_id = request.query_params.get("user_id", "default")
    badges = get_all_earned_badges(user_id)
    return JSONResponse(badges)


# --- Tutor Endpoints (spec 014 T5.3) ---


async def api_tutor_session_end(request: Request) -> JSONResponse:
    """POST /api/tutor/session/end - Signal session ended, enqueue fact extraction."""
    from systemedu.storage.db import get_session as get_db_session
    from systemedu.tutor.memory.pending_extraction import PendingFactExtractionDAO

    body = await request.json()
    session_id = body.get("session_id")
    user_id = body.get("user_id", "default")

    if not session_id:
        return JSONResponse({"error": "session_id is required"}, status_code=400)

    db = get_db_session()
    try:
        dao = PendingFactExtractionDAO(db)
        row = dao.enqueue(
            session_id=session_id,
            user_id=user_id,
            last_message_at=datetime.utcnow(),
        )
        return JSONResponse({
            "status": "enqueued",
            "session_id": row.session_id,
        })
    finally:
        db.close()


async def api_tutor_facts(request: Request) -> JSONResponse:
    """GET /api/tutor/facts - List student facts for a user."""
    from systemedu.storage.db import get_session as get_db_session
    from systemedu.tutor.memory.student_fact import StudentFactDAO

    user_id = request.query_params.get("user_id", "default")
    project_name = request.query_params.get("project_name")
    category = request.query_params.get("category")

    db = get_db_session()
    try:
        dao = StudentFactDAO(db)
        facts = dao.list_by_user(
            user_id,
            project_name=project_name,
            category=category,
        )
        return JSONResponse([
            {
                "id": f.id,
                "user_id": f.user_id,
                "project_name": f.project_name,
                "knode_id": f.knode_id,
                "category": f.category,
                "content": f.content,
                "confidence": f.confidence,
                "valid_from": f.valid_from.isoformat() if f.valid_from else None,
                "valid_to": f.valid_to.isoformat() if f.valid_to else None,
            }
            for f in facts
        ])
    finally:
        db.close()


async def api_tutor_session_history(request: Request) -> JSONResponse:
    """GET /api/tutor/session/{id}/history - Tool call log for a session."""
    from systemedu.storage.db import get_session as get_db_session
    from systemedu.tutor.audit.tool_call_log import ToolCallLogDAO

    session_id = request.path_params["id"]

    db = get_db_session()
    try:
        dao = ToolCallLogDAO(db)
        rows = dao.list_by_session(session_id)
        return JSONResponse([
            {
                "id": r.id,
                "tool_name": r.tool_name,
                "args": r.args_json,
                "result": r.result_json,
                "approved": r.approved,
                "called_at": r.called_at.isoformat() if r.called_at else None,
                "latency_ms": r.latency_ms,
                "error": r.error,
            }
            for r in rows
        ])
    finally:
        db.close()


async def api_tutor_session_delete(request: Request) -> JSONResponse:
    """DELETE /api/tutor/session/{id} - Delete a tutor session's checkpoint."""
    session_id = request.path_params["id"]

    try:
        from systemedu.gateway import tutor_runner

        graph = await tutor_runner._get_graph()
        if hasattr(graph, "checkpointer") and graph.checkpointer is not None:
            cp = graph.checkpointer
            config = {"configurable": {"thread_id": session_id}}
            # LangGraph checkpointers support aget_tuple; we can write an empty
            # state to effectively "clear" it.  A proper delete API doesn't
            # exist in the LangGraph checkpoint interface, so we put an empty
            # checkpoint to mark it as cleared.
            try:
                existing = await cp.aget_tuple(config)
                if existing is not None:
                    await cp.aput(
                        config,
                        {"messages": [], "user_id": "", "project_name": ""},
                        {"source": "delete", "step": -1, "writes": {}},
                        {},
                    )
            except Exception:
                logger.debug("Checkpoint clear failed for %s", session_id, exc_info=True)
    except Exception:
        logger.debug("tutor_runner unavailable for session delete", exc_info=True)

    return JSONResponse({"status": "deleted", "session_id": session_id})


async def api_tutor_escalations(request: Request) -> JSONResponse:
    """GET /api/tutor/escalations - List open escalations (admin)."""
    from systemedu.storage.db import get_session as get_db_session
    from systemedu.tutor.audit.escalation import EscalationDAO

    user_id = request.query_params.get("user_id")

    db = get_db_session()
    try:
        dao = EscalationDAO(db)
        rows = dao.list_open(user_id=user_id)
        return JSONResponse([
            {
                "id": r.id,
                "user_id": r.user_id,
                "session_id": r.session_id,
                "reason": r.reason,
                "severity": r.severity,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ])
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
        Route("/api/config/test-llm", api_test_llm, methods=["POST"]),
        Route("/api/sessions", api_sessions),
        Route("/api/sessions/full", api_sessions_full),
        Route("/api/sessions/{id}", api_session_detail),
        Route("/api/chat", api_chat, methods=["POST"]),
        Route("/api/projects", api_projects_dispatch, methods=["GET", "POST"]),
        Route("/api/projects/preview-tree", api_preview_tree, methods=["POST"]),
        Route("/api/projects/generate-description", api_generate_description, methods=["POST"]),
        Route("/api/projects/generate-tree", api_generate_tree, methods=["POST"]),

        Route("/api/projects/{name}/enroll", api_enroll, methods=["POST"]),
        Route("/api/projects/{name}/enrollment", api_enrollment_dispatch, methods=["GET", "PATCH"]),
        Route("/api/projects/{name}/lesson-statuses", api_lesson_statuses, methods=["GET"]),
        Route("/api/projects/{name}/theories", api_project_theories, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/context", api_node_context),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v2/generate", api_generate_course_v2, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v2/stream", api_course_v2_stream, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v2/cancel", api_course_v2_cancel, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v2/assignment", api_get_course_v2_assignment, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v2", api_get_course_v2, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v3/versions", api_list_course_v3_versions, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v3/active", api_set_course_v3_active, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v3/slides", api_list_course_v3_slides, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v3/slides/regenerate", api_regenerate_course_v3_slides, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/course/v3", api_get_course_v3, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/progress", api_update_progress, methods=["PATCH"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/highlights", api_highlights_dispatch, methods=["GET", "POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/practice/submit", api_submit_practice, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/practice/submissions", api_practice_submissions, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/capstone/submit", api_submit_capstone, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/capstone/submissions", api_capstone_submissions, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/capstone/status", api_capstone_status, methods=["GET"]),
        # Exercise attempts (unified tracking for theory/practice/assignment)
        Route("/api/projects/{name}/exercise-attempts", api_submit_exercise_attempts, methods=["POST"]),
        Route("/api/projects/{name}/exercise-attempts", api_get_exercise_attempts, methods=["GET"]),
        Route("/api/projects/{name}/exercise-stats", api_get_exercise_stats, methods=["GET"]),
        Route("/api/projects/{name}/evaluate-qa", api_evaluate_qa, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/highlights/{highlight_id:int}", api_delete_highlight, methods=["DELETE"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/resources/search", api_search_resources, methods=["POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/resources", api_resources_dispatch, methods=["GET", "POST"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/resources/{resource_id:int}", api_toggle_resource_saved, methods=["PATCH"]),
        Route("/api/projects/{name}/resources", api_get_all_resources, methods=["GET"]),
        Route("/api/projects/{name}/nodes/{node_id:int}/note", api_note_dispatch, methods=["GET", "PUT"]),
        Route("/api/projects/{name}/notes", api_get_all_notes, methods=["GET"]),
        Route("/api/projects/{name}/cover", api_upload_project_cover, methods=["POST"]),
        Route("/api/projects/{name}/icon/generate", api_generate_project_icon, methods=["POST"]),

        Route("/api/projects/{name}/tree", api_update_tree, methods=["PUT"]),
        Route("/api/projects/{name}", api_project_dispatch, methods=["GET", "PATCH", "DELETE"]),
        # Career path (upgrade route) endpoints
        Route("/api/career-paths", api_career_paths_list, methods=["GET"]),
        Route("/api/career-paths/{name}", api_career_path_detail, methods=["GET"]),
        Route("/api/career-paths/{name}/enroll", api_career_path_enroll, methods=["POST"]),
        Route("/api/career-paths/{name}/badges/{order:int}", api_career_path_badge_svg, methods=["GET"]),
        Route("/api/career-paths/{name}/avatar/{stage:int}", api_career_path_avatar_svg, methods=["GET"]),
        Route("/api/badges", api_all_badges, methods=["GET"]),

        Route("/api/tutor/session/end", api_tutor_session_end, methods=["POST"]),
        Route("/api/tutor/facts", api_tutor_facts, methods=["GET"]),
        Route("/api/tutor/session/{id}/history", api_tutor_session_history, methods=["GET"]),
        Route("/api/tutor/session/{id}", api_tutor_session_delete, methods=["DELETE"]),
        Route("/api/tutor/escalations", api_tutor_escalations, methods=["GET"]),
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

    # Mount static course images directory (populated by course_factory.factory
    # when downloading CC-BY/CC0 images referenced in knode content)
    from pathlib import Path as _Path
    course_images_dir = _Path(__file__).parent.parent.parent.parent / "course_factory" / "images"
    course_images_dir.mkdir(parents=True, exist_ok=True)
    routes.append(
        Mount(
            "/api/course-images",
            StaticFiles(directory=str(course_images_dir)),
            name="course-images",
        )
    )

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

    async def _on_shutdown():
        """Close tutor graph checkpointer and stop worker on gateway shutdown."""
        global _fact_worker
        if _fact_worker is not None:
            try:
                await _fact_worker.stop()
                logger.info("FactExtractionWorker stopped")
            except Exception:
                pass
            _fact_worker = None
        try:
            from systemedu.gateway import tutor_runner
            await tutor_runner.shutdown()
        except Exception:
            pass

    # spec 017: 全局 412 LLM_NOT_CONFIGURED
    from systemedu.core.llm_client import LLMNotConfigured

    async def _llm_not_configured_handler(request: Request, exc: LLMNotConfigured) -> JSONResponse:
        return JSONResponse(
            {
                "error": "LLM_NOT_CONFIGURED",
                "message": str(exc),
                "provider": exc.provider_name,
            },
            status_code=412,
        )

    # Starlette 1.0 lifespan API (替代 on_startup / on_shutdown 弃用参数)
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _lifespan(_app):
        await _on_startup()
        try:
            yield
        finally:
            await _on_shutdown()

    app = Starlette(
        routes=routes,
        middleware=middleware,
        lifespan=_lifespan,
        exception_handlers={LLMNotConfigured: _llm_not_configured_handler},
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
