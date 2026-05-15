"""library client singleton — 单例 AsyncLibraryClient (复用 systemedu.core)。"""

from __future__ import annotations

import os

from systemedu.core.library_client import AsyncLibraryClient


_library_client: AsyncLibraryClient | None = None


def get_library_client() -> AsyncLibraryClient:
    global _library_client
    if _library_client is None:
        base_url = os.environ.get("LIBRARY_BASE_URL") or os.environ.get(
            "LIBRARY_URL", "http://127.0.0.1:18821"
        )
        token = os.environ.get(
            "LIBRARY_LICENSE_TOKEN", "dev-only-license-token-change-me"
        )
        _library_client = AsyncLibraryClient(base_url, token)
    return _library_client


def reset_library_client_for_tests() -> None:
    global _library_client
    _library_client = None
