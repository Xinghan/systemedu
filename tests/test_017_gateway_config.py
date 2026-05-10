"""spec 017: gateway /api/config + /api/config/test-llm 单测。

覆盖:
- GET /api/config: api_key 脱敏 + user_editable 白名单
- PUT /api/config: mask 串保护旧 key
- POST /api/config/test-llm: ok / 未配置 / 异常
- LLMNotConfigured → 412 全局
"""

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
import yaml
from starlette.testclient import TestClient

from systemedu.cloud.gateway.server import (
    _looks_like_mask,
    _mask_api_key,
    create_app,
)


# ---------------------------------------------------------------------------
# 单元: _mask_api_key
# ---------------------------------------------------------------------------

def test_mask_empty_key() -> None:
    assert _mask_api_key("") == ""


def test_mask_short_key() -> None:
    assert _mask_api_key("12345678") == "***"


def test_mask_long_key() -> None:
    masked = _mask_api_key("sk-abcdefghijklmnop")
    assert masked.startswith("sk-")
    assert masked.endswith("mnop")
    assert "***" in masked


def test_looks_like_mask() -> None:
    assert _looks_like_mask("sk-***mnop")
    assert _looks_like_mask("***")
    assert not _looks_like_mask("sk-realkey1234")
    assert not _looks_like_mask("")


# ---------------------------------------------------------------------------
# Fixture: 隔离 config 到 tmp_path
# ---------------------------------------------------------------------------

@pytest.fixture
def isolated_config(tmp_path: Path, monkeypatch):
    """每个测试用独立 config.yaml，避免污染 ~/.systemedu/。"""
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({
        "llm": {
            "default": "thinking",
            "providers": {
                "thinking": {
                    "base_url": "https://example.com/v1",
                    "api_key": "sk-realkey1234567890",
                    "model": "glm-5.1",
                    "temperature": 1.0,
                    "max_tokens": 65536,
                },
                "coding": {
                    "base_url": "https://coding.example.com/v1",
                    "api_key": "sk-coding-keyabcdefgh",
                    "model": "glm-4.6",
                    "temperature": 0.7,
                    "max_tokens": 65536,
                },
                "fast": {
                    "base_url": "https://fast.example.com/v1",
                    "api_key": "sk-fast-keyabcdefgh",
                    "model": "glm-4.6",
                    "temperature": 0.3,
                    "max_tokens": 8192,
                },
            },
        },
        "gateway": {"host": "127.0.0.1", "port": 18820},
        "sandbox": {"enabled": False},
        "memory": {"enabled": False, "backend": "mem0"},
    }, default_flow_style=False), encoding="utf-8")

    from systemedu.core import config as cfg_mod
    monkeypatch.setattr(cfg_mod, "CONFIG_FILE", cfg_path)
    cfg_mod.reset_config()

    return cfg_path


