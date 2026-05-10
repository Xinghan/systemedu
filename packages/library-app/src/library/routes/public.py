"""Public API routes (license token required).

cloud-app 通过 LibraryClient 调这些 endpoint 拿项目内容.

P1 占位; P2 实质实现 list/project/manifest/tree/blueprint/knode/file.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import require_license

router = APIRouter()


@router.get("/projects")
def list_projects(_token: str = Depends(require_license)) -> list[dict]:
    """列出 published 项目 (P2 实现)."""
    return []  # placeholder
