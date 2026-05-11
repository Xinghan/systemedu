"""LibraryClient — cloud-app 调 library-app 公开 API 的 SDK.

设计:
- 只调 /v1/* 公开 API (license token 鉴权), 不调 /admin/*
- 不缓存; 调用方自己负责短期缓存 (cloud-app 用 in-memory dict 即可)
- 错误抽象成 LibraryError 子类, 让 cloud-app 区分 not_found / unauthorized / 网络错
- 同步 + 异步两套 (cloud-app 主要 async, 但本地脚本 sync 也方便)

用法:
    from systemedu.core.library_client import LibraryClient

    client = LibraryClient(
        base_url=os.environ["LIBRARY_URL"],
        license_token=os.environ["LIBRARY_LICENSE_TOKEN"],
    )
    projects = client.list_projects()
    knode = client.get_knode("ai-ant-ethologist", "M01")
    img_url = client.get_file_url("ai-ant-ethologist", "knodes/M01-../media/cover.png")
"""

from __future__ import annotations

from .client import (
    AsyncLibraryClient,
    LibraryClient,
    LibraryError,
    LibraryNotFound,
    LibraryUnauthorized,
    ProjectMeta,
    KnodeContent,
)


__all__ = [
    "LibraryClient",
    "AsyncLibraryClient",
    "LibraryError",
    "LibraryNotFound",
    "LibraryUnauthorized",
    "ProjectMeta",
    "KnodeContent",
]
