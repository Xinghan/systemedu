"""spec 033 backfill: 把 content-workspace/dist/ 里的 tarball 复制到
library 的 PROJECTS_MEDIA_DIR/<slug>/_archive/<slug>-<version>.tar.gz.

旧导入逻辑没存 archive 副本, 但 dist/ 里通常还有原始 tarball。这个脚本
扫所有 library project, 找到匹配版本的 tarball, 拷过去。

Usage:
    LIBRARY_HOME=~/.systemedu/library python3 scripts/library_backfill_archives.py
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


def main() -> int:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages" / "library-app" / "src"))
    from library.models import Project, get_session  # type: ignore
    from library.settings import PROJECTS_MEDIA_DIR  # type: ignore

    dist_dir = Path(__file__).resolve().parents[1] / "content-workspace" / "dist"
    if not dist_dir.exists():
        print(f"dist dir not found: {dist_dir}", file=sys.stderr)
        return 1

    db = get_session()
    try:
        projects = db.query(Project).all()
        if not projects:
            print("no projects in library DB", file=sys.stderr)
            return 0

        for p in projects:
            archive_dir = PROJECTS_MEDIA_DIR / p.slug / "_archive"
            expected = archive_dir / f"{p.slug}-{p.version}.tar.gz"
            if expected.exists():
                print(f"  [skip] {p.slug}-{p.version}: archive already present")
                continue

            candidate = dist_dir / f"{p.slug}-{p.version}.tar.gz"
            if not candidate.exists():
                print(f"  [miss] {p.slug}-{p.version}: not found in dist/", file=sys.stderr)
                continue

            archive_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(candidate, expected)
            print(f"  [ok]  {p.slug}-{p.version} -> {expected}")

    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
