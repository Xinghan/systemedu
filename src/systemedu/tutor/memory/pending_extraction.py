"""PendingFactExtraction DAO (spec 014 T2.4).

Queue of sessions whose messages haven't been fact-extracted yet.
`session_id` is unique — the same session enqueued twice dedupes.

Concurrent safety: `claim_pending` atomically transitions rows from
`pending` -> `processing` so multiple worker tasks don't pick up the
same row. Uses a subquery + bulk UPDATE pattern that works on both
SQLite and Postgres (no `SELECT ... FOR UPDATE SKIP LOCKED` required
for the SQLite phase).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_
from sqlalchemy.orm import Session

from systemedu.storage.db import PendingFactExtraction


class PendingFactExtractionDAO:
    """Database access for PendingFactExtraction queue."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Enqueue
    # ------------------------------------------------------------------
    def enqueue(
        self,
        *,
        session_id: str,
        user_id: str,
        last_message_at: datetime,
        first_unextracted_msg_id: int | None = None,
    ) -> PendingFactExtraction:
        """Idempotent enqueue.

        If a row for `session_id` already exists, update
        `last_message_at` and `first_unextracted_msg_id` so the next
        extraction covers newly-arrived messages; do not touch
        `status` / `retry_count` / `enqueued_at`.

        Returns the existing or newly-created row.
        """
        existing = (
            self.db.query(PendingFactExtraction)
            .filter(PendingFactExtraction.session_id == session_id)
            .one_or_none()
        )
        if existing is not None:
            existing.last_message_at = last_message_at
            if first_unextracted_msg_id is not None:
                existing.first_unextracted_msg_id = first_unextracted_msg_id
            return existing

        row = PendingFactExtraction(
            session_id=session_id,
            user_id=user_id,
            first_unextracted_msg_id=first_unextracted_msg_id,
            last_message_at=last_message_at,
        )
        self.db.add(row)
        self.db.flush()
        return row

    # ------------------------------------------------------------------
    # Claim + lifecycle
    # ------------------------------------------------------------------
    def claim_pending(
        self,
        *,
        limit: int = 5,
        max_retries: int = 3,
    ) -> list[PendingFactExtraction]:
        """Atomically mark up to `limit` pending rows as `processing`.

        Rows with retry_count >= max_retries are skipped (they've either
        been marked `failed` or will be on the next retry). Oldest
        `enqueued_at` first.
        """
        candidate_ids = [
            row.id
            for row in self.db.query(PendingFactExtraction.id)
            .filter(
                PendingFactExtraction.status == "pending",
                PendingFactExtraction.retry_count < max_retries,
            )
            .order_by(PendingFactExtraction.enqueued_at.asc())
            .limit(limit)
            .all()
        ]
        if not candidate_ids:
            return []

        now = datetime.utcnow()
        self.db.query(PendingFactExtraction).filter(
            PendingFactExtraction.id.in_(candidate_ids),
            PendingFactExtraction.status == "pending",
        ).update(
            {"status": "processing", "started_at": now},
            synchronize_session=False,
        )
        self.db.flush()

        return (
            self.db.query(PendingFactExtraction)
            .filter(PendingFactExtraction.id.in_(candidate_ids))
            .all()
        )

    def mark_done(self, pending_id: int) -> None:
        self.db.query(PendingFactExtraction).filter(
            PendingFactExtraction.id == pending_id
        ).update(
            {"status": "done", "completed_at": datetime.utcnow()},
            synchronize_session=False,
        )

    def mark_failed(
        self,
        pending_id: int,
        *,
        error_msg: str,
        max_retries: int = 3,
    ) -> None:
        """Increment retry_count; once it hits max_retries mark as failed.

        Otherwise revert status to `pending` so the next tick picks it
        up again.
        """
        row = (
            self.db.query(PendingFactExtraction)
            .filter(PendingFactExtraction.id == pending_id)
            .one_or_none()
        )
        if row is None:
            return
        row.retry_count = (row.retry_count or 0) + 1
        row.error_msg = error_msg
        if row.retry_count >= max_retries:
            row.status = "failed"
            row.completed_at = datetime.utcnow()
        else:
            row.status = "pending"
            row.started_at = None

    # ------------------------------------------------------------------
    # Zombie recovery
    # ------------------------------------------------------------------
    def reap_zombies(self, *, older_than: timedelta = timedelta(minutes=10)) -> int:
        """Revert `processing` rows stuck past `older_than` back to `pending`.

        Returns the number of rows reset. Called on worker startup.
        """
        cutoff = datetime.utcnow() - older_than
        result = (
            self.db.query(PendingFactExtraction)
            .filter(
                PendingFactExtraction.status == "processing",
                PendingFactExtraction.started_at < cutoff,
            )
            .update(
                {"status": "pending", "started_at": None},
                synchronize_session=False,
            )
        )
        return result

    def count_by_status(self) -> dict[str, int]:
        """Diagnostic: {pending: N, processing: M, done: K, failed: F}."""
        from sqlalchemy import func

        rows = (
            self.db.query(
                PendingFactExtraction.status,
                func.count(PendingFactExtraction.id),
            )
            .group_by(PendingFactExtraction.status)
            .all()
        )
        return {status: count for status, count in rows}


__all__ = ["PendingFactExtractionDAO"]
