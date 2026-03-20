"""Scan project nodes and auto-enqueue + trigger ObjectFactory creation.

Uses ObjectNeedAnalyzer (LLM-based Planner) to determine what 3D objects
a knowledge node requires, enqueues missing ones into FactoryQueue, and
fires off ObjectFactory pipeline as background asyncio tasks.

Two entry points:
  scan_and_enqueue_project_nodes(): called on project creation, scans first-layer nodes
  scan_and_enqueue_unlocked_nodes(): called when nodes are unlocked after passing
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# ObjectFactory pipeline runner
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
# Core: analyze a batch of nodes, enqueue and trigger
# ---------------------------------------------------------------------------

async def _analyze_and_enqueue_nodes(
    nodes: list,
    project_name: str,
) -> list[str]:
    """Use ObjectNeedAnalyzer to determine required objects for each node.

    Enqueues missing objects into FactoryQueue and triggers factory pipeline.
    Returns list of newly enqueued object_keys.
    Deduplicates by family: once a family is handled, skip further nodes for same family.
    """
    from systemedu.agents.builtin.gameagent.object_factory import (
        FactoryQueue,
        FactoryQueueItem,
        ObjectNeedAnalyzer,
    )
    from systemedu.core.llm_client import get_llm

    llm = get_llm()
    analyzer = ObjectNeedAnalyzer(llm=llm)
    queue = FactoryQueue()

    enqueued: list[str] = []
    to_trigger: list[tuple[str, str]] = []
    handled_families: set[str] = set()

    for node in nodes:
        # Skip if family already handled in this batch (avoid duplicate LLM calls)
        # We'll still analyze if no family detected yet
        needed_keys = await analyzer.analyze(node.title, node.summary)

        for key in needed_keys:
            family = key.split(".")[0]
            if family in handled_families:
                continue
            handled_families.add(family)

            # Build meaningful description from the key itself
            variant = key.split(".", 1)[1] if "." in key else key
            description = (
                f"{family} / {variant} — 来自项目: {project_name}, "
                f"节点: {node.title}"
            )

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
                    f"object_scan: enqueued {key!r} for node {node.title!r} "
                    f"in project {project_name!r}"
                )

    trigger_factory_for_keys(to_trigger)
    return enqueued


# ---------------------------------------------------------------------------
# Scan entry points (sync wrappers that schedule async work)
# ---------------------------------------------------------------------------

def scan_and_enqueue_project_nodes(project_name: str) -> list[str]:
    """Called on project creation. Analyze first-layer nodes and enqueue missing objects.

    Schedules an async task to do the analysis (LLM call) — returns [] immediately
    since the actual analysis is async. The factory pipeline runs in background.
    """
    from systemedu.education.project_loader import load_project_context

    try:
        ctx = load_project_context(project_name)
    except Exception as exc:
        logger.warning(f"object_scan: failed to load project {project_name!r}: {exc}")
        return []

    if not ctx.tree.milestones:
        return []

    first_layer_nodes = [
        node
        for node in ctx.tree.milestones[0].knodes
        if not node.prerequisite_indices
    ]

    if not first_layer_nodes:
        return []

    _schedule_analysis(first_layer_nodes, project_name)
    return []  # async — actual keys logged when tasks complete


def scan_and_enqueue_unlocked_nodes(
    project_name: str,
    unlocked_node_ids: list[int],
) -> list[str]:
    """Called when nodes are unlocked. Analyze unlocked nodes for missing objects.

    Schedules async analysis — returns [] immediately.
    """
    if not unlocked_node_ids:
        return []

    from systemedu.education.project_loader import load_project_context

    try:
        ctx = load_project_context(project_name)
    except Exception as exc:
        logger.warning(
            f"object_scan: failed to load project {project_name!r} for unlock scan: {exc}"
        )
        return []

    all_nodes = []
    for ms in ctx.tree.milestones:
        all_nodes.extend(ms.knodes)

    unlocked_nodes = [
        all_nodes[nid]
        for nid in unlocked_node_ids
        if nid < len(all_nodes)
    ]

    if not unlocked_nodes:
        return []

    _schedule_analysis(unlocked_nodes, project_name)
    return []


def _schedule_analysis(nodes: list, project_name: str) -> None:
    """Schedule _analyze_and_enqueue_nodes as an asyncio task if loop is running."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.warning(
            f"object_scan: no running event loop for project {project_name!r}, "
            "cannot schedule analysis"
        )
        return

    async def _run():
        try:
            keys = await _analyze_and_enqueue_nodes(nodes, project_name)
            if keys:
                logger.info(f"object_scan: analysis complete, enqueued: {keys}")
        except Exception:
            logger.exception(f"object_scan: analysis task failed for {project_name!r}")

    loop.create_task(_run(), name=f"object_scan:{project_name}")
    logger.info(
        f"object_scan: scheduled analysis for {len(nodes)} nodes "
        f"in project {project_name!r}"
    )
