"""FactExtractionWorker asyncio loop (spec 014 T2.5).

Consumes the `pending_fact_extraction` queue in batches. One worker
instance per process. The LLM call inside `FactExtractor` is the slow
step, so we limit concurrency to `batch_size` per tick to avoid
overloading the provider; multiple tasks per tick run sequentially —
Phase 2 deliberately keeps this simple.

Clock + sleep are injectable so tests can run without real waits.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable

from sqlalchemy.orm import Session

from systemedu.storage.db import ChatMessage, ChatSession, PendingFactExtraction
from systemedu.tutor.memory import FactExtractor, PendingFactExtractionDAO

log = logging.getLogger(__name__)

DBSessionFactory = Callable[[], Session]
ExtractorFactory = Callable[[Session], FactExtractor]
Clock = Callable[[], datetime]
Sleeper = Callable[[float], Awaitable[None]]


@dataclass
class WorkerStats:
    ticks: int = 0
    extracted: int = 0
    failed: int = 0
    enqueued_by_fallback: int = 0
    zombies_reaped: int = 0


@dataclass
class FactExtractionWorker:
    """Background loop that drains pending_fact_extraction."""

    db_session_factory: DBSessionFactory
    extractor_factory: ExtractorFactory

    # Tunables
    scan_interval: float = 30.0  # seconds between ticks
    batch_size: int = 5
    max_retries: int = 3
    zombie_after: timedelta = timedelta(minutes=10)
    fallback_after: timedelta = timedelta(hours=2)

    # Injectable for tests
    clock: Clock = field(default=datetime.utcnow)
    sleep: Sleeper = field(default=asyncio.sleep)

    stats: WorkerStats = field(default_factory=WorkerStats)
    _stopping: bool = False
    _task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def start(self) -> None:
        """Reap zombies, then spawn the loop task."""
        if self._task is not None:
            raise RuntimeError("worker already started")
        await self._reap_zombies_on_startup()
        self._stopping = False
        self._task = asyncio.create_task(self._loop(), name="fact-extraction-worker")

    async def stop(self, timeout: float = 5.0) -> None:
        """Graceful stop — let the current tick finish."""
        self._stopping = True
        if self._task is None:
            return
        try:
            await asyncio.wait_for(self._task, timeout=timeout)
        except asyncio.TimeoutError:
            log.warning("worker.stop: tick didn't finish in %ss, cancelling", timeout)
            self._task.cancel()
        self._task = None

    async def _reap_zombies_on_startup(self) -> None:
        with _session(self.db_session_factory) as db:
            dao = PendingFactExtractionDAO(db)
            n = dao.reap_zombies(older_than=self.zombie_after)
            if n:
                db.commit()
                self.stats.zombies_reaped = n
                log.info("worker startup: reaped %d zombie rows", n)
            else:
                db.rollback()

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    async def _loop(self) -> None:
        while not self._stopping:
            try:
                await self.tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("worker tick raised; continuing")
            if self._stopping:
                return
            await self.sleep(self.scan_interval)

    async def tick(self) -> None:
        """One tick: 2h fallback enqueue → claim batch → extract each."""
        self.stats.ticks += 1

        fallback_n = await asyncio.to_thread(self._enqueue_fallback)
        self.stats.enqueued_by_fallback += fallback_n

        claimed = await asyncio.to_thread(self._claim_batch)
        for row_id, pending_copy in claimed:
            await self._process(row_id, pending_copy)

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------
    def _enqueue_fallback(self) -> int:
        """Enqueue sessions with stale messages and no active pending row."""
        cutoff = self.clock() - self.fallback_after
        n = 0
        with _session(self.db_session_factory) as db:
            dao = PendingFactExtractionDAO(db)
            # sessions with last ChatMessage older than cutoff that don't
            # already have a pending/processing row
            stale_sessions = (
                db.query(
                    ChatSession.id,
                    ChatSession.user_id,
                    ChatMessage.id.label("last_msg_id"),
                    ChatMessage.created_at.label("last_msg_at"),
                )
                .join(ChatMessage, ChatSession.id == ChatMessage.session_id)
                .filter(ChatSession.user_id.isnot(None))
                .group_by(ChatSession.id)
                .having(ChatMessage.created_at < cutoff)
                .all()
            )
            for session_id, user_id, last_msg_id, last_msg_at in stale_sessions:
                existing = (
                    db.query(PendingFactExtraction)
                    .filter(
                        PendingFactExtraction.session_id == session_id,
                        PendingFactExtraction.status.in_(
                            ["pending", "processing"]
                        ),
                    )
                    .one_or_none()
                )
                if existing is not None:
                    continue
                dao.enqueue(
                    session_id=session_id,
                    user_id=user_id,
                    last_message_at=last_msg_at,
                )
                n += 1
            if n:
                db.commit()
            else:
                db.rollback()
        return n

    def _claim_batch(self) -> list[tuple[int, dict[str, Any]]]:
        """Claim up to batch_size pending rows.

        Returns [(id, snapshot)] — the snapshot is a plain dict (not an
        ORM row) so we can open a fresh session per row without
        detached-instance issues.
        """
        out: list[tuple[int, dict[str, Any]]] = []
        with _session(self.db_session_factory) as db:
            dao = PendingFactExtractionDAO(db)
            claimed = dao.claim_pending(
                limit=self.batch_size, max_retries=self.max_retries,
            )
            if claimed:
                db.commit()
            else:
                db.rollback()
            for row in claimed:
                out.append((row.id, {
                    "session_id": row.session_id,
                    "user_id": row.user_id,
                    "retry_count": row.retry_count,
                }))
        return out

    async def _process(self, pending_id: int, snapshot: dict[str, Any]) -> None:
        """Run the extractor for one row; commit success or failure."""
        try:
            await self._run_extraction_async(pending_id)
            self.stats.extracted += 1
        except Exception as exc:
            log.warning("extraction failed for pending_id=%s: %s", pending_id, exc)
            self.stats.failed += 1
            await asyncio.to_thread(self._record_failure, pending_id, exc)

    async def _run_extraction_async(self, pending_id: int) -> None:
        """Open a fresh session, run extractor, mark done — all async."""
        db = self.db_session_factory()
        try:
            extractor = self.extractor_factory(db)
            await extractor.extract_session(pending_id)
            dao = PendingFactExtractionDAO(db)
            dao.mark_done(pending_id)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def _record_failure(self, pending_id: int, exc: Exception) -> None:
        with _session(self.db_session_factory) as db:
            dao = PendingFactExtractionDAO(db)
            dao.mark_failed(
                pending_id,
                error_msg=f"{type(exc).__name__}: {exc}"[:500],
                max_retries=self.max_retries,
            )
            db.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
class _session:
    """Session context manager used by the worker for each short op."""

    def __init__(self, factory: DBSessionFactory):
        self.factory = factory
        self.s: Session | None = None

    def __enter__(self) -> Session:
        self.s = self.factory()
        return self.s

    def __exit__(self, *exc) -> None:
        if self.s is not None:
            self.s.close()


__all__ = ["FactExtractionWorker", "WorkerStats"]
