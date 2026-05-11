"""蓝图 sync + frontmatter 解析.

systemeduidea 项目结构:
  ~/Dev/systemeduidea/projects/<slug>/
    ├── README.md       英文蓝图
    └── README.zh.md    中文蓝图

每个 README 顶部都有 YAML frontmatter (title / slug / age_band / domain /
duration_weeks / weekly_hours / budget_usd / difficulty)。

sync 把这两个 README 拷贝到 content-workspace/blueprints/<slug>/ 下保留。
"""

from __future__ import annotations

import hashlib
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .workspace import blueprints_dir


_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


@dataclass
class BlueprintFrontmatter:
    title: str = ""
    slug: str = ""
    age_band: str | None = None
    domain: str | None = None
    duration_weeks: int | None = None
    weekly_hours: int | None = None
    budget_usd: int | None = None
    difficulty: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedBlueprint:
    frontmatter: BlueprintFrontmatter
    body_markdown: str           # frontmatter 之后的整段 markdown
    title_en: str = ""           # 从英文 README 取
    title_zh: str = ""           # 从中文 README 取


@dataclass
class SyncResult:
    slug: str
    status: str                  # "new" | "updated" | "unchanged"
    en_path: Path | None
    zh_path: Path | None


# ---------------------------------------------------------------------------
# parsing
# ---------------------------------------------------------------------------

def parse_frontmatter(markdown_text: str) -> tuple[BlueprintFrontmatter, str]:
    """从 markdown 文本里抽取 YAML frontmatter; 返回 (frontmatter, body)."""
    m = _FRONTMATTER_RE.match(markdown_text)
    if not m:
        return BlueprintFrontmatter(), markdown_text
    raw = yaml.safe_load(m.group(1)) or {}
    if not isinstance(raw, dict):
        return BlueprintFrontmatter(), m.group(2)
    known = {
        "title", "slug", "age_band", "domain",
        "duration_weeks", "weekly_hours", "budget_usd", "difficulty",
    }
    fm = BlueprintFrontmatter(
        title=str(raw.get("title", "") or ""),
        slug=str(raw.get("slug", "") or ""),
        age_band=raw.get("age_band"),
        domain=raw.get("domain"),
        duration_weeks=_coerce_int(raw.get("duration_weeks")),
        weekly_hours=_coerce_int(raw.get("weekly_hours")),
        budget_usd=_coerce_int(raw.get("budget_usd")),
        difficulty=_coerce_int(raw.get("difficulty")),
        extra={k: v for k, v in raw.items() if k not in known},
    )
    return fm, m.group(2)


def _coerce_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def load_blueprint(blueprint_dir: Path) -> ParsedBlueprint:
    """读 blueprint_dir 下的 README.md + README.zh.md, 解析 frontmatter.

    优先用中文 README 的 frontmatter (因为我们面向国内用户), 英文 README 退化为副本。
    """
    en_path = blueprint_dir / "README.md"
    zh_path = blueprint_dir / "README.zh.md"

    fm = BlueprintFrontmatter()
    body = ""
    title_en = ""
    title_zh = ""

    if zh_path.is_file():
        zh_text = zh_path.read_text(encoding="utf-8")
        fm_zh, body_zh = parse_frontmatter(zh_text)
        fm = fm_zh
        body = body_zh
        title_zh = fm_zh.title
    if en_path.is_file():
        en_text = en_path.read_text(encoding="utf-8")
        fm_en, body_en = parse_frontmatter(en_text)
        if not fm.slug and fm_en.slug:
            fm = fm_en
            body = body_en
        title_en = fm_en.title

    return ParsedBlueprint(
        frontmatter=fm,
        body_markdown=body,
        title_en=title_en,
        title_zh=title_zh,
    )


# ---------------------------------------------------------------------------
# sync from systemeduidea
# ---------------------------------------------------------------------------

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _file_changed(src: Path, dst: Path) -> bool:
    if not dst.exists():
        return True
    return _sha256(src) != _sha256(dst)


def sync_blueprints(
    source_dir: Path,
    only_changed: bool = False,
    only_slugs: list[str] | None = None,
) -> list[SyncResult]:
    """从 source_dir/projects/<slug>/README*.md 拷贝到 content-workspace/blueprints/.

    Args:
        source_dir: systemeduidea repo 路径 (含 projects/ 子目录)
        only_changed: True 时跳过 hash 相同的项目 (返回 status='unchanged')
        only_slugs: 只 sync 指定 slug 列表

    Returns:
        每个项目一条 SyncResult.
    """
    source_projects = source_dir / "projects"
    if not source_projects.is_dir():
        raise FileNotFoundError(f"{source_projects} not found")

    dest_root = blueprints_dir()
    dest_root.mkdir(parents=True, exist_ok=True)

    results: list[SyncResult] = []
    for slug_dir in sorted(source_projects.iterdir()):
        if not slug_dir.is_dir():
            continue
        slug = slug_dir.name
        if only_slugs and slug not in only_slugs:
            continue

        en_src = slug_dir / "README.md"
        zh_src = slug_dir / "README.zh.md"
        if not en_src.is_file() and not zh_src.is_file():
            continue

        dest = dest_root / slug
        dest.mkdir(parents=True, exist_ok=True)

        any_new = not (dest / "README.md").exists() and not (dest / "README.zh.md").exists()
        any_changed = False
        en_dest: Path | None = None
        zh_dest: Path | None = None

        if en_src.is_file():
            d = dest / "README.md"
            if _file_changed(en_src, d):
                shutil.copy2(en_src, d)
                any_changed = True
            en_dest = d
        if zh_src.is_file():
            d = dest / "README.zh.md"
            if _file_changed(zh_src, d):
                shutil.copy2(zh_src, d)
                any_changed = True
            zh_dest = d

        if any_new:
            status = "new"
        elif any_changed:
            status = "updated"
        else:
            status = "unchanged"

        if only_changed and status == "unchanged":
            results.append(SyncResult(slug, "unchanged", en_dest, zh_dest))
            continue
        results.append(SyncResult(slug, status, en_dest, zh_dest))

    return results
