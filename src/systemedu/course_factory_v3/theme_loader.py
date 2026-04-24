"""解析 theme_style/themes.js 与 subjects-deep.js,提供 v3 anim/game prompt 用的 theme 注入。

theme_style/themes.js 是 v3 视觉系统的 single source of truth,共 26 个 subject themes。
本模块用正则解析 JS 字面量(不依赖 V8),返回 Python dict。

外部 API:
    load_themes() -> list[Theme]                    # 26 条
    pick_theme(category: str) -> Theme              # 学科 → theme,fallback="space"
    theme_block_for_prompt(theme: Theme) -> str    # 5 色 palette + mascot + props,LLM prompt 注入用
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

# 项目根: src/systemedu/course_factory_v3/theme_loader.py → 上 4 级
ROOT = Path(__file__).resolve().parents[3]
THEMES_JS = ROOT / "theme_style" / "themes.js"
SUBJECTS_JS = ROOT / "theme_style" / "subjects-deep.js"

DEFAULT_THEME_ID = "space"


@dataclass
class Theme:
    id: str
    num: str
    title: str
    chinese: str
    tagline: str
    palette: list[dict]  # [{hex, name}, ...] 5 项
    mascot: str
    props: list[str]
    type_sample: str
    type_desc_title: str
    accent_var: str = ""
    nav_color: str = ""

    def as_prompt_block(self) -> str:
        """把 theme 转成 prompt 注入块(中文+英文)。"""
        palette_lines = "\n".join(
            f"  - {p['name']}: {p['hex']}" for p in self.palette
        )
        props_str = " / ".join(self.props)
        return (
            f"## 视觉主题: {self.title} ({self.chinese}) — id=`{self.id}`\n\n"
            f"主题语境: {self.tagline}\n\n"
            f"**5 色 palette (oklch 色彩空间)**:\n{palette_lines}\n\n"
            f"**Mascot 吉祥物**: {self.mascot}\n\n"
            f"**核心道具图形**: {props_str}\n\n"
            f"**typography 范例**: `{self.type_sample}`  ·  标题: \"{self.type_desc_title}\"\n\n"
            f"**硬性规则**:\n"
            f"- 所有主体颜色必须从上方 5 色 palette 中选,禁止引入任何其它色相\n"
            f"- 背景使用 deep-space-indigo: `oklch(0.14 0.035 265)` → `oklch(0.18 0.04 265)`\n"
            f"- 通用强调色(QUERY/MUTATE/SPARK/QED 等位置)固定为金色 `oklch(0.85 0.14 85)`\n"
            f"- 0px 圆角 / 渐变填充 / ambient glow / backdrop-blur 玻璃态\n"
        )


_THEME_BLOCK_RE = re.compile(
    r"\{\s*"
    r"id:\s*'([a-z_]+)'.*?"
    r"num:\s*'(\d+)'.*?"
    r"accent:\s*'([^']*)'.*?"
    r"nav:\s*'([^']*)'.*?"
    r"title:\s*'([^']+)'.*?"
    r"chinese:\s*'([^']+)'.*?"
    r"tagline:\s*'([^']+)'.*?"
    r"palette:\s*\[(.*?)\].*?"
    r"mascot:\s*'([^']+)'.*?"
    r"props:\s*\[([^\]]+)\].*?"
    r"typeSample:\s*'([^']+)'.*?"
    r"typeDescTitle:\s*'([^']+)'",
    re.DOTALL,
)

_PALETTE_ITEM_RE = re.compile(r"\{\s*hex:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'\s*\}")


def _parse_palette(s: str) -> list[dict]:
    return [{"hex": h, "name": n} for h, n in _PALETTE_ITEM_RE.findall(s)]


def _parse_props(s: str) -> list[str]:
    return re.findall(r"'([^']+)'", s)


@lru_cache(maxsize=1)
def load_themes() -> list[Theme]:
    """解析 themes.js,返回 26 个 Theme。"""
    text = THEMES_JS.read_text(encoding="utf-8")
    themes: list[Theme] = []
    for m in _THEME_BLOCK_RE.finditer(text):
        (
            id_, num, accent, nav, title, chinese, tagline,
            palette_raw, mascot, props_raw, type_sample, type_desc_title,
        ) = m.groups()
        themes.append(Theme(
            id=id_,
            num=num,
            title=title,
            chinese=chinese,
            tagline=tagline,
            palette=_parse_palette(palette_raw),
            mascot=mascot,
            props=_parse_props(props_raw),
            type_sample=type_sample,
            type_desc_title=type_desc_title,
            accent_var=accent,
            nav_color=nav,
        ))
    if not themes:
        raise RuntimeError(f"theme_loader: 0 themes parsed from {THEMES_JS}")
    return themes


@lru_cache(maxsize=1)
def themes_by_id() -> dict[str, Theme]:
    return {t.id: t for t in load_themes()}


# ---------------------------------------------------------------------------
# Subject category → theme id 映射
# ---------------------------------------------------------------------------

# knode/project category 关键词 → theme id。优先匹配,首中即返回。
# 这张表是 v3 的"学科自动选 theme"启发式,可以根据真实 knode 加新条目。
_CATEGORY_KEYWORDS: list[tuple[list[str], str]] = [
    # CS / 编程
    (["cs", "computer", "programming", "coding", "software", "calculator"], "cs"),
    # 生物
    (["biology", "bio", "molecular", "cell", "genetics", "ecology", "evolution"], "bio"),
    # 太空 / 火箭
    (["space", "rocket", "aerospace", "spacecraft", "satellite", "launch", "mars"], "space"),
    # 机械工程
    (["mechanical", "mech", "engineering", "machine", "gear"], "mech"),
    # AI
    (["ai", "artificial intelligence", "machine learning", "neural", "deep learning"], "ai"),
    # 数学
    (["math", "mathematics", "algebra", "geometry", "calculus", "statistics", "topology"], "math"),
    # 医学
    (["medicine", "medical", "med", "physiology", "anatomy", "health"], "med"),
    # 化学
    (["chemistry", "chem", "organic", "inorganic", "analytical", "biochem"], "chem"),
    # 物理
    (["physics", "phys", "mechanics", "thermo", "optics", "electromagnetism", "relativity"], "phys"),
    # 环境
    (["environmental", "env", "climate", "sustainability"], "env"),
    # 机器人
    (["robotics", "robo", "robot"], "robo"),
    # 电子电气
    (["electrical", "elec", "electronics", "circuit"], "elec"),
    # 天文
    (["astronomy", "astro", "stellar", "cosmology", "planetary"], "astro"),
    # 地质
    (["geology", "geo", "geoscience", "rock"], "geo"),
    # 海洋
    (["ocean", "marine", "oceanography"], "ocean"),
    # 气象
    (["meteorology", "meteo", "weather", "atmosphere"], "meteo"),
    # 古生物
    (["paleo", "paleontology", "fossil", "dinosaur"], "paleo"),
    # 量子
    (["quantum", "quant"], "quant"),
    # 核
    (["nuclear", "nuke", "fission", "fusion"], "nuke"),
    # 神经科学
    (["neuroscience", "neuro", "brain"], "neuro"),
    # 材料科学
    (["material", "mat", "materials science", "metallurgy"], "mat"),
    # 微生物
    (["microbiology", "micro", "microbe", "bacteria", "virus"], "micro"),
    # 动物学
    (["zoology", "zoo", "animal"], "zoo"),
    # 植物学
    (["botany", "bot", "plant"], "bot"),
    # 建筑
    (["architecture", "arch", "building", "structural"], "arch"),
    # 农业
    (["agriculture", "agri", "farming", "crop"], "agri"),
]


_WORD_SPLIT_RE = re.compile(r"[^a-z0-9]+")


def _tokens(s: str) -> set[str]:
    """把字符串拆成小写单词集合,用于精确匹配避免子串误命中。"""
    return {t for t in _WORD_SPLIT_RE.split(s.lower()) if t}


def pick_theme(category: str | None, *, fallback: str = DEFAULT_THEME_ID) -> Theme:
    """根据 knode/project category 选一个最匹配的 theme。

    匹配策略: 按单词(非子串)精确匹配,_CATEGORY_KEYWORDS 顺序为优先级。
    例如 "AI Robotics" 拆成 {"ai", "robotics"}, 优先命中 "ai" → ai theme。
    匹配不到时返回 fallback theme(默认 'space')。
    """
    by_id = themes_by_id()
    if not category:
        return by_id.get(fallback) or load_themes()[0]
    cat_lower = category.lower()
    # 1. 直接 id 命中(category 本身就是 theme id)
    if cat_lower in by_id:
        return by_id[cat_lower]
    # 2. 单词级匹配
    tokens = _tokens(category)
    # 多词关键词(如 "machine learning")也支持: 转小写后用子串匹配,但只对长度>=4 的关键词允许子串
    for keywords, theme_id in _CATEGORY_KEYWORDS:
        for kw in keywords:
            kw_lower = kw.lower()
            if " " in kw_lower:
                # 多词短语: 允许子串
                if kw_lower in cat_lower:
                    if theme_id in by_id:
                        return by_id[theme_id]
                    break
            else:
                # 单词: 必须作为完整 token 出现
                if kw_lower in tokens:
                    if theme_id in by_id:
                        return by_id[theme_id]
                    break
    # 3. fallback
    return by_id.get(fallback) or load_themes()[0]


def theme_block_for_prompt(category_or_theme_id: str | None) -> str:
    """v3 prompt 注入入口: 给 step / pipeline 用。"""
    theme = pick_theme(category_or_theme_id)
    return theme.as_prompt_block()
