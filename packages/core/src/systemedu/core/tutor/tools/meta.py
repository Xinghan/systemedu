"""Meta tools (spec 014 T4.3i)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from systemedu.core.storage.db import Escalation
from systemedu.core.tutor.tools.decorator import require_tool_context, tutor_tool


@tutor_tool(access="write", scope="user_self", description="标记需要人工介入(通知家长/热线)")
async def escalate_to_human(
    reason: str,
    severity: str = "warn",
) -> dict[str, Any]:
    ctx = require_tool_context()
    if ctx.db is None:
        return {"escalated": False, "note": "db not configured"}
    db = ctx.db()
    try:
        row = Escalation(
            user_id=ctx.user_id,
            session_id=ctx.session_id,
            reason=reason,
            severity=severity,
            status="open",
            created_at=datetime.utcnow(),
        )
        db.add(row)
        db.commit()
        return {
            "escalated": True,
            "escalation_id": row.id,
            "severity": severity,
        }
    finally:
        db.close()


__all__ = ["escalate_to_human"]
