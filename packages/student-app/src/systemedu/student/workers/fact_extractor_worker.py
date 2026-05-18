"""spec 031 P4.2: FactExtractor 独立 worker.

跟 web server 分进程跑, 5min tick 一次, 处理 status='pending' 的 PendingExtraction:
  - claim (mark_extraction_processing) → run extractor → mark done/failed
  - failed 攒到 max_attempts=3 → dead

启动:
  python -m systemedu.student.workers.fact_extractor_worker
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
from typing import Any

from systemedu.student import db as _db
from systemedu.student.chat.fact_extractor import StudentFactExtractor

log = logging.getLogger("fact_extractor_worker")


def _make_llm() -> Any:
    """worker 用 qwen-plus (便宜/快, 非 chat thinking)."""
    from systemedu.core.config import get_config
    from systemedu.core.llm_client import get_llm
    cfg = get_config()
    worker_provider = os.environ.get(
        "FACT_EXTRACTOR_LLM_PROVIDER", cfg.llm.default,
    )
    return get_llm(worker_provider)


def _make_mem0() -> Any | None:
    from systemedu.core.config import get_config
    cfg = get_config()
    if not cfg.memory.enabled:
        return None
    try:
        from systemedu.core.tutor.memory.mem0_adapter import Mem0AsyncAdapter
        return Mem0AsyncAdapter()
    except Exception:
        log.exception("worker: mem0 init failed")
        return None


async def _process_one(extractor: StudentFactExtractor, pending_id: str) -> None:
    try:
        _db.mark_extraction_processing(pending_id)
        stats = await extractor.extract_session(pending_id)
        _db.mark_extraction_done(pending_id)
        log.info(
            "extractor: pending=%s done msgs=%d facts=%d/%d mem0=%s",
            pending_id, stats.messages_read,
            stats.facts_written, stats.facts_extracted, stats.mem0_added,
        )
    except Exception as e:
        log.exception("extractor: pending=%s failed", pending_id)
        _db.mark_extraction_failed(pending_id, str(e))


async def tick(extractor: StudentFactExtractor, batch: int = 5) -> int:
    """跑一轮: 拿前 batch 个 pending → process. 返实际处理数."""
    pending = _db.list_pending_extractions(limit=batch)
    for p in pending:
        await _process_one(extractor, p["id"])
    return len(pending)


async def run_forever(interval_sec: int = 300, batch: int = 5) -> None:
    """主循环 (默认 5min tick)."""
    _db.init_db()  # 确保表存在 (worker 先于 web server 启时)
    llm = _make_llm()
    mem0 = _make_mem0()
    extractor = StudentFactExtractor(llm=llm, mem0_client=mem0)
    log.info(
        "fact_extractor_worker started: interval=%ds batch=%d mem0=%s",
        interval_sec, batch, mem0 is not None,
    )

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass  # windows

    inactive_min = int(os.environ.get("FACT_EXTRACTOR_INACTIVE_MIN", "30"))

    while not stop.is_set():
        try:
            # 1) 扫 inactive session 入队 (spec 031 P4.3)
            ne = _db.enqueue_inactive_sessions(inactive_minutes=inactive_min, limit=50)
            if ne:
                log.info("auto-enqueued %d inactive sessions (>%dmin)", ne, inactive_min)
            # 2) 处理 pending
            n = await tick(extractor, batch=batch)
            if n:
                log.info("tick processed %d pending rows", n)
        except Exception:
            log.exception("tick failed (continuing)")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval_sec)
        except asyncio.TimeoutError:
            continue
    log.info("worker exiting")


def main() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    interval = int(os.environ.get("FACT_EXTRACTOR_INTERVAL_SEC", "300"))
    batch = int(os.environ.get("FACT_EXTRACTOR_BATCH", "5"))
    try:
        asyncio.run(run_forever(interval, batch))
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
