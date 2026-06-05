"""Memory tools (spec 014 T4.3e-f)."""

from __future__ import annotations

from typing import Any

from systemedu.core.storage.db import StudentFact
from systemedu.core.tutor.tools.decorator import require_tool_context, tutor_tool


@tutor_tool(access="read", scope="user_self", description="查询学生结构化事实记录")
async def search_student_facts(
    category: str = "",
    knode_id: str = "",
) -> dict[str, Any]:
    ctx = require_tool_context()
    if ctx.db is None:
        return {"error": "db not configured"}
    db = ctx.db()
    try:
        q = db.query(StudentFact).filter(
            StudentFact.user_id == ctx.user_id,
            StudentFact.valid_to.is_(None),
        )
        if category:
            q = q.filter(StudentFact.category == category)
        if knode_id:
            q = q.filter(StudentFact.knode_id == knode_id)
        rows = q.order_by(StudentFact.valid_from.desc()).limit(20).all()
        return {
            "user_id": ctx.user_id,
            "count": len(rows),
            "facts": [
                {
                    "id": r.id,
                    "category": r.category,
                    "knode_id": r.knode_id,
                    "content": r.content,
                    "confidence": r.confidence,
                    "valid_from": str(r.valid_from) if r.valid_from else None,
                }
                for r in rows
            ],
        }
    finally:
        db.close()


@tutor_tool(access="read", scope="user_self", description="Mem0 语义搜索学生记忆")
async def search_memory(query: str) -> dict[str, Any]:
    ctx = require_tool_context()
    # Mem0 is optional — if not wired, return empty results gracefully.
    try:
        from systemedu.core.config import get_config
        from systemedu.core.tutor.memory.mem0_adapter import Mem0AsyncAdapter

        # 适配器本身无 .enabled, 禁用状态由 config.memory.enabled 决定
        # (retrieve_memories 内部据此返回空); 提前短路给出明确 note。
        if not get_config().memory.enabled:
            return {"results": [], "note": "mem0 not configured"}
        adapter = Mem0AsyncAdapter()
        results = await adapter.search(query=query, user_id=ctx.user_id, limit=5)
        return {"results": results}
    except ImportError:
        return {"results": [], "note": "mem0 not installed"}
    except Exception as e:  # noqa: BLE001
        return {"results": [], "error": str(e)}


__all__ = ["search_student_facts", "search_memory"]
