"""spec 036: 用户级 knode 完成 + 跨项目知识点亮聚合 + 推荐项目 4 个 API.

POST /api/my/knodes/{slug}/{knode_id}/complete  - toggle (action=toggle/complete/incomplete)
GET  /api/my/knodes/{slug}/complete-status      - 该项目用户已完成 knode 列表
GET  /api/user/knowledge-tree                   - 跨项目聚合点亮
GET  /api/user/recommendations?limit=3          - 推荐下一项目
"""

from __future__ import annotations

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..auth.deps import require_login
from .user_lit import (
    compute_user_lit_nodes,
    get_completed_knode_ids,
    recommend_next_projects,
    toggle_complete,
)


logger = logging.getLogger(__name__)


async def api_knode_toggle_complete(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    slug = request.path_params["slug"]
    knode_id = request.path_params["knode_id"]

    try:
        body = await request.json()
    except Exception:
        body = {}
    action = body.get("action", "toggle")
    if action not in ("toggle", "complete", "incomplete"):
        return JSONResponse({"error": "invalid_action"}, status_code=400)

    library_version = body.get("library_version")

    try:
        completed = toggle_complete(
            user_id=user_id,
            project_slug=slug,
            knode_id=knode_id,
            action=action,
            library_version=library_version,
        )
    except Exception as e:
        logger.exception("toggle_complete failed")
        return JSONResponse({"error": "internal", "detail": str(e)}, status_code=500)

    # spec 039: 完成 knode → 入队知识树生长评估 (异步, 不拖慢响应)。
    # content 存轻量标识 knode:<slug>:<knode_id>, evaluator 异步反查 library 取概念。
    if completed:
        try:
            from ..db import enqueue_growth
            enqueue_growth(user_id=user_id, source="complete_knode",
                           content=f"knode:{slug}:{knode_id}")
        except Exception:
            logger.warning("enqueue_growth failed (non-fatal)", exc_info=True)

    return JSONResponse({
        "slug": slug,
        "knode_id": knode_id,
        "completed": completed,
    })


async def api_knode_complete_status(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    slug = request.path_params["slug"]
    try:
        ids = get_completed_knode_ids(user_id, slug)
    except Exception as e:
        logger.exception("get_completed_knode_ids failed")
        return JSONResponse({"error": "internal", "detail": str(e)}, status_code=500)
    return JSONResponse({"slug": slug, "completed_knode_ids": ids})


async def api_user_knowledge_tree(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        data = await compute_user_lit_nodes(user_id)
    except Exception as e:
        logger.exception("compute_user_lit_nodes failed")
        return JSONResponse({"error": "internal", "detail": str(e)}, status_code=500)
    return JSONResponse(data)


async def api_user_recommendations(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        limit = int(request.query_params.get("limit", 3))
    except ValueError:
        limit = 3
    limit = max(1, min(limit, 10))
    try:
        data = await recommend_next_projects(user_id, limit=limit)
    except Exception as e:
        logger.exception("recommend_next_projects failed")
        return JSONResponse({"error": "internal", "detail": str(e)}, status_code=500)
    return JSONResponse(data)


ROUTES = [
    Route(
        "/api/my/knodes/{slug}/{knode_id}/complete",
        api_knode_toggle_complete,
        methods=["POST"],
    ),
    Route(
        "/api/my/knodes/{slug}/complete-status",
        api_knode_complete_status,
        methods=["GET"],
    ),
    Route(
        "/api/user/knowledge-tree",
        api_user_knowledge_tree,
        methods=["GET"],
    ),
    Route(
        "/api/user/recommendations",
        api_user_recommendations,
        methods=["GET"],
    ),
]
