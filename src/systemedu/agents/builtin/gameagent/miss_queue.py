"""MissQueue — append-only JSONL queue for missing object requests.

B pipeline enqueues MissingObjectRequest entries here.
C pipeline (ObjectFactory) consumes them asynchronously.

File format: one JSON object per line (JSONL).
Deduplication: same object_key increments request_count rather than appending.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from systemedu.agents.builtin.gameagent.object_spec import MissingObjectRequest

logger = logging.getLogger(__name__)

_DEFAULT_QUEUE_PATH = (
    Path(__file__).parent / "objects" / "staging" / "miss_queue.jsonl"
)


class MissQueue:
    def __init__(self, queue_path: Path | None = None) -> None:
        self._path = queue_path or _DEFAULT_QUEUE_PATH
        self._path.parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Write side
    # ------------------------------------------------------------------

    def enqueue(self, request: MissingObjectRequest) -> None:
        """Append request to queue. Increments count if key already present."""
        existing = self._load_all()
        for entry in existing:
            if entry.object_key == request.object_key:
                entry.request_count += 1
                self._write_all(existing)
                logger.debug(
                    f"MissQueue: incremented count for {request.object_key!r} "
                    f"-> {entry.request_count}"
                )
                return

        existing.append(request)
        self._write_all(existing)
        logger.debug(f"MissQueue: enqueued {request.object_key!r}")

    # ------------------------------------------------------------------
    # Read side
    # ------------------------------------------------------------------

    def peek(self) -> list[MissingObjectRequest]:
        """Return all entries sorted by request_count desc (most-wanted first)."""
        entries = self._load_all()
        return sorted(entries, key=lambda r: r.request_count, reverse=True)

    def dequeue_all(self) -> list[MissingObjectRequest]:
        """Return all entries and clear the queue."""
        entries = self._load_all()
        if entries:
            self._write_all([])
        return sorted(entries, key=lambda r: r.request_count, reverse=True)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_all(self) -> list[MissingObjectRequest]:
        if not self._path.exists():
            return []
        entries: list[MissingObjectRequest] = []
        for line in self._path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(MissingObjectRequest.model_validate_json(line))
            except Exception as exc:
                logger.warning(f"MissQueue: skipping corrupt line: {exc}")
        return entries

    def _write_all(self, entries: list[MissingObjectRequest]) -> None:
        lines = [
            e.model_dump_json() for e in entries
        ]
        self._path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
