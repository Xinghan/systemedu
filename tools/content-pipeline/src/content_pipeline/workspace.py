"""content-workspace/ 目录路径管理.

content-workspace/ 是本地 git-ignored 工作区:
- blueprints/<slug>/README.md, README.zh.md   蓝图原文 (从 systemeduidea sync)
- generated/<slug>/                            编译/生成出的项目内容包
- dist/<slug>-<version>.tar.gz                 export 出的 tarball
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final


def find_repo_root(start: Path | None = None) -> Path:
    """从当前目录向上找 systemedu repo 根 (含 pyproject.toml + packages/)."""
    cur = (start or Path.cwd()).resolve()
    for p in [cur, *cur.parents]:
        if (p / "packages").is_dir() and (p / "pyproject.toml").is_file():
            return p
    raise RuntimeError(
        f"could not find systemedu repo root from {cur} "
        "(no parent has packages/ + pyproject.toml)"
    )


def workspace_root() -> Path:
    """content-workspace/ 路径; 可通过 SYSTEMEDU_CONTENT_WORKSPACE 覆盖."""
    override = os.environ.get("SYSTEMEDU_CONTENT_WORKSPACE")
    if override:
        return Path(override).expanduser().resolve()
    return find_repo_root() / "content-workspace"


def blueprints_dir() -> Path:
    return workspace_root() / "blueprints"


def generated_dir() -> Path:
    return workspace_root() / "generated"


def dist_dir() -> Path:
    return workspace_root() / "dist"


def project_blueprint_dir(slug: str) -> Path:
    return blueprints_dir() / slug


def project_generated_dir(slug: str) -> Path:
    return generated_dir() / slug


def ensure_workspace() -> None:
    for d in (blueprints_dir(), generated_dir(), dist_dir()):
        d.mkdir(parents=True, exist_ok=True)
