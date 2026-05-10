"""ToolCallLog DAO (spec 014 T4.4).

Provides `log_call()` to persist an audit row for every tool invocation,
and a `make_log_sink(session_factory)` that returns a callback compatible
with `ToolContext.log_sink`. The decorator fires the sink automatically,
so individual tools never need to call `log_call` directly.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Callable

from sqlalchemy.orm import Session

from systemedu.core.storage.db import ToolCallLog

log = logging.getLogger(__name__)


class ToolCallLogDAO:
    """Database access for ToolCallLog rows."""

    def __init__(self, db: Session):
        self.db = db

    def log_call(
        self,
        *,
        user_id: str,
        session_id: str | None = None,
        active_skill: str | None = None,
        tool_name: str,
        args: dict[str, Any] | None = None,
        result: Any = None,
        approved: bool | None = None,
        latency_ms: int | None = None,
        error: str | None = None,
    ) -> ToolCallLog:
        row = ToolCallLog(
            user_id=user_id,
            session_id=session_id,
            active_skill=active_skill,
            tool_name=tool_name,
            args_json=args or {},
            result_json=_safe_json(result),
            approved=approved,
            called_at=datetime.utcnow(),
            latency_ms=latency_ms,
            error=error,
        )
        self.db.add(row)
        self.db.commit()
        return row

    def list_by_session(self, session_id: str) -> list[ToolCallLog]:
        return (
            self.db.query(ToolCallLog)
            .filter(ToolCallLog.session_id == session_id)
            .order_by(ToolCallLog.called_at)
            .all()
        )

    def list_by_user(
        self,
        user_id: str,
        *,
        tool_name: str | None = None,
        limit: int = 50,
    ) -> list[ToolCallLog]:
        q = self.db.query(ToolCallLog).filter(ToolCallLog.user_id == user_id)
        if tool_name is not None:
            q = q.filter(ToolCallLog.tool_name == tool_name)
        return q.order_by(ToolCallLog.called_at.desc()).limit(limit).all()


def _safe_json(obj: Any) -> Any:
    """Ensure the value is JSON-serialisable for SQLite JSON columns."""
    if obj is None:
        return None
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


def make_log_sink(session_factory: Callable[[], Session]) -> Callable[[dict[str, Any]], None]:
    """Build a `ToolContext.log_sink` backed by a real DB session.

    Each call opens+closes its own session so the audit write can't
    block or fail the tool's own transaction. Errors are swallowed —
    audit is best-effort.
    """

    def _sink(record: dict[str, Any]) -> None:
        try:
            db = session_factory()
            try:
                dao = ToolCallLogDAO(db)
                dao.log_call(
                    user_id=record.get("user_id", ""),
                    session_id=record.get("session_id"),
                    active_skill=record.get("active_skill"),
                    tool_name=record.get("tool_name", "unknown"),
                    args=record.get("args"),
                    result=record.get("result"),
                    approved=record.get("approved"),
                    latency_ms=record.get("latency_ms"),
                    error=record.get("error"),
                )
            finally:
                db.close()
        except Exception:  # noqa: BLE001
            log.exception("make_log_sink: failed to write audit row")

    return _sink


__all__ = ["ToolCallLogDAO", "make_log_sink"]
