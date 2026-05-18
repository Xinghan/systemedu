"""spec 031 P5: 学生答题尝试 POST 路由.

POST /api/exercise/attempt  body: {library_slug, module_id, idea_id?,
    exercise_index?, question?, student_answer?, correct: bool}
返回: {ok: True, id: str}

前端 LearnPage 在学生提交一道题后调一次. 后端写 ExerciseAttempt, 用于
StudentMemoryInjector.L3 答题历史层 (当前 module 统计 + 项目级错题)。
"""

from __future__ import annotations

import logging

from pydantic import BaseModel
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..auth.deps import require_login
from .. import db as _db

log = logging.getLogger(__name__)


class ExerciseAttemptPayload(BaseModel):
    library_slug: str
    module_id: str
    correct: bool
    idea_id: str | None = None
    exercise_index: int | None = None
    question: str | None = None
    student_answer: str | None = None


async def api_exercise_attempt(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        body = await request.json()
        payload = ExerciseAttemptPayload(**body)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)

    try:
        row = _db.record_exercise_attempt(
            user_id,
            payload.library_slug,
            payload.module_id,
            idea_id=payload.idea_id,
            exercise_index=payload.exercise_index,
            question=payload.question,
            student_answer=payload.student_answer,
            correct=payload.correct,
        )
    except Exception as e:
        log.exception("exercise_attempt insert failed")
        return JSONResponse({"error": "insert_failed", "detail": str(e)}, status_code=500)

    return JSONResponse({"ok": True, "id": row["id"]}, status_code=201)


ROUTES = [
    Route("/api/exercise/attempt", api_exercise_attempt, methods=["POST"]),
]
