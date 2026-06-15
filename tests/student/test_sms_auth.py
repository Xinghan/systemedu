import pytest
import fakeredis.aioredis
from systemedu.student import cache
from systemedu.student.sms import codes


@pytest.fixture(autouse=True)
def _redis():
    cache.replace_client_for_tests(fakeredis.aioredis.FakeRedis())
    yield


@pytest.mark.asyncio
async def test_generate_and_verify_code():
    code = await codes.issue_code("13800138000")
    assert len(code) == 6 and code.isdigit()
    assert await codes.verify_code("13800138000", code) is True
    # 一次性：再验证失败
    assert await codes.verify_code("13800138000", code) is False


@pytest.mark.asyncio
async def test_wrong_code_rejected():
    await codes.issue_code("13800138000")
    assert await codes.verify_code("13800138000", "000000") is False


@pytest.mark.asyncio
async def test_cooldown():
    await codes.issue_code("13800138000")
    assert await codes.in_cooldown("13800138000") is True
    assert await codes.in_cooldown("13900139000") is False
