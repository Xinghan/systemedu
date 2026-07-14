"""spec 046 — 邀请码注册机制。

覆盖:
  - 新用户无邀请码 -> 403 invite_required
  - 有效邀请码 -> 注册成功且码被消耗 (used_by/used_at)
  - 已用邀请码 -> 403 且不建号
  - 无效邀请码 -> 403
  - 老用户登录不需要邀请码
  - 开关关闭 (INVITE_CODE_REQUIRED=false) 时旧行为不变
  - 邀请码大小写不敏感 (前端小写输入也可用)

conftest.asgi_app 已全局 INVITE_CODE_REQUIRED=false, 本文件用例按需覆盖为 true。
"""
from __future__ import annotations

import importlib

import fakeredis.aioredis
import pytest

from systemedu.student import cache
from systemedu.student.db import create_invite_codes, get_session, get_user_by_phone, InviteCode
from systemedu.student.sms import aliyun, codes


@pytest.fixture(autouse=True)
def _redis():
    cache.replace_client_for_tests(fakeredis.aioredis.FakeRedis())
    yield


@pytest.fixture(autouse=True)
def _sms_debug(monkeypatch):
    monkeypatch.setenv("ALIYUN_SMS_DEBUG", "true")  # 绝不真发短信
    importlib.reload(aliyun)
    yield


@pytest.fixture
def invite_on(monkeypatch):
    monkeypatch.setenv("INVITE_CODE_REQUIRED", "true")
    yield


async def _verify(asgi_client, phone: str, invite_code: str | None = None):
    # 直接 issue_code 生成验证码 (绕过 send-code 的 60s 冷却, 同号多次登录用例需要)
    code = await codes.issue_code(phone)
    body = {"phone": phone, "code": code}
    if invite_code is not None:
        body["invite_code"] = invite_code
    return await asgi_client.post("/api/auth/verify", json=body)


def _get_code(code: str) -> InviteCode | None:
    with get_session() as session:
        row = session.get(InviteCode, code)
        if row is None:
            return None
        session.expunge(row)
        return row


async def test_new_user_without_code_rejected(asgi_client, invite_on):
    r = await _verify(asgi_client, "13900010001")
    assert r.status_code == 403
    assert r.json()["invite_required"] is True
    assert get_user_by_phone("13900010001") is None  # 未建号


async def test_new_user_with_valid_code(asgi_client, invite_on):
    create_invite_codes(["TESTAB22"], batch="ut")
    r = await _verify(asgi_client, "13900010002", "TESTAB22")
    assert r.status_code == 200
    assert "token" in r.json()
    user = get_user_by_phone("13900010002")
    assert user is not None
    row = _get_code("TESTAB22")
    assert row.used_by == user.id
    assert row.used_at is not None


async def test_used_code_rejected(asgi_client, invite_on):
    create_invite_codes(["TESTAB33"], batch="ut")
    r1 = await _verify(asgi_client, "13900010003", "TESTAB33")
    assert r1.status_code == 200
    r2 = await _verify(asgi_client, "13900010004", "TESTAB33")
    assert r2.status_code == 403
    assert "邀请码" in r2.json()["error"]
    assert get_user_by_phone("13900010004") is None  # 领码失败不建号


async def test_invalid_code_rejected(asgi_client, invite_on):
    r = await _verify(asgi_client, "13900010005", "NOSUCH88")
    assert r.status_code == 403
    assert get_user_by_phone("13900010005") is None


async def test_existing_user_login_without_code(asgi_client, invite_on):
    # 先用有效码注册
    create_invite_codes(["TESTAB44"], batch="ut")
    r1 = await _verify(asgi_client, "13900010006", "TESTAB44")
    assert r1.status_code == 200
    # 再次登录 (老用户) 不带邀请码
    r2 = await _verify(asgi_client, "13900010006")
    assert r2.status_code == 200
    assert "token" in r2.json()


async def test_switch_off_keeps_old_behavior(asgi_client):
    # conftest 已设 INVITE_CODE_REQUIRED=false, 新用户无码直接注册
    r = await _verify(asgi_client, "13900010007")
    assert r.status_code == 200
    assert get_user_by_phone("13900010007") is not None


async def test_code_case_insensitive(asgi_client, invite_on):
    create_invite_codes(["TESTAB55"], batch="ut")
    r = await _verify(asgi_client, "13900010008", "testab55")
    assert r.status_code == 200


async def test_invite_rejection_preserves_sms_code(asgi_client, invite_on):
    """邀请码预检失败不得消耗一次性短信验证码 (否则用户被迫等冷却重发)。"""
    phone = "13900010009"
    sms = await codes.issue_code(phone)
    # 无邀请码被拒
    r1 = await asgi_client.post("/api/auth/verify", json={"phone": phone, "code": sms})
    assert r1.status_code == 403
    # 无效邀请码被拒
    r2 = await asgi_client.post(
        "/api/auth/verify", json={"phone": phone, "code": sms, "invite_code": "NOSUCH99"}
    )
    assert r2.status_code == 403
    # 同一个验证码配有效邀请码, 依然可用 (未被前两次消耗)
    create_invite_codes(["TESTAB66"], batch="ut")
    r3 = await asgi_client.post(
        "/api/auth/verify", json={"phone": phone, "code": sms, "invite_code": "TESTAB66"}
    )
    assert r3.status_code == 200
