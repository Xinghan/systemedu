"""10 枚同色徽章自动合成 1 枚上一级 (spec 042)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..db import UserBadge
from .chapters import SYNTHESIS_THRESHOLD, next_tier


def maybe_synthesize(db: Session, user_id: str, chapter: str, tier: str) -> list[dict]:
    """检查 chapter+tier 未消耗徽章数是否达到合成门槛, 触发则消耗 10 枚产出 1 枚上一级。

    用 while 循环处理连续合成 (比如一次性凑够 20 枚, 或合成产出后又达到下一级门槛)。
    返回本次触发的合成事件列表 [{"chapter", "from_tier", "to_tier"}, ...] (可能为空)。
    """
    events: list[dict] = []
    current_tier = tier
    while True:
        upgrade_to = next_tier(current_tier)
        if upgrade_to is None:
            break  # master 无上一级

        held = (
            db.query(UserBadge)
            .filter_by(user_id=user_id, chapter=chapter, tier=current_tier, consumed=False)
            .order_by(UserBadge.created_at.asc())
            .limit(SYNTHESIS_THRESHOLD)
            .all()
        )
        if len(held) < SYNTHESIS_THRESHOLD:
            break

        for badge in held:
            badge.consumed = True
        db.add(UserBadge(
            user_id=user_id, chapter=chapter, tier=upgrade_to, source="synthesis",
        ))
        db.commit()

        events.append({"chapter": chapter, "from_tier": current_tier, "to_tier": upgrade_to})
        current_tier = upgrade_to

    return events
