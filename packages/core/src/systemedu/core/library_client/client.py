"""LibraryClient 实现 (同步 + 异步)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote, urlparse

import httpx


# ---------------------------------------------------------------------------
# 错误类型
# ---------------------------------------------------------------------------

class LibraryError(Exception):
    """library 调用基础异常."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class LibraryNotFound(LibraryError):
    """404 — slug / knode 不存在 或 未 published."""


class LibraryUnauthorized(LibraryError):
    """401 — license token 无效."""


# ---------------------------------------------------------------------------
# 返回数据类型 (轻量 Pydantic-less dataclass)
# ---------------------------------------------------------------------------

@dataclass
class ProjectMeta:
    """projects 列表 / detail 返回的精简元信息.

    跟 library /v1/projects 返回字段对得上, 但 SDK 这层把 dict 包成 dataclass。
    """
    slug: str
    title: str
    title_zh: str | None = None
    description: str = ""
    version: str = ""
    knode_count: int = 0
    stage_count: int = 0
    duration_weeks: int | None = None
    domain: str | None = None
    age_band: str | None = None
    difficulty: int | None = None
    tags: list[str] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)
    cover_image_path: str | None = None
    published_at: str | None = None
    # detail 多带的 (list 返回时为 None)
    knowledge_tree: dict | None = None
    # spec 030: 项目级产出物 (顶层透传)
    final_outcomes: list[dict] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict) -> "ProjectMeta":
        return cls(
            slug=d["slug"],
            title=d.get("title", ""),
            title_zh=d.get("title_zh"),
            description=d.get("description", "") or "",
            version=d.get("version", "") or "",
            knode_count=d.get("knode_count", 0) or 0,
            stage_count=d.get("stage_count", 0) or 0,
            duration_weeks=d.get("duration_weeks"),
            domain=d.get("domain"),
            age_band=d.get("age_band"),
            difficulty=d.get("difficulty"),
            tags=d.get("tags") or [],
            languages=d.get("languages") or [],
            cover_image_path=d.get("cover_image_path"),
            published_at=d.get("published_at"),
            knowledge_tree=d.get("knowledge_tree"),
            final_outcomes=d.get("final_outcomes") or [],
        )


@dataclass
class KnodeContent:
    """单个 knode 的完整内容 (lesson + sections + audio + assignment + files)."""
    project_slug: str
    knode_id: str
    title: str = ""
    summary: str = ""
    week: int | None = None
    stage: str | None = None
    duration_minutes: int | None = None
    knode_dir: str = ""
    plan_markdown: str = ""
    rendered_sections: Any = None
    audio_scripts: Any = None
    assignment_md: str = ""
    theories: Any = None
    files: list[dict] = field(default_factory=list)
    version: str = ""

    @classmethod
    def from_dict(cls, d: dict) -> "KnodeContent":
        return cls(
            project_slug=d["project_slug"],
            knode_id=d["knode_id"],
            title=d.get("title", "") or "",
            summary=d.get("summary", "") or "",
            week=d.get("week"),
            stage=d.get("stage"),
            duration_minutes=d.get("duration_minutes"),
            knode_dir=d.get("knode_dir", "") or "",
            plan_markdown=d.get("plan_markdown", "") or "",
            rendered_sections=d.get("rendered_sections"),
            audio_scripts=d.get("audio_scripts"),
            assignment_md=d.get("assignment_md", "") or "",
            theories=d.get("theories"),
            files=d.get("files") or [],
            version=d.get("version", "") or "",
        )


# ---------------------------------------------------------------------------
# 共享: URL / 鉴权 / 响应处理
# ---------------------------------------------------------------------------

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def _is_local(base: str) -> bool:
    """本机回环跳过代理 (本地代理常截 127.0.0.1)."""
    host = urlparse(base).hostname or ""
    return host in _LOCAL_HOSTS


def _build_path(base: str, *parts: str) -> str:
    """拼 URL, 自动 quote slug / 文件路径."""
    quoted = "/".join(quote(p, safe="/") for p in parts if p)
    return f"{base.rstrip('/')}/{quoted.lstrip('/')}"


def _raise_for_status(r: httpx.Response) -> None:
    if r.status_code == 200:
        return
    detail = r.text[:300] if r.text else ""
    # library-app 实际用 403 表达 "license token 错/缺"; 把 401 + 403 都视为鉴权失败
    if r.status_code in (401, 403):
        raise LibraryUnauthorized(
            f"library unauthorized (check license token): {detail}",
            status_code=r.status_code,
        )
    if r.status_code == 404:
        raise LibraryNotFound(f"library not found: {detail}", status_code=404)
    raise LibraryError(
        f"library error HTTP {r.status_code}: {detail}",
        status_code=r.status_code,
    )


# ---------------------------------------------------------------------------
# 同步 client
# ---------------------------------------------------------------------------

