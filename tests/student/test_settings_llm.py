"""用户级 LLM 配置测试 (spec 040) — /api/settings/llm。

asgi_client 进程内 + _login (调试模式不真发短信)。custom 保存校验用 monkeypatch
mock 掉真实 LLM 请求 (不连网)。
"""
from __future__ import annotations

import importlib

import fakeredis.aioredis
import pytest

from systemedu.student import cache
from systemedu.student.sms import aliyun


@pytest.fixture(autouse=True)
def _redis():
    cache.replace_client_for_tests(fakeredis.aioredis.FakeRedis())
    yield


@pytest.fixture(autouse=True)
def _sms_debug(monkeypatch):
    monkeypatch.setenv("ALIYUN_SMS_DEBUG", "true")  # 绝不真发短信
    importlib.reload(aliyun)
    yield


async def _login(asgi_client, phone="13800138777") -> str:
    await asgi_client.post("/api/auth/send-code", json={"phone": phone})
    code = (await cache.get_cache().get(f"sms:code:{phone}")).decode()
    r = await asgi_client.post("/api/auth/verify", json={"phone": phone, "code": code})
    return r.json()["token"]


@pytest.fixture
def crypto_key(monkeypatch):
    """给加密功能配一个临时 Fernet 密钥。"""
    from systemedu.student.settings.crypto import generate_key

    monkeypatch.setenv("STUDENT_LLM_CONFIG_KEY", generate_key())


@pytest.mark.asyncio
async def test_get_requires_login(asgi_client):
    r = await asgi_client.get("/api/settings/llm")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_default_is_default(asgi_client):
    tok = await _login(asgi_client, "13800138701")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.get("/api/settings/llm", headers=H)
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "default"
    assert body["default_model"]  # 系统默认 model 名非空


@pytest.mark.asyncio
async def test_save_default(asgi_client):
    tok = await _login(asgi_client, "13800138702")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.put("/api/settings/llm", json={"mode": "default"}, headers=H)
    assert r.status_code == 200
    g = await asgi_client.get("/api/settings/llm", headers=H)
    assert g.json()["mode"] == "default"


@pytest.mark.asyncio
async def test_save_custom_ok_stores_ciphertext(asgi_client, crypto_key, monkeypatch):
    # mock 校验通过
    monkeypatch.setattr(
        "systemedu.student.settings.routes._validate_custom",
        lambda b, k, m: (True, ""),
    )
    tok = await _login(asgi_client, "13800138703")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.put(
        "/api/settings/llm",
        json={
            "mode": "custom",
            "base_url": "https://example.com/v1",
            "api_key": "sk-my-secret-key",
            "model": "qwen-plus",
        },
        headers=H,
    )
    assert r.status_code == 200, r.text

    # GET 不返明文, has_key=true
    g = (await asgi_client.get("/api/settings/llm", headers=H)).json()
    assert g["mode"] == "custom"
    assert g["model"] == "qwen-plus"
    assert g["has_key"] is True
    assert "sk-my-secret-key" not in str(g)

    # DB 里存的是密文
    from sqlalchemy import select

    from systemedu.student.db import UserLLMConfig, get_session

    with get_session() as s:
        rows = s.execute(select(UserLLMConfig)).scalars().all()
        target = [r for r in rows if r.model == "qwen-plus"]
        assert target, "应有该 custom 配置行"
        assert target[0].api_key_enc
        assert "sk-my-secret-key" not in target[0].api_key_enc  # 非明文


@pytest.mark.asyncio
async def test_save_custom_invalid_key_422_not_stored(asgi_client, crypto_key, monkeypatch):
    monkeypatch.setattr(
        "systemedu.student.settings.routes._validate_custom",
        lambda b, k, m: (False, "invalid_key"),
    )
    tok = await _login(asgi_client, "13800138704")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.put(
        "/api/settings/llm",
        json={
            "mode": "custom",
            "base_url": "https://example.com/v1",
            "api_key": "sk-bad",
            "model": "qwen-plus",
        },
        headers=H,
    )
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_key"
    # 不落库: GET 仍是 default
    g = (await asgi_client.get("/api/settings/llm", headers=H)).json()
    assert g["mode"] == "default"


@pytest.mark.asyncio
async def test_save_custom_model_not_found_422(asgi_client, crypto_key, monkeypatch):
    monkeypatch.setattr(
        "systemedu.student.settings.routes._validate_custom",
        lambda b, k, m: (False, "model_not_found"),
    )
    tok = await _login(asgi_client, "13800138705")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.put(
        "/api/settings/llm",
        json={
            "mode": "custom",
            "base_url": "https://example.com/v1",
            "api_key": "sk-x",
            "model": "no-such-model",
        },
        headers=H,
    )
    assert r.status_code == 422
    assert r.json()["error"] == "model_not_found"


@pytest.mark.asyncio
async def test_save_custom_non_https_400(asgi_client, crypto_key):
    tok = await _login(asgi_client, "13800138706")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.put(
        "/api/settings/llm",
        json={
            "mode": "custom",
            "base_url": "http://insecure.com/v1",
            "api_key": "sk-x",
            "model": "qwen-plus",
        },
        headers=H,
    )
    assert r.status_code == 400
    assert r.json()["error"] == "base_url_must_be_https"


def test_crypto_roundtrip(monkeypatch):
    from systemedu.student.settings.crypto import (
        crypto_available,
        decrypt_key,
        encrypt_key,
        generate_key,
    )

    monkeypatch.setenv("STUDENT_LLM_CONFIG_KEY", generate_key())
    assert crypto_available()
    enc = encrypt_key("sk-secret")
    assert enc != "sk-secret"
    assert decrypt_key(enc) == "sk-secret"
