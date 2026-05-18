"""spec 032 P2: 学生 memory 管理 endpoint.

GET    /api/memory/facts           当前 user 所有 current StudentFact (按 category 分组)
DELETE /api/memory/facts/{id}      手动 retire 一条 (valid_to=now)
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from sqlalchemy import select

from ..auth.deps import require_login
from .. import db as _db

log = logging.getLogger(__name__)


async def api_list_facts(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    facts = _db.list_current_facts(user_id, limit=500)
    # 按 category 分组渲染
    grouped: dict[str, list[dict]] = defaultdict(list)
    for f in facts:
        # 序列化 datetime
        item = dict(f)
        for k in ("valid_from", "valid_to", "created_at"):
            v = item.get(k)
            if isinstance(v, datetime):
                item[k] = v.isoformat()
        grouped[f["category"] or "other"].append(item)
    return JSONResponse({
        "total": len(facts),
        "by_category": dict(grouped),
    })


async def api_retire_fact(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    fact_id = request.path_params["fact_id"]
    ok, reason = _db.retire_fact(fact_id, user_id)
    if ok:
        return JSONResponse({"retired": True, "id": fact_id})
    if reason == "not_found":
        return JSONResponse({"error": "not_found"}, status_code=404)
    if reason == "forbidden":
        return JSONResponse({"error": "forbidden"}, status_code=403)
    return JSONResponse({"error": reason}, status_code=400)


ROUTES = [
    Route("/api/memory/facts", api_list_facts, methods=["GET"]),
    Route("/api/memory/facts/{fact_id}", api_retire_fact, methods=["DELETE"]),
]
