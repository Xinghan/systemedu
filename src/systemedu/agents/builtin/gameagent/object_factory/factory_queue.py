"""FactoryQueue — active creation queue for ObjectFactory pipeline.

Distinct from MissQueue (runtime miss, passive) — this queue is proactively
populated at project creation time and via manual API calls.

File format: one JSON object per line (JSONL).
Deduplication: same object_key in pending/in_progress state is not re-enqueued.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_DEFAULT_PATH = (
    Path(__file__).parent.parent / "objects" / "staging" / "factory_queue.jsonl"
)


class FactoryQueueItem(BaseModel):
    object_key: str
    description: str = ""
    source: Literal["auto_project", "miss_queue", "manual"] = "manual"
    project_name: str = ""
    status: Literal["pending", "in_progress", "done", "failed"] = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    error: str = ""


class FactoryQueue:
    def __init__(self, queue_path: Path | None = None) -> None:
        self._path = queue_path or _DEFAULT_PATH
        self._path.parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Write side
    # ------------------------------------------------------------------

    def enqueue(self, item: FactoryQueueItem) -> bool:
        """Append item to queue.

        Returns False if an item with same object_key is already
        pending or in_progress (dedup). Returns True if newly added.
        """
        existing = self._load_all()
        for entry in existing:
            if entry.object_key == item.object_key and entry.status in (
                "pending",
                "in_progress",
            ):
                logger.debug(
                    f"FactoryQueue: skip duplicate {item.object_key!r} "
                    f"(already {entry.status})"
                )
                return False

        existing.append(item)
        self._write_all(existing)
        logger.debug(f"FactoryQueue: enqueued {item.object_key!r} from {item.source!r}")
        return True

    def mark_in_progress(self, object_key: str) -> None:
        """Mark the first pending item with this key as in_progress."""
        items = self._load_all()
        for item in items:
            if item.object_key == object_key and item.status == "pending":
                item.status = "in_progress"
                break
        self._write_all(items)

    def mark_done(self, object_key: str) -> None:
        """Mark the first in_progress item with this key as done."""
        items = self._load_all()
        for item in items:
            if item.object_key == object_key and item.status == "in_progress":
                item.status = "done"
                break
        self._write_all(items)

    def mark_failed(self, object_key: str, error: str = "") -> None:
        """Mark the first in_progress item with this key as failed."""
        items = self._load_all()
        for item in items:
            if item.object_key == object_key and item.status == "in_progress":
                item.status = "failed"
                item.error = error
                break
        self._write_all(items)

    # ------------------------------------------------------------------
    # Read side
    # ------------------------------------------------------------------

    def all_items(self) -> list[FactoryQueueItem]:
        return self._load_all()

    def pending_items(self) -> list[FactoryQueueItem]:
        return [i for i in self._load_all() if i.status == "pending"]

    def items_for_project(self, project_name: str) -> list[FactoryQueueItem]:
        return [i for i in self._load_all() if i.project_name == project_name]

    def stats(self) -> dict[str, int]:
        items = self._load_all()
        result: dict[str, int] = {"pending": 0, "in_progress": 0, "done": 0, "failed": 0}
        for item in items:
            result[item.status] = result.get(item.status, 0) + 1
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_all(self) -> list[FactoryQueueItem]:
        if not self._path.exists():
            return []
        items: list[FactoryQueueItem] = []
        for line in self._path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                items.append(FactoryQueueItem.model_validate_json(line))
            except Exception as exc:
                logger.warning(f"FactoryQueue: skipping corrupt line: {exc}")
        return items

    def _write_all(self, items: list[FactoryQueueItem]) -> None:
        lines = [i.model_dump_json() for i in items]
        self._path.write_text(
            "\n".join(lines) + ("\n" if lines else ""),
            encoding="utf-8",
        )
