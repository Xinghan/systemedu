"""spec 031 P1.4: Redis cache wrapper tests (用 fakeredis)."""

from __future__ import annotations

import pytest


@pytest.fixture
def fake_cache():
    import fakeredis.aioredis
    from systemedu.student import cache as cache_mod

    fake = fakeredis.aioredis.FakeRedis(decode_responses=False)
    cache_mod.reset_client_for_tests()
    cache_mod.replace_client_for_tests(fake)
    yield fake
    cache_mod.reset_client_for_tests()


@pytest.fixture
def noop_cache(monkeypatch):
    from systemedu.student import cache as cache_mod
    monkeypatch.setenv("STUDENT_REDIS_DISABLED", "1")
    cache_mod.reset_client_for_tests()
    yield
    monkeypatch.delenv("STUDENT_REDIS_DISABLED", raising=False)
    cache_mod.reset_client_for_tests()


async def test_setex_get_roundtrip(fake_cache):
    from systemedu.student.cache import get_cache
    c = get_cache()
    await c.setex("k1", 60, b"v1")
    v = await c.get("k1")
    assert v == b"v1"


async def test_get_missing_returns_none(fake_cache):
    from systemedu.student.cache import get_cache
    c = get_cache()
    assert await c.get("nope") is None


async def test_delete(fake_cache):
    from systemedu.student.cache import get_cache
    c = get_cache()
    await c.setex("k", 60, b"v")
    await c.delete("k")
    assert await c.get("k") is None


async def test_disabled_returns_noop(noop_cache):
    from systemedu.student.cache import get_cache
    c = get_cache()
    await c.setex("k", 60, b"v")
    assert await c.get("k") is None  # noop never stores
