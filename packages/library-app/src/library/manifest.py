"""Manifest.json 解析 + 校验 (spec 023 §package layout).

manifest.json 是 content package 的索引: 元数据 + frontmatter +
knode 列表 + 文件清单 + sha256 + 总大小。
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class FrontMatter(BaseModel):
    """蓝图 yaml frontmatter."""
    age_band: str | None = None
    domain: str | None = None
    duration_weeks: int | None = None
    weekly_hours: int | None = None
    budget_usd: int | None = None
    difficulty: int | None = None

    model_config = ConfigDict(extra="ignore")


class FileEntry(BaseModel):
    """manifest.files 中的一项."""
    path: str
    sha256: str
    size: int


class KnodeEntry(BaseModel):
    """manifest.knodes 中的一项."""
    module_id: str                    # "M01"
    title: str = ""
    week: int | None = None
    stage: str | None = None
    duration_minutes: int | None = None
    knode_dir: str = ""               # "knodes/M01-w1-xxx"


class LitNodeEntry(BaseModel):
    """spec 035: 项目级知识点亮 — 本项目教过的平台知识树节点."""
    node_id: str                      # platform_tree node id, 例 "math.algebra.piecewise_func"
    lit_by: list[str] = Field(default_factory=list)  # 哪些 knode (M01/M05/...) 教了
    reason: str = ""                  # agent 给的命中理由 (含原文引用)

    model_config = ConfigDict(extra="ignore")


class MissingConceptEntry(BaseModel):
    """spec 035: 本项目涉及但平台树没有的概念 (作者下版迭代用)."""
    concept: str
    first_seen: str = ""              # module_id
    suggested_subject: str | None = None
    note: str = ""

    model_config = ConfigDict(extra="ignore")


class StoryFrame(BaseModel):
    """spec 040: 项目开篇连环画的一帧 (图 + 双语文案叠加).

    图为纯插画 (无字), 文案前端 HTML 渲染 (可双语、改文案不重生图)。
    image 是相对项目包根的路径 (例 "story/story-1.png")。
    """
    image: str                        # "story/story-1.png"
    title_zh: str = ""
    title_en: str = ""
    caption_zh: str = ""
    caption_en: str = ""

    model_config = ConfigDict(extra="ignore")


class Manifest(BaseModel):
    """完整 manifest.json schema."""
    schema_version: str = "1.0"
    slug: str
    title: str
    title_zh: str | None = None
    description: str = ""
    version: str = "1.0.0"
    version_tag: str | None = None
    frontmatter: FrontMatter = Field(default_factory=FrontMatter)
    knode_count: int = 0
    stage_count: int = 0
    languages: list[str] = Field(default_factory=lambda: ["zh-CN"])
    total_size_bytes: int = 0
    files: list[FileEntry] = Field(default_factory=list)
    knodes: list[KnodeEntry] = Field(default_factory=list)
    cover_image_path: str | None = None
    tags: list[str] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None

    # spec 035: 项目级知识点亮 (向后兼容, 老 manifest 缺这两字段 = 空 list)
    lit_nodes: list[LitNodeEntry] = Field(default_factory=list)
    missing_concepts: list[MissingConceptEntry] = Field(default_factory=list)

    # spec 040: 项目开篇连环画 (向后兼容, 老 manifest 缺 = 空 list)
    story: list[StoryFrame] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


# ---------------------------------------------------------------------------
# IO + sha256
# ---------------------------------------------------------------------------

def sha256_file(path: Path) -> str:
    """计算文件 sha256."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest(path: Path) -> Manifest:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Manifest.model_validate(raw)


def write_manifest(manifest: Manifest, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(manifest.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def verify_files(manifest: Manifest, project_dir: Path) -> list[str]:
    """逐个文件验证 sha256 + size, 返回错误列表."""
    errors: list[str] = []
    for entry in manifest.files:
        f = project_dir / entry.path
        if not f.exists():
            errors.append(f"missing file: {entry.path}")
            continue
        actual_size = f.stat().st_size
        if actual_size != entry.size:
            errors.append(f"size mismatch: {entry.path} expected {entry.size}, got {actual_size}")
            continue
        actual_hash = sha256_file(f)
        if actual_hash != entry.sha256:
            errors.append(f"sha256 mismatch: {entry.path}")
    return errors
