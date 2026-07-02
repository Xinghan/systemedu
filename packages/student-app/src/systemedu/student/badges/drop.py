"""节点完成 → 徽章掉落 (spec 042).

规则 (knode 无 difficulty_level 字段, 改用 knowledge_tree_json 里的 stage 相对位置推导):
  - knode 所在 stage 处于该项目 stage 序列前半段 -> 铜; 后半段 -> 银
  - knode 是所在 stage 内 sequence_order 最大的 (milestone 收尾) -> 额外多掉 1 枚同级
  - 一个 knode 对一个用户一辈子只掉落一次 (去重表 UniqueConstraint 防重复 toggle 刷徽章)
  - domain 映射不到任何分会的项目静默跳过, 不掉落也不报错
"""
from __future__ import annotations

import logging
import math

from sqlalchemy.exc import IntegrityError

from ..db import UserBadge, UserKnodeBadgeDrop, get_session
from ..library_proxy.client import get_library_client
from .chapters import CHAPTER_BY_DOMAIN
from .synthesis import maybe_synthesize

logger = logging.getLogger(__name__)


def _resolve_tier(tree: dict, knode_id: str) -> tuple[str, bool] | None:
    """从 knowledge_tree_json 里定位 knode 所在 stage, 返回 (tier, is_milestone_end)。

    找不到该 knode (数据不一致/老数据) 时返回 None, 调用方视为不掉落。
    """
    stages = tree.get("stages") or []
    modules = tree.get("modules") or []
    if not stages or not modules:
        return None

    stage_order = [s.get("stage_id") for s in stages]
    module = next((m for m in modules if m.get("module_id") == knode_id), None)
    if module is None:
        return None

    stage_id = module.get("stage_id")
    if stage_id not in stage_order:
        return None
    stage_index = stage_order.index(stage_id)
    total_stages = len(stage_order)

    tier = "bronze" if stage_index < math.ceil(total_stages / 2) else "silver"

    siblings = [m for m in modules if m.get("stage_id") == stage_id]
    max_seq = max((m.get("sequence_order") or 0) for m in siblings)
    is_milestone_end = (module.get("sequence_order") or 0) == max_seq

    return tier, is_milestone_end


async def maybe_drop_badges(user_id: str, project_slug: str, knode_id: str) -> list[dict]:
    """节点标记完成时调用。返回本次掉落的徽章列表 (可能为空), 供路由层拼进响应体。

    列表元素: {"chapter": str, "tier": str, "count": int}
    """
    lib = get_library_client()
    try:
        project = await lib.get_project(project_slug)
    except Exception:
        logger.warning("maybe_drop_badges: get_project failed for %s", project_slug, exc_info=True)
        return []

    chapter = CHAPTER_BY_DOMAIN.get(project.domain or "")
    if chapter is None:
        return []

    try:
        tree = await lib.get_tree(project_slug)
    except Exception:
        logger.warning("maybe_drop_badges: get_tree failed for %s", project_slug, exc_info=True)
        return []

    resolved = _resolve_tier(tree, knode_id)
    if resolved is None:
        return []
    tier, is_milestone_end = resolved

    count = 1 + (1 if is_milestone_end else 0)

    with get_session() as db:
        drop_marker = UserKnodeBadgeDrop(
            user_id=user_id, project_slug=project_slug, knode_id=knode_id,
        )
        db.add(drop_marker)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return []  # 已经掉落过, 幂等跳过

        for _ in range(count):
            db.add(UserBadge(
                user_id=user_id, chapter=chapter, tier=tier, source="drop",
                project_slug=project_slug, knode_id=knode_id,
            ))
        db.commit()

        maybe_synthesize(db, user_id, chapter, tier)

    return [{"chapter": chapter, "tier": tier, "count": count}]
