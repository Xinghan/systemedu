"""Escalation DAO (spec 014 T4.7).

Provides `open_escalation()` to flag a session for admin review and
`list_open()` to query unresolved escalations.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from systemedu.storage.db import Escalation


class EscalationDAO:
    """Database access for Escalation rows."""

    def __init__(self, db: Session):
        self.db = db

    def open_escalation(
        self,
        *,
        user_id: str,
        session_id: str | None = None,
        reason: str,
        severity: str = "warn",
    ) -> Escalation:
        row = Escalation(
            user_id=user_id,
            session_id=session_id,
            reason=reason,
            severity=severity,
            status="open",
            created_at=datetime.utcnow(),
        )
        self.db.add(row)
        self.db.commit()
        return row

    def list_open(self, *, user_id: str | None = None) -> list[Escalation]:
        q = self.db.query(Escalation).filter(Escalation.status == "open")
        if user_id is not None:
            q = q.filter(Escalation.user_id == user_id)
        return q.order_by(Escalation.created_at.desc()).all()

    def handle(
        self,
        escalation_id: int,
        *,
        handled_by: str,
    ) -> Escalation | None:
        row = self.db.get(Escalation, escalation_id)
        if row is None:
            return None
        row.status = "handled"
        row.handled_by = handled_by
        row.handled_at = datetime.utcnow()
        self.db.commit()
        return row


__all__ = ["EscalationDAO"]
