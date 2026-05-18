"""spec 031 P1.4: Redis cache wrapper for student-app.

提供 async get / set / setex / delete. 用法:
    from systemedu.student.cache import get_cache
    cache = get_cache()
    await cache.setex("knode:slug:M01:summary", 300, "...")
    val = await cache.get("knode:slug:M01:summary")

env:
    STUDENT_REDIS_URL  默认 redis://127.0.0.1:6379/0
    STUDENT_REDIS_DISABLED=1  pytest / dev 时禁 Redis, 直接 fallback (返 None / no-op)

测试用 fakeredis (in-memory) 注入: `replace_client_for_tests(fakeredis.aioredis.FakeRedis())`
"""

from __future__ import annotations

import logging
import os
from typing import Protocol


log = logging.getLogger(__name__)


class _RedisLike(Protocol):
    async def get(self, key: str) -> bytes | None: ...
    async def set(self, key: str, value: str | bytes) -> bool: ...
    async def setex(self, key: str, ttl: int, value: str | bytes) -> bool: ...
    async def delete(self, *keys: str) -> int: ...
    async def aclose(self) -> None: ...


_client: _RedisLike | None = None
_disabled = False


def _build_client() -> _RedisLike:
    """构造真 redis client. 失败时返 noop fallback."""
    import redis.asyncio as redis_async

    url = os.environ.get("STUDENT_REDIS_URL", "redis://127.0.0.1:6379/0")
    return redis_async.from_url(url, decode_responses=False)


class _NoopClient:
    """STUDENT_REDIS_DISABLED=1 时的 fallback — get 永返 None, set 静默成功."""

    async def get(self, key: str) -> bytes | None:
        return None

    async def set(self, key: str, value: str | bytes) -> bool:
        return True

    async def setex(self, key: str, ttl: int, value: str | bytes) -> bool:
        return True

    async def delete(self, *keys: str) -> int:
        return 0

    async def aclose(self) -> None:
        pass


def get_cache() -> _RedisLike:
    """单例 client. 第一次访问时 lazy init."""
    global _client, _disabled
    if _client is not None:
        return _client
    if os.environ.get("STUDENT_REDIS_DISABLED") == "1":
        _client = _NoopClient()
        _disabled = True
        log.info("redis cache disabled (STUDENT_REDIS_DISABLED=1) — noop")
        return _client
    try:
        _client = _build_client()
        log.info("redis cache connected")
    except Exception as e:
        log.warning("redis cache init failed (%s), falling back to noop", e)
        _client = _NoopClient()
        _disabled = True
    return _client


def replace_client_for_tests(client: _RedisLike) -> None:
    """pytest fixture 用: 注入 fakeredis."""
    global _client
    _client = client


def reset_client_for_tests() -> None:
    global _client, _disabled
    _client = None
    _disabled = False


__all__ = [
    "get_cache",
    "replace_client_for_tests",
    "reset_client_for_tests",
]
