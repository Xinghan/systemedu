"""spec 042: 徽章墙 API.

GET /api/my/badges  - 当前用户八大分会的徽章持有情况
"""
from __future__ import annotations

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..auth.deps import require_login
from ..db import UserBadge, get_session
from .chapters import CHAPTER_DISPLAY_NAME, TIER_ORDER

logger = logging.getLogger(__name__)


async def api_my_badges(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err

    counts: dict[str, dict[str, int]] = {
        chapter: {tier: 0 for tier in TIER_ORDER} for chapter in CHAPTER_DISPLAY_NAME
    }
    with get_session() as db:
        rows = (
            db.query(UserBadge)
            .filter_by(user_id=user_id, consumed=False)
            .all()
        )
        for row in rows:
            if row.chapter in counts and row.tier in counts[row.chapter]:
                counts[row.chapter][row.tier] += 1

    chapters = []
    for chapter, display_name in CHAPTER_DISPLAY_NAME.items():
        chapter_counts = counts[chapter]
        highest_tier = None
        for tier in reversed(TIER_ORDER):
            if chapter_counts[tier] > 0:
                highest_tier = tier
                break
        chapters.append({
            "chapter": chapter,
            "display_name": display_name,
            "counts": chapter_counts,
            "highest_tier": highest_tier,
        })

    return JSONResponse({"chapters": chapters})


ROUTES = [
    Route("/api/my/badges", api_my_badges, methods=["GET"]),
]
