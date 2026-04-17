"""Practice + grading tools (spec 014 T4.3g-h)."""

from __future__ import annotations

import json
from typing import Any

from systemedu.storage.db import LessonContent
from systemedu.tutor.tools.decorator import require_tool_context, tutor_tool


@tutor_tool(access="read", scope="project", description="获取练习题(自动剔除正确答案)")
async def get_practice_exercises(project_name: str, knode_id: str) -> dict[str, Any]:
    ctx = require_tool_context()
    if ctx.db is None:
        return {"error": "db not configured"}
    db = ctx.db()
    try:
        row = (
            db.query(LessonContent)
            .filter(
                LessonContent.project_name == project_name,
                LessonContent.knode_id == int(knode_id),
            )
            .one_or_none()
        )
        if row is None:
            return {"found": False, "exercises": []}

        exercises: list[dict] = []
        # course_content JSON has exercises embedded
        if row.course_content:
            try:
                cc = json.loads(row.course_content)
                raw = cc.get("exercises") or []
                for ex in raw:
                    safe = dict(ex)
                    safe.pop("correct", None)
                    safe.pop("answer", None)
                    exercises.append(safe)
            except (json.JSONDecodeError, TypeError):
                pass
        # Fallback: quiz_data column (legacy)
        if not exercises and row.quiz_data:
            try:
                raw = json.loads(row.quiz_data)
                if isinstance(raw, list):
                    for ex in raw:
                        safe = dict(ex)
                        safe.pop("correct", None)
                        safe.pop("answer", None)
                        exercises.append(safe)
            except (json.JSONDecodeError, TypeError):
                pass

        return {"found": True, "knode_id": knode_id, "exercises": exercises}
    finally:
        db.close()


@tutor_tool(access="write", scope="user_self", description="评分学生提交的答案")
async def grade_submission(
    project_name: str,
    knode_id: str,
    exercise_id: str,
    student_answer: str,
) -> dict[str, Any]:
    ctx = require_tool_context()
    if ctx.db is None:
        return {"error": "db not configured"}
    db = ctx.db()
    try:
        row = (
            db.query(LessonContent)
            .filter(
                LessonContent.project_name == project_name,
                LessonContent.knode_id == int(knode_id),
            )
            .one_or_none()
        )
        if row is None:
            return {"graded": False, "reason": "knode not found"}

        correct_answer: str | None = None
        if row.course_content:
            try:
                cc = json.loads(row.course_content)
                for ex in cc.get("exercises") or []:
                    if ex.get("exercise_id") == exercise_id:
                        correct_answer = ex.get("correct")
                        break
            except (json.JSONDecodeError, TypeError):
                pass
        if not correct_answer and row.quiz_data:
            try:
                for ex in json.loads(row.quiz_data):
                    if ex.get("exercise_id") == exercise_id:
                        correct_answer = ex.get("correct") or ex.get("answer")
                        break
            except (json.JSONDecodeError, TypeError):
                pass

        if correct_answer is None:
            return {"graded": False, "reason": "exercise not found"}

        is_correct = student_answer.strip().lower() == str(correct_answer).strip().lower()
        return {
            "graded": True,
            "exercise_id": exercise_id,
            "is_correct": is_correct,
            "correct_answer": correct_answer,
        }
    finally:
        db.close()


__all__ = ["get_practice_exercises", "grade_submission"]
