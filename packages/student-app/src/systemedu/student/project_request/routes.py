"""/api/project-requests — 学生提交项目申请 idea (spec 038)。

POST /api/project-requests   body {idea_text}   需登录, 存一条, 返 {ok, id}
"""
from __future__ import annotations

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..auth.deps import require_login
from ..db import create_project_request


logger = logging.getLogger(__name__)

MAX_IDEA_LEN = 5000


async def api_submit_request(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid_json"}, status_code=400)

    idea_text = (body.get("idea_text") or "").strip()
    if not idea_text:
        return JSONResponse({"error": "idea_required"}, status_code=400)
    if len(idea_text) > MAX_IDEA_LEN:
        return JSONResponse({"error": "idea_too_long", "max": MAX_IDEA_LEN}, status_code=400)

    req = create_project_request(user_id, idea_text)
    logger.info("project request submitted user=%s id=%s", user_id, req.id)
    return JSONResponse({"ok": True, "id": req.id}, status_code=201)


ROUTES = [
    Route("/api/project-requests", api_submit_request, methods=["POST"]),
]