@pytest.fixture
def auth_client(isolated_config):
    app = create_app()
    client = TestClient(app, raise_server_exceptions=False)
    token = client.post(
        "/api/auth/login", json={"username": "root", "password": "123systemedu"}
    ).json()["token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


# ---------------------------------------------------------------------------
# GET /api/config
# ---------------------------------------------------------------------------

def test_get_config_masks_api_key(auth_client) -> None:
    res = auth_client.get("/api/config")
    assert res.status_code == 200
    body = res.json()
    creative = body["llm"]["providers"]["thinking"]
    assert "***" in creative["api_key"]
    assert "realkey" not in creative["api_key"]


def test_get_config_includes_user_editable(auth_client) -> None:
    res = auth_client.get("/api/config")
    # spec 021: 3 角色都暴露
    assert res.json()["llm"]["user_editable"] == ["thinking", "coding", "fast"]


def test_get_config_includes_max_tokens(auth_client) -> None:
    res = auth_client.get("/api/config")
    creative = res.json()["llm"]["providers"]["thinking"]
    assert creative["max_tokens"] == 65536


# ---------------------------------------------------------------------------
# PUT /api/config: mask 保护
# ---------------------------------------------------------------------------

def test_put_config_preserves_key_when_mask_sent(auth_client, isolated_config) -> None:
    # 用户回传 mask 串，期望旧 key 被保留
    res = auth_client.put("/api/config", json={
        "llm": {"providers": {"thinking": {
            "api_key": "sk-***7890",
            "model": "glm-5.1-new",
        }}},
    })
    assert res.status_code == 200

    saved = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    assert saved["llm"]["providers"]["thinking"]["api_key"] == "sk-realkey1234567890"
    assert saved["llm"]["providers"]["thinking"]["model"] == "glm-5.1-new"


def test_put_config_overwrites_with_real_key(auth_client, isolated_config) -> None:
    res = auth_client.put("/api/config", json={
        "llm": {"providers": {"thinking": {"api_key": "sk-newrealkey"}}},
    })
    assert res.status_code == 200

    saved = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    assert saved["llm"]["providers"]["thinking"]["api_key"] == "sk-newrealkey"


def test_put_config_empty_key_does_not_clear(auth_client, isolated_config) -> None:
    res = auth_client.put("/api/config", json={
        "llm": {"providers": {"thinking": {"api_key": ""}}},
    })
    assert res.status_code == 200

    saved = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    assert saved["llm"]["providers"]["thinking"]["api_key"] == "sk-realkey1234567890"


# ---------------------------------------------------------------------------
# POST /api/config/test-llm
# ---------------------------------------------------------------------------

def test_test_llm_missing_provider(auth_client) -> None:
    res = auth_client.post("/api/config/test-llm", json={})
    assert res.status_code == 400


def test_test_llm_unknown_provider(auth_client) -> None:
    res = auth_client.post("/api/config/test-llm", json={"provider": "doesnotexist"})
    body = res.json()
    assert body["ok"] is False
    assert body["latency_ms"] >= 0


def test_test_llm_ok(auth_client) -> None:
    fake = AsyncMock()
    fake.ainvoke.return_value = type("R", (), {"content": "ok"})()
    # api_test_llm 内部 lazy import: from systemedu.core.llm_client import get_llm
    with patch("systemedu.core.llm_client.get_llm", return_value=fake):
        res = auth_client.post("/api/config/test-llm", json={"provider": "thinking"})
    body = res.json()
    assert body["ok"] is True
    assert body["latency_ms"] >= 0


def test_test_llm_not_configured(auth_client, isolated_config) -> None:
    # 把 creative.api_key 清空
    raw = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    raw["llm"]["providers"]["thinking"]["api_key"] = ""
    isolated_config.write_text(yaml.dump(raw, default_flow_style=False), encoding="utf-8")
    from systemedu.core import config as cfg_mod
    cfg_mod.reset_config()

    res = auth_client.post("/api/config/test-llm", json={"provider": "thinking"})
    body = res.json()
    assert body["ok"] is False
    assert "API Key" in body["message"] or "未配置" in body["message"]


# ---------------------------------------------------------------------------
# 412 全局: LLMNotConfigured 在任意路由抛出 → 412 + LLM_NOT_CONFIGURED
# ---------------------------------------------------------------------------

def test_412_when_creative_not_configured_in_generate_description(auth_client, isolated_config) -> None:
    """spec 021: 三个 provider 全没 key, generate-description (走 fast) -> 412"""
    raw = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    for r in ("thinking", "coding", "fast"):
        raw["llm"]["providers"][r]["api_key"] = ""
    isolated_config.write_text(yaml.dump(raw, default_flow_style=False), encoding="utf-8")
    from systemedu.core import config as cfg_mod
    cfg_mod.reset_config()

    res = auth_client.post(
        "/api/projects/generate-description",
        json={"title": "测试项目", "age": 9, "node_count": 25},
    )
    assert res.status_code == 412
    body = res.json()
    assert body["error"] == "LLM_NOT_CONFIGURED"


def test_412_when_creative_not_configured_in_generate_tree(auth_client, isolated_config) -> None:
    """spec 021: thinking 没 key (planner 必须 thinking) -> 412"""
    raw = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    raw["llm"]["providers"]["thinking"]["api_key"] = ""
    isolated_config.write_text(yaml.dump(raw, default_flow_style=False), encoding="utf-8")
    from systemedu.core import config as cfg_mod
    cfg_mod.reset_config()

    res = auth_client.post(
        "/api/projects/generate-tree",
        json={"title": "测试", "description": "一个测试项目", "age": 9, "node_count": 5},
    )
    assert res.status_code == 412
    assert res.json()["error"] == "LLM_NOT_CONFIGURED"
