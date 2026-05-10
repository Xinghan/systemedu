"""Progress + knode tools (spec 014 T4.3a-d)."""

from __future__ import annotations

import json
from typing import Any

from systemedu.core.storage.db import LessonContent, ProgressRecord
from systemedu.core.tutor.tools.decorator import require_tool_context, tutor_tool


@tutor_tool(access="read", scope="user_self", description="查询学生在指定项目的学习进度")
async def get_progress(project_name: str) -> dict[str, Any]:
    ctx = require_tool_context()
    if ctx.db is None:
        return {"error": "db not configured"}
    db = ctx.db()
    try:
        rows = (
            db.query(ProgressRecord)
            .filter(
                ProgressRecord.user_id == ctx.user_id,
                ProgressRecord.project_name == project_name,
            )
            .all()
        )
        total = len(rows)
        passed = sum(1 for r in rows if r.status == "passed")
        return {
            "user_id": ctx.user_id,
            "project_name": project_name,
            "total_nodes": total,
            "passed_nodes": passed,
            "pct": round(passed / total * 100, 1) if total else 0,
            "nodes": [
                {
                    "knode_id": r.knode_id,
                    "status": r.status,
                    "attempts": r.attempts,
                    "best_score": r.best_score,
                }
                for r in rows
            ],
        }
    finally:
        db.close()


@tutor_tool(
    access="write", confirm=True, scope="user_self",
    description="标记知识节点为已通过(需要学生确认)",
)
async def complete_node(project_name: str, knode_id: str) -> dict[str, Any]:
    ctx = require_tool_context()
    if ctx.db is None:
        return {"error": "db not configured"}
    from datetime import datetime

    db = ctx.db()
    try:
        knode_int = int(knode_id)
        row = (
            db.query(ProgressRecord)
            .filter(
                ProgressRecord.user_id == ctx.user_id,
                ProgressRecord.project_name == project_name,
                ProgressRecord.knode_id == knode_int,
            )
            .one_or_none()
        )
        if row is None:
            row = ProgressRecord(
                user_id=ctx.user_id,
                project_name=project_name,
                knode_id=knode_int,
                status="passed",
                attempts=1,
                best_score=1.0,
                passed_at=datetime.utcnow(),
            )
            db.add(row)
        else:
            row.status = "passed"
            row.attempts = (row.attempts or 0) + 1
            row.best_score = 1.0
            row.passed_at = datetime.utcnow()
        db.commit()
        return {"ok": True, "knode_id": knode_id, "status": "passed"}
    finally:
        db.close()


@tutor_tool(access="read", scope="project", description="查询知识节点的前置依赖及其状态")
async def get_knode_prerequisites(project_name: str, knode_id: str) -> dict[str, Any]:
    ctx = require_tool_context()
    if ctx.db is None:
        return {"error": "db not configured"}
    db = ctx.db()
    try:
        cache = (
            db.query(ProgressRecord)
            .filter(
                ProgressRecord.user_id == ctx.user_id,
                ProgressRecord.project_name == project_name,
            )
            .all()
        )
        status_map = {r.knode_id: r.status for r in cache}

        # Read the knowledge tree to find prerequisites.
        # For now return the progress status keyed by knode_id — the
        # skill prompt uses this to decide whether scaffolding is needed.
        knode_int = int(knode_id)
        return {
            "knode_id": knode_id,
            "project_name": project_name,
            "current_status": status_map.get(knode_int, "locked"),
            "all_progress": {
                str(kid): st for kid, st in status_map.items()
            },
        }
    finally:
        db.close()


@tutor_tool(access="read", scope="project", description="读取知识节点的课程内容")
async def get_knode_content(project_name: str, knode_id: str) -> dict[str, Any]:
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
            return {"found": False, "knode_id": knode_id}

        content: dict[str, Any] = {"found": True, "knode_id": knode_id}
        if row.course_content:
            try:
                cc = json.loads(row.course_content)
                content["plan_markdown"] = cc.get("plan_markdown", "")
                content["theories"] = cc.get("theories", [])
            except (json.JSONDecodeError, TypeError):
                content["concept"] = row.concept or ""
        else:
            content["concept"] = row.concept or ""
            content["examples"] = row.examples or ""
            content["key_takeaways"] = row.key_takeaways or ""
        return content
    finally:
        db.close()


__all__ = [
    "get_progress",
    "complete_node",
    "get_knode_prerequisites",
    "get_knode_content",
]
