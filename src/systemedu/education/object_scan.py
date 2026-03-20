"""Scan project nodes and auto-enqueue + trigger ObjectFactory creation.

Uses deterministic keyword matching (no LLM) to infer object_key from
node title + summary, then enqueues into FactoryQueue and fires off
ObjectFactory pipeline as a background asyncio task.

Two entry points:
- scan_and_enqueue_project_nodes(): called on project creation, scans first-layer nodes
- scan_and_enqueue_unlocked_nodes(): called when nodes are unlocked after a node is passed
"""

from __future__ import annotations

import asyncio
import logging
import re

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Keyword -> family mapping (deterministic, no LLM)
# ---------------------------------------------------------------------------

_TOPIC_FAMILY_MAP: dict[str, str] = {
    "火箭": "rocket",
    "导弹": "rocket",
    "飞船": "rocket",
    "航天": "rocket",
    "飞机": "rocket",
    "太空": "rocket",
    "宇宙飞船": "rocket",
    "细胞": "cell",
    "细菌": "cell",
    "微生物": "cell",
    "病毒": "cell",
    "原子": "atom",
    "分子": "atom",
    "电子": "atom",
    "质子": "atom",
    "中子": "atom",
    "植物": "plant",
    "光合": "plant",
    "叶绿": "plant",
    "树木": "plant",
    "花朵": "plant",
    "人体": "human_body",
    "器官": "human_body",
    "骨骼": "human_body",
    "肌肉": "human_body",
    "心脏": "human_body",
    "大脑": "human_body",
    "地球": "earth",
    "地壳": "earth",
    "大气": "earth",
    "板块": "earth",
    "火山": "earth",
    "地震": "earth",
    "潜水艇": "submarine",
    "潜艇": "submarine",
    "机器人": "robot",
    "机械臂": "robot",
    "汽车": "car",
    "赛车": "car",
    "轮船": "ship",
    "舰艇": "ship",
    "飞碟": "ufo",
    "外星": "ufo",
}


def _make_variant_slug(title: str) -> str:
    """Create a simple slug from a node title for use as object_key variant."""
    cleaned = re.sub(r"[^\w\u4e00-\u9fff]", "_", title.strip())
    cleaned = cleaned[:32].strip("_")
    return cleaned or "basic"


def infer_object_key(title: str, summary: str) -> str | None:
    """Return inferred object_key or None if no match / already in Registry.

    Scans title + summary for topic keywords. Returns a candidate key like
    'rocket.火箭基础' only if that key is NOT already in ObjectRegistry.
    """
    from systemedu.agents.builtin.gameagent.objects import ObjectRegistry

    text = title + " " + summary
    for keyword, family in _TOPIC_FAMILY_MAP.items():
        if keyword in text:
            variant = _make_variant_slug(title)
            key = f"{family}.{variant}"
            if key not in ObjectRegistry.supported_keys():
                return key
    return None


# ---------------------------------------------------------------------------
# ObjectFactory trigger
# ---------------------------------------------------------------------------

async def _run_factory_pipeline(object_key: str, description: str) -> None:
    """Run ObjectFactory pipeline for a single key. Fire-and-forget background task."""
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue, ObjectFactory
    from systemedu.core.llm_client import get_llm

    queue = FactoryQueue()
    queue.mark_in_progress(object_key)
    logger.info(f"object_scan: starting factory pipeline for {object_key!r}")
    try:
        llm = get_llm()
        factory = ObjectFactory(llm=llm)
        _staging_path, report = await factory.run_pipeline(
            object_key=object_key,
            description=description,
            base_family=object_key.split(".")[0],
        )
        if report.passed:
            queue.mark_done(object_key)
            logger.info(f"object_scan: factory done for {object_key!r} score={report.score}")
        else:
            queue.mark_failed(object_key, error="; ".join(report.errors[:3]))
            logger.warning(
                f"object_scan: factory failed for {object_key!r}: {report.errors[:3]}"
            )
    except Exception as exc:
        queue.mark_failed(object_key, error=str(exc))
        logger.exception(f"object_scan: factory pipeline error for {object_key!r}")


