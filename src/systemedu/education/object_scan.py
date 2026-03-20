"""Scan first-layer project nodes and auto-enqueue missing objects.

Uses deterministic keyword matching (no LLM) to infer object_key from
node title + summary, then enqueues into FactoryQueue if not in ObjectRegistry.
"""

from __future__ import annotations

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
    # Remove non-alphanumeric (keep CJK, ASCII alnum)
    cleaned = re.sub(r"[^\w\u4e00-\u9fff]", "_", title.strip())
    # Truncate to keep it sane
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


def scan_and_enqueue_project_nodes(project_name: str) -> list[str]:
    """Load project, scan first-layer nodes, enqueue missing objects.

    First-layer nodes are those with no prerequisite_indices (unlocked at start).
    Only the first milestone is scanned.

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

    for node in first_ms.knodes:
        if node.prerequisite_indices:
            continue  # skip non-first-layer nodes

        key = infer_object_key(node.title, node.summary)
        if key is None:
            continue

        item = FactoryQueueItem(
            object_key=key,
            description=f"{node.title}: {node.summary[:100]}",
            source="auto_project",
            project_name=project_name,
        )
        if queue.enqueue(item):
            enqueued.append(key)
            logger.info(f"object_scan: enqueued {key!r} for project {project_name!r}")

    return enqueued
