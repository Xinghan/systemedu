"""知识钻取端点 (spec 2026-06-09).

POST /api/knowledge/drill  body {library_slug, module_id, highlight_text}
  → 已存 (user,slug,module,highlight) 则复用; 否则取 knode 上下文 + LLM 生成 + 存。
GET  /api/knowledge/drill?library_slug=&module_id=
  → 列该 user 在该 knode 的所有钻取记录。
"""
from __future__ import annotations

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..auth.deps import require_login
from ..library_proxy.client import get_library_client
from .. import db as _db
from .generator import generate_drill

log = logging.getLogger(__name__)


async def api_drill_create(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        body = await request.json()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    slug = (body.get("library_slug") or "").strip()
    module_id = (body.get("module_id") or "").strip()
    highlight = (body.get("highlight_text") or "").strip()
    if not (slug and module_id and highlight):
        return JSONResponse({"error": "library_slug/module_id/highlight_text required"}, status_code=400)

    # 复用已存
    existing = _db.get_drill_by_highlight(user_id, slug, module_id, highlight)
    if existing:
        return JSONResponse(existing)

    # 取 knode 上下文
    knode_title, knode_context = "", ""
    try:
        k = await get_library_client().get_knode(slug, module_id)
        knode_title = getattr(k, "title", "") or ""
        knode_context = getattr(k, "plan_markdown", "") or ""
    except Exception:
        log.warning("drill: get_knode failed slug=%s module=%s", slug, module_id)

    try:
        content = await generate_drill(highlight, knode_title, knode_context)
    except Exception as e:
        log.exception("drill generate failed")
        return JSONResponse({"error": "drill_generate_failed", "detail": str(e)}, status_code=500)

    saved = _db.create_drill(user_id, slug, module_id, highlight, content)
    return JSONResponse(saved, status_code=201)


async def api_drill_list(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    slug = request.query_params.get("library_slug", "")
    module_id = request.query_params.get("module_id", "")
    if not (slug and module_id):
        return JSONResponse({"error": "library_slug/module_id required"}, status_code=400)
    return JSONResponse({"drills": _db.list_drills(user_id, slug, module_id)})


ROUTES = [
    Route("/api/knowledge/drill", api_drill_create, methods=["POST"]),
    Route("/api/knowledge/drill", api_drill_list, methods=["GET"]),
]
