"""先驱者协会 — 八大分会常量 (spec 042).

domain 取值来自 library Project.domain 字段 (packages/library-app/src/library/models.py)。
映射不到的 domain 不掉落徽章 (静默跳过, 见 badges/drop.py)。
"""
from __future__ import annotations

CHAPTER_BY_DOMAIN: dict[str, str] = {
    "Biotech": "bio-forge",
    "Aerospace": "skyward",
    "Climate": "verdant",
    "Robotics": "mecha-core",
    "AI": "mind-forge",
    "CS": "codex",
    "Neuroscience": "neural-spire",
    "Paleontology": "deep-time",
}

CHAPTER_DISPLAY_NAME: dict[str, str] = {
    "bio-forge": "生物机所",
    "skyward": "穹际分会",
    "verdant": "绿萌盟",
    "mecha-core": "机械之心",
    "mind-forge": "心智工坊",
    "codex": "算境阁",
    "neural-spire": "神经回廊",
    "deep-time": "深时秘境",
}

# 铜银金大师, 索引即晋级顺序 (下一级 = TIER_ORDER[i+1])
TIER_ORDER: list[str] = ["bronze", "silver", "gold", "master"]

TIER_DISPLAY_NAME: dict[str, str] = {
    "bronze": "铜质",
    "silver": "银质",
    "gold": "金质",
    "master": "大师",
}

SYNTHESIS_THRESHOLD = 10


def next_tier(tier: str) -> str | None:
    """返回晋级的下一级, master 或未知 tier 返回 None。"""
    try:
        idx = TIER_ORDER.index(tier)
    except ValueError:
        return None
    if idx + 1 >= len(TIER_ORDER):
        return None
    return TIER_ORDER[idx + 1]
