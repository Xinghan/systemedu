"""manifest.json 生成 (扫描 generated/<slug>/ 目录, 算 sha256, 填 files 清单).

跟 library-app 的 manifest.py 是镜像关系: library 端做"验证", pipeline 端做"生成"。
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


# 不打进 manifest 的文件 (临时 / 缓存 / 系统)
_SKIP_FILES = {".DS_Store"}
_SKIP_SUFFIXES = {".tmp", ".swp", ".bak", ".pyc"}
_SKIP_DIRS = {"__pycache__", ".git", ".cache"}


def _should_skip(path: Path, project_dir: Path) -> bool:
    if path.name in _SKIP_FILES:
        return True
    if path.suffix in _SKIP_SUFFIXES:
        return True
    # rel 路径任意一段是 _SKIP_DIRS 之一
    rel = path.relative_to(project_dir)
    for part in rel.parts[:-1]:
        if part in _SKIP_DIRS:
            return True
    # manifest 自己不进 files (避免循环 hash)
    if rel == Path("manifest.json"):
        return True
    return False


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def scan_files(project_dir: Path) -> list[dict]:
    """扫描 project_dir 下所有文件, 返回 manifest.files 格式."""
    entries: list[dict] = []
    for p in sorted(project_dir.rglob("*")):
        if not p.is_file():
            continue
        if _should_skip(p, project_dir):
            continue
        rel = p.relative_to(project_dir).as_posix()
        entries.append({
            "path": rel,
            "sha256": _sha256(p),
            "size": p.stat().st_size,
        })
    return entries


def regenerate_manifest(project_dir: Path, version: str | None = None) -> dict:
    """读现有 manifest.json (skeleton), 扫描文件, 重算 files + total_size + 时间戳.

    Returns: 写回去的 manifest dict (也会写到 project_dir/manifest.json)。
    """
    manifest_path = project_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"manifest not found at {manifest_path} (compile first)")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    files = scan_files(project_dir)
    total = sum(f["size"] for f in files)
    now = datetime.now(timezone.utc).isoformat()

    manifest["files"] = files
    manifest["total_size_bytes"] = total
    manifest["updated_at"] = now
    if not manifest.get("created_at"):
        manifest["created_at"] = now
    if version:
        manifest["version"] = version
        manifest["version_tag"] = "release"

    # 封面: manifest 未显式设时, 自动检测项目根下的 cover.{png,jpg,jpeg,webp}
    # (library importer 据此填 Project.cover_image_path; 不设则前端无封面)
    if not manifest.get("cover_image_path"):
        for name in ("cover.png", "cover.jpg", "cover.jpeg", "cover.webp"):
            if (project_dir / name).is_file():
                manifest["cover_image_path"] = name
                break

    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest
