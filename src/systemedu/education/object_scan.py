"""Scan project nodes and auto-enqueue + trigger ObjectFactory creation.

Uses deterministic keyword matching (no LLM) to decide which standard object
keys a topic needs, then enqueues missing ones into FactoryQueue and fires off
ObjectFactory pipeline as background asyncio tasks.

Design principle:
  object_key = family.variant (e.g. rocket.engine, cell.nucleus)
  The variant is a FIXED standard part name for that family — NOT derived from
  the node title. A topic keyword identifies the family; the family definition
  lists the standard parts that should exist.

Two entry points:
  scan_and_enqueue_project_nodes(): called on project creation, scans first-layer nodes
  scan_and_enqueue_unlocked_nodes(): called when nodes are unlocked after a node is passed
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Topic keyword -> family mapping
# ---------------------------------------------------------------------------

_KEYWORD_TO_FAMILY: dict[str, str] = {
    # Rocket / aerospace
    "火箭": "rocket",
    "导弹": "rocket",
    "飞船": "rocket",
    "航天": "rocket",
    "飞机": "aircraft",
    "太空": "rocket",
    "宇宙飞船": "rocket",
    "推进": "rocket",
    "发射": "rocket",
    # Cell / biology
    "细胞": "cell",
    "细菌": "cell",
    "微生物": "cell",
    "病毒": "cell",
    "生物": "cell",
    # Atom / chemistry / physics
    "原子": "atom",
    "分子": "atom",
    "电子": "atom",
    "质子": "atom",
    "中子": "atom",
    "化学键": "atom",
    # Plant
    "植物": "plant",
    "光合": "plant",
    "叶绿": "plant",
    "树木": "plant",
    "花朵": "plant",
    "种子": "plant",
    # Human body
    "人体": "human_body",
    "器官": "human_body",
    "骨骼": "human_body",
    "肌肉": "human_body",
    "心脏": "human_body",
    "大脑": "human_body",
    "血液": "human_body",
    # Earth / geology
    "地球": "earth",
    "地壳": "earth",
    "大气": "earth",
    "板块": "earth",
    "火山": "earth",
    "地震": "earth",
    # Others
    "潜水艇": "submarine",
    "潜艇": "submarine",
    "机器人": "robot",
    "机械臂": "robot",
    "汽车": "car",
    "赛车": "car",
    "轮船": "ship",
    "舰艇": "ship",
}

# ---------------------------------------------------------------------------
# Family -> standard object variants (fixed canonical parts, not node titles)
# Each variant represents a meaningful educational 3D object for that domain.
# ---------------------------------------------------------------------------

_FAMILY_STANDARD_OBJECTS: dict[str, list[str]] = {
    "rocket": [
        "rocket.basic",        # full rocket side view (already in registry)
        "rocket.engine",       # rocket engine cross-section
        "rocket.nozzle",       # nozzle detail
        "rocket.fuel_tank",    # fuel tank structure
        "rocket.fairing",      # payload fairing
        "rocket.stage",        # multi-stage separation
    ],
    "aircraft": [
        "aircraft.basic",      # airplane side view
        "aircraft.engine",     # jet engine cross-section
        "aircraft.wing",       # wing airfoil cross-section
        "aircraft.fuselage",   # fuselage structure
    ],
    "cell": [
        "cell.animal",         # animal cell (already in registry)
        "cell.plant",          # plant cell with chloroplast
        "cell.bacteria",       # prokaryotic cell
        "cell.nucleus",        # nucleus detail
        "cell.mitochondria",   # mitochondrion
    ],
    "atom": [
        "atom.bohr",           # Bohr model (already in registry)
        "atom.hydrogen",       # hydrogen atom
        "atom.carbon",         # carbon atom
        "atom.molecule_water", # H2O molecule
        "atom.molecule_co2",   # CO2 molecule
    ],
    "plant": [
        "plant.basic",         # whole plant (already in registry)
        "plant.leaf",          # leaf cross-section (photosynthesis)
        "plant.root",          # root structure
        "plant.flower",        # flower anatomy
        "plant.seed",          # seed germination
    ],
    "human_body": [
        "human_body.external", # external body (already in registry)
        "human_body.skeleton", # skeletal system
        "human_body.heart",    # heart cross-section
        "human_body.brain",    # brain lobes
        "human_body.lung",     # lung structure
        "human_body.muscle",   # muscle fiber
    ],
    "earth": [
        "earth.basic",         # earth layers (already in registry)
        "earth.crust",         # tectonic plates
        "earth.atmosphere",    # atmospheric layers
        "earth.volcano",       # volcano cross-section
        "earth.core",          # earth core detail
    ],
    "submarine": [
        "submarine.basic",     # submarine side view
        "submarine.hull",      # pressure hull cross-section
        "submarine.propeller", # propeller detail
    ],
    "robot": [
        "robot.basic",         # humanoid robot
        "robot.arm",           # robotic arm
        "robot.sensor",        # sensor array
    ],
    "car": [
        "car.basic",           # car side view
        "car.engine",          # engine cross-section
        "car.drivetrain",      # drivetrain
    ],
    "ship": [
        "ship.basic",          # ship side view
        "ship.hull",           # hull cross-section
        "ship.propeller",      # propeller
    ],
}


def infer_needed_object_keys(title: str, summary: str) -> list[str]:
    """Return list of standard object_keys needed for a topic.

    Matches topic keywords to a family, then returns that family's standard
    objects that are NOT already in ObjectRegistry.

    Returns [] if no keyword matches or all standard objects already exist.
    """
    from systemedu.agents.builtin.gameagent.objects import ObjectRegistry

    existing = set(ObjectRegistry.supported_keys())
    text = title + " " + summary

    matched_family: str | None = None
    for keyword, family in _KEYWORD_TO_FAMILY.items():
        if keyword in text:
            matched_family = family
            break

    if matched_family is None:
        return []

    standard_keys = _FAMILY_STANDARD_OBJECTS.get(matched_family, [])
    return [k for k in standard_keys if k not in existing]


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
# Internal: enqueue helpers
# ---------------------------------------------------------------------------

def _enqueue_keys_for_nodes(
    nodes: list,
    project_name: str,
) -> tuple[list[str], list[tuple[str, str]]]:
    """For a list of KnowledgeNode objects, infer and enqueue missing objects.

    Returns (enqueued_keys, to_trigger_pairs).
    """
    from systemedu.agents.builtin.gameagent.object_factory import (
        FactoryQueue,
        FactoryQueueItem,
    )

    queue = FactoryQueue()
    enqueued: list[str] = []
    to_trigger: list[tuple[str, str]] = []
    seen_families: set[str] = set()

    for node in nodes:
        text = node.title + " " + node.summary
        matched_family: str | None = None
        for keyword, family in _KEYWORD_TO_FAMILY.items():
            if keyword in text:
                matched_family = family
                break

        if matched_family is None or matched_family in seen_families:
            continue
        seen_families.add(matched_family)

        needed_keys = infer_needed_object_keys(node.title, node.summary)
        for key in needed_keys:
            # Build a meaningful description based on the family variant
            variant = key.split(".", 1)[1] if "." in key else key
            description = f"{matched_family} / {variant} — from project: {project_name}"
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
                    f"object_scan: enqueued {key!r} for project {project_name!r}"
                )

    return enqueued, to_trigger


# ---------------------------------------------------------------------------
# Scan entry points
# ---------------------------------------------------------------------------

def scan_and_enqueue_project_nodes(project_name: str) -> list[str]:
    """Called on project creation. Scan first-layer nodes, enqueue and trigger.

    First-layer nodes: in first milestone, no prerequisite_indices.
    Returns list of newly enqueued object_keys.
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

    enqueued, to_trigger = _enqueue_keys_for_nodes(first_layer_nodes, project_name)
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

    enqueued, to_trigger = _enqueue_keys_for_nodes(unlocked_nodes, project_name)
    trigger_factory_for_keys(to_trigger)
    return enqueued