def trigger_factory_for_keys(enqueued_items: list[tuple[str, str]]) -> None:
    """Schedule ObjectFactory pipeline tasks for a list of (object_key, description) pairs.

    Uses asyncio.create_task() if a loop is running, otherwise logs a warning.
    This is non-blocking — callers do not await this.
    """
    if not enqueued_items:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.warning("object_scan: no running event loop, skipping factory trigger")
        return

    for object_key, description in enqueued_items:
        task = loop.create_task(
            _run_factory_pipeline(object_key, description),
            name=f"factory:{object_key}",
        )
        task.add_done_callback(
            lambda t: logger.debug(f"factory task finished: {t.get_name()}")
        )
        logger.info(f"object_scan: scheduled factory task for {object_key!r}")


# ---------------------------------------------------------------------------
# Scan entry points
# ---------------------------------------------------------------------------

def scan_and_enqueue_project_nodes(project_name: str) -> list[str]:
    """Called on project creation. Scan first-layer nodes, enqueue and trigger.

    First-layer nodes: in first milestone, no prerequisite_indices.
    Returns list of newly enqueued object_keys.
    """
    from systemedu.agents.builtin.gameagent.object_factory import (
        FactoryQueue,
        FactoryQueueItem,
    )
    from systemedu.education.project_loader import load_project_context

    try:
        ctx = load_project_context(project_name)
    except Exception as exc:
        logger.warning(f"object_scan: failed to load project {project_name!r}: {exc}")
        return []

    if not ctx.tree.milestones:
        return []

    first_ms = ctx.tree.milestones[0]
    queue = FactoryQueue()
    enqueued: list[str] = []
    to_trigger: list[tuple[str, str]] = []

    for node in first_ms.knodes:
        if node.prerequisite_indices:
            continue  # skip non-first-layer nodes

        key = infer_object_key(node.title, node.summary)
        if key is None:
            continue

        description = f"{node.title}: {node.summary[:100]}"
        item = FactoryQueueItem(
            object_key=key,
            description=description,
            source="auto_project",
            project_name=project_name,
        )
        if queue.enqueue(item):
            enqueued.append(key)
            to_trigger.append((key, description))
            logger.info(f"object_scan: enqueued {key!r} for project {project_name!r}")

    trigger_factory_for_keys(to_trigger)
    return enqueued


def scan_and_enqueue_unlocked_nodes(
    project_name: str,
    unlocked_node_ids: list[int],
) -> list[str]:
    """Called when nodes are unlocked after a node is passed.

    Scans the newly unlocked nodes, enqueues missing objects, triggers factory.
    Returns list of newly enqueued object_keys.
    """
    if not unlocked_node_ids:
        return []

    from systemedu.agents.builtin.gameagent.object_factory import (
        FactoryQueue,
        FactoryQueueItem,
    )
    from systemedu.education.project_loader import load_project_context

    try:
        ctx = load_project_context(project_name)
    except Exception as exc:
        logger.warning(
            f"object_scan: failed to load project {project_name!r} for unlock scan: {exc}"
        )
        return []

    # Build flat node list
    all_nodes = []
    for ms in ctx.tree.milestones:
        all_nodes.extend(ms.knodes)

    queue = FactoryQueue()
    enqueued: list[str] = []
    to_trigger: list[tuple[str, str]] = []

    for node_id in unlocked_node_ids:
        if node_id >= len(all_nodes):
            continue
        node = all_nodes[node_id]
        key = infer_object_key(node.title, node.summary)
        if key is None:
            continue

        description = f"{node.title}: {node.summary[:100]}"
        item = FactoryQueueItem(
            object_key=key,
            description=description,
            source="auto_project",
            project_name=project_name,
        )
        if queue.enqueue(item):
            enqueued.append(key)
            to_trigger.append((key, description))
            logger.info(
                f"object_scan: enqueued {key!r} for unlocked node {node_id} "
                f"in project {project_name!r}"
            )

    trigger_factory_for_keys(to_trigger)
    return enqueued
