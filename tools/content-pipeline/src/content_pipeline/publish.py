"""publish: 把打好的 tarball 上传到 library-app /admin/projects/import.

支持 --target=local 或一个 https URL; --admin-token 通过 env 或参数提供。
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx


DEFAULT_LOCAL_URL = "http://127.0.0.1:18821"

# 本机回环跳过代理 (本地代理常截 127.0.0.1 → 502)
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def _is_local(base: str) -> bool:
    host = urlparse(base).hostname or ""
    return host in _LOCAL_HOSTS


@dataclass
class PublishResult:
    target_url: str
    slug: str
    imported: bool
    response: dict


def _resolve_target(target: str) -> str:
    if target == "local":
        return os.environ.get("LIBRARY_URL", DEFAULT_LOCAL_URL)
    if target.startswith("http://") or target.startswith("https://"):
        return target.rstrip("/")
    raise ValueError(f"unknown --target: {target!r} (use 'local' or full http/https URL)")


def _resolve_admin_token(token: str | None) -> str:
    if token:
        return token
    env = os.environ.get("LIBRARY_ADMIN_TOKEN")
    if env:
        return env
    raise RuntimeError(
        "admin token required: pass --admin-token or set LIBRARY_ADMIN_TOKEN env var. "
        "Token is obtained by logging into library admin (POST /admin/auth/login)."
    )


def publish_tarball(
    tarball_path: Path,
    target: str = "local",
    admin_token: str | None = None,
    overwrite: bool = True,
    timeout_seconds: float = 600.0,
) -> PublishResult:
    """上传 tarball 到 <target>/admin/projects/import."""
    if not tarball_path.is_file():
        raise FileNotFoundError(tarball_path)

    base = _resolve_target(target)
    token = _resolve_admin_token(admin_token)

    url = f"{base}/admin/projects/import"
    params = {"overwrite": "true" if overwrite else "false"}
    headers = {"Authorization": f"Bearer {token}"}

    with tarball_path.open("rb") as f:
        files = {"file": (tarball_path.name, f, "application/gzip")}
        with httpx.Client(timeout=timeout_seconds, trust_env=not _is_local(base)) as client:
            r = client.post(url, params=params, headers=headers, files=files)
    if r.status_code != 200:
        raise RuntimeError(
            f"publish failed: HTTP {r.status_code} {r.text[:500]}"
        )
    payload = r.json()
    return PublishResult(
        target_url=base,
        slug=payload.get("slug", ""),
        imported=bool(payload.get("imported")),
        response=payload,
    )


def login_for_token(target: str, username: str, password: str) -> str:
    """便利函数: 用 username/password 调 /admin/auth/login 拿 JWT."""
    base = _resolve_target(target)
    with httpx.Client(timeout=30.0, trust_env=not _is_local(base)) as client:
        r = client.post(
            f"{base}/admin/auth/login",
            json={"username": username, "password": password},
        )
    if r.status_code != 200:
        raise RuntimeError(f"login failed: HTTP {r.status_code} {r.text[:300]}")
    return r.json()["token"]