class LibraryClient:
    """同步 SDK."""

    def __init__(
        self,
        base_url: str,
        license_token: str,
        timeout_seconds: float = 30.0,
    ) -> None:
        if not base_url:
            raise ValueError("base_url is required")
        if not license_token:
            raise ValueError("license_token is required")
        self.base_url = base_url.rstrip("/")
        self.license_token = license_token
        self._timeout = timeout_seconds
        self._client = httpx.Client(
            timeout=timeout_seconds,
            trust_env=not _is_local(self.base_url),
            headers={"Authorization": f"Bearer {license_token}"},
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "LibraryClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # --- API ---

    def list_projects(self) -> list[ProjectMeta]:
        r = self._client.get(_build_path(self.base_url, "v1", "projects"))
        _raise_for_status(r)
        return [ProjectMeta.from_dict(d) for d in r.json()]

    def get_project(self, slug: str) -> ProjectMeta:
        r = self._client.get(_build_path(self.base_url, "v1", "projects", slug))
        _raise_for_status(r)
        return ProjectMeta.from_dict(r.json())

    def get_manifest(self, slug: str) -> dict:
        r = self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "manifest")
        )
        _raise_for_status(r)
        return r.json()

    def get_tree(self, slug: str) -> dict:
        """V5 KnowledgeTree dict; 调用方自己 model_validate 成 V5KnowledgeTree."""
        r = self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "tree")
        )
        _raise_for_status(r)
        return r.json()

    def get_blueprint(self, slug: str, lang: str = "zh-CN") -> dict:
        """返回 {lang_requested, lang_returned, content} dict."""
        r = self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "blueprint"),
            params={"lang": lang},
        )
        _raise_for_status(r)
        return r.json()

    def get_knode(self, slug: str, knode_id: str) -> KnodeContent:
        r = self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "knodes", knode_id)
        )
        _raise_for_status(r)
        return KnodeContent.from_dict(r.json())

    def get_file_url(self, slug: str, path: str) -> str:
        """返回完整 URL, 调用方拿去直接给前端 (或 server-side 再 fetch)."""
        return _build_path(self.base_url, "v1", "projects", slug, "files", path)

    def fetch_file(self, slug: str, path: str) -> bytes:
        """下载文件二进制内容 (server-side 用; 前端通常直接拿 URL)."""
        r = self._client.get(self.get_file_url(slug, path))
        _raise_for_status(r)
        return r.content


# ---------------------------------------------------------------------------
# 异步 client (cloud-app gateway 是 async, 这个是主要用法)
# ---------------------------------------------------------------------------

class AsyncLibraryClient:
    """异步 SDK; API 跟 LibraryClient 对称."""

    def __init__(
        self,
        base_url: str,
        license_token: str,
        timeout_seconds: float = 30.0,
    ) -> None:
        if not base_url:
            raise ValueError("base_url is required")
        if not license_token:
            raise ValueError("license_token is required")
        self.base_url = base_url.rstrip("/")
        self.license_token = license_token
        self._timeout = timeout_seconds
        self._client = httpx.AsyncClient(
            timeout=timeout_seconds,
            trust_env=not _is_local(self.base_url),
            headers={"Authorization": f"Bearer {license_token}"},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncLibraryClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    # --- API ---

    async def list_projects(self) -> list[ProjectMeta]:
        r = await self._client.get(_build_path(self.base_url, "v1", "projects"))
        _raise_for_status(r)
        return [ProjectMeta.from_dict(d) for d in r.json()]

    async def get_project(self, slug: str) -> ProjectMeta:
        r = await self._client.get(_build_path(self.base_url, "v1", "projects", slug))
        _raise_for_status(r)
        return ProjectMeta.from_dict(r.json())

    async def get_manifest(self, slug: str) -> dict:
        r = await self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "manifest")
        )
        _raise_for_status(r)
        return r.json()

    async def get_tree(self, slug: str) -> dict:
        r = await self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "tree")
        )
        _raise_for_status(r)
        return r.json()

    async def get_project_knowledge_tree(self, slug: str) -> dict:
        """spec 035: 项目级知识树点亮 (lit_nodes + subjects_used + missing_concepts)."""
        r = await self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "knowledge-tree")
        )
        _raise_for_status(r)
        return r.json()

    async def get_platform_knowledge_tree(self) -> dict:
        """spec 035: 全平台学科理论知识树 (11 学科 ~425 节点)."""
        r = await self._client.get(
            _build_path(self.base_url, "v1", "platform", "knowledge-tree")
        )
        _raise_for_status(r)
        return r.json()

    async def get_blueprint(self, slug: str, lang: str = "zh-CN") -> dict:
        r = await self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "blueprint"),
            params={"lang": lang},
        )
        _raise_for_status(r)
        return r.json()

    async def get_knode(self, slug: str, knode_id: str) -> KnodeContent:
        r = await self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "knodes", knode_id)
        )
        _raise_for_status(r)
        return KnodeContent.from_dict(r.json())

    def get_file_url(self, slug: str, path: str) -> str:
        return _build_path(self.base_url, "v1", "projects", slug, "files", path)

    async def fetch_file(self, slug: str, path: str) -> bytes:
        r = await self._client.get(self.get_file_url(slug, path))
        _raise_for_status(r)
        return r.content

    async def download_project(self, slug: str) -> bytes:
        """spec 033: 下载完整 tarball, 用于 student-app pull 时本地 clone."""
        r = await self._client.get(
            _build_path(self.base_url, "v1", "projects", slug, "download"),
            timeout=60.0,
        )
        _raise_for_status(r)
        return r.content
