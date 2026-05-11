"""打包 / 导出 tarball.

打包结构 (tarball 顶层 1 个目录 <slug>/, 跟 library-app importer 期望对得上):
  <slug>.tar.gz
    └── <slug>/
        ├── manifest.json
        ├── blueprint/{README.md, README.zh.md}
        ├── tree/knowledge_tree.json
        └── knodes/<id>/{lesson.md, sections.json, ...}
"""

from __future__ import annotations

import hashlib
import tarfile
from dataclasses import dataclass
from pathlib import Path

from .manifest import regenerate_manifest
from .workspace import dist_dir, project_generated_dir


@dataclass
class PackageResult:
    slug: str
    version: str
    tarball_path: Path
    size_bytes: int
    sha256: str


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def package_project(slug: str, version: str | None = None) -> PackageResult:
    """打包 generated/<slug>/ 为 dist/<slug>-<version>.tar.gz.

    步骤:
    1. regenerate_manifest (重新算 files + sha256)
    2. tar.gz 整个 generated/<slug>/ → dist/<slug>-<version>.tar.gz (顶层是 <slug>/)
    3. 算 tarball sha256
    """
    project_dir = project_generated_dir(slug)
    if not project_dir.is_dir():
        raise FileNotFoundError(f"{project_dir} not found (compile first)")

    manifest = regenerate_manifest(project_dir, version=version)
    real_version = manifest["version"]

    out_dir = dist_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    tarball_path = out_dir / f"{slug}-{real_version}.tar.gz"
    if tarball_path.exists():
        tarball_path.unlink()

    with tarfile.open(tarball_path, "w:gz") as tar:
        tar.add(project_dir, arcname=slug)

    return PackageResult(
        slug=slug,
        version=real_version,
        tarball_path=tarball_path,
        size_bytes=tarball_path.stat().st_size,
        sha256=_sha256(tarball_path),
    )
