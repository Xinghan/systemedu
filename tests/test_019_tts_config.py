"""spec 019 TTS 单测：tts.api_key 独立, 没配走 412。"""

from pathlib import Path
from unittest.mock import patch

import pytest
import yaml
from starlette.testclient import TestClient

from systemedu.gateway.server import create_app


@pytest.fixture
def isolated_config(tmp_path: Path, monkeypatch):
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({
        "llm": {
            "default": "creative",
            "providers": {
                "creative": {
                    "base_url": "https://example.com/v1",
                    "api_key": "sk-creative",
                    "model": "glm-5.1",
                },
            },
        },
        "tts": {
            "enabled": True,
            "api_key": "sk-tts-key-12345678",
            "model": "qwen3-tts-flash",
            "voice": "Cherry",
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
# GET /api/config 暴露 tts 字段, api_key 脱敏
# ---------------------------------------------------------------------------

def test_get_config_includes_tts_block(auth_client) -> None:
    res = auth_client.get("/api/config")
    body = res.json()
    assert "tts" in body
    assert body["tts"]["enabled"] is True
    assert body["tts"]["model"] == "qwen3-tts-flash"
    assert body["tts"]["voice"] == "Cherry"
    # api_key 应该是 mask 串
    assert "***" in body["tts"]["api_key"]
    assert "sk-tts-key" not in body["tts"]["api_key"]


# ---------------------------------------------------------------------------
# PUT /api/config 保护 tts.api_key mask
# ---------------------------------------------------------------------------

def test_put_config_preserves_tts_key_when_mask_sent(auth_client, isolated_config) -> None:
    res = auth_client.put("/api/config", json={
        "tts": {"api_key": "sk-***5678", "model": "new-tts-model"},
    })
    assert res.status_code == 200
    saved = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    assert saved["tts"]["api_key"] == "sk-tts-key-12345678"
    assert saved["tts"]["model"] == "new-tts-model"


def test_put_config_overwrites_tts_with_real_key(auth_client, isolated_config) -> None:
    res = auth_client.put("/api/config", json={
        "tts": {"api_key": "sk-new-tts-key"},
    })
    assert res.status_code == 200
    saved = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    assert saved["tts"]["api_key"] == "sk-new-tts-key"


# ---------------------------------------------------------------------------
# POST /api/config/test-tts
# ---------------------------------------------------------------------------

def test_test_tts_ok(auth_client) -> None:
    """mock dashscope 返回 200。"""
    from http import HTTPStatus

    class _FakeResp:
        status_code = HTTPStatus.OK
        message = ""

    fake_synth = type("S", (), {"call": staticmethod(lambda **kw: _FakeResp())})
    fake_audio = type("A", (), {"qwen_tts": type("Q", (), {"SpeechSynthesizer": fake_synth})()})()
    fake_dashscope = type("D", (), {"audio": fake_audio})()

    with patch.dict("sys.modules", {"dashscope": fake_dashscope}):
        res = auth_client.post("/api/config/test-tts", json={})
    body = res.json()
    assert body["ok"] is True


def test_test_tts_fails_when_no_key(auth_client, isolated_config) -> None:
    raw = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    raw["tts"]["api_key"] = ""
    isolated_config.write_text(yaml.dump(raw, default_flow_style=False), encoding="utf-8")
    from systemedu.core import config as cfg_mod
    cfg_mod.reset_config()
    # 也清掉 env
    import os
    old = os.environ.pop("DASHSCOPE_API_KEY", None)
    try:
        res = auth_client.post("/api/config/test-tts", json={})
        body = res.json()
        assert body["ok"] is False
        assert "未配置" in body["message"] or "TTS api_key" in body["message"]
    finally:
        if old is not None:
            os.environ["DASHSCOPE_API_KEY"] = old


# ---------------------------------------------------------------------------
# 412 TTS_NOT_CONFIGURED via tts.synthesize_audio
# ---------------------------------------------------------------------------

def test_tts_raises_tts_not_configured(isolated_config) -> None:
    raw = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    raw["tts"]["api_key"] = ""
    isolated_config.write_text(yaml.dump(raw, default_flow_style=False), encoding="utf-8")
    from systemedu.core import config as cfg_mod
    cfg_mod.reset_config()

    import os
    old = os.environ.pop("DASHSCOPE_API_KEY", None)
    try:
        from systemedu.core.llm_client import TTSNotConfigured
        from systemedu.education.tts import synthesize_speech

        with pytest.raises(TTSNotConfigured):
            synthesize_speech(
                text="hi",
                project_name="test",
                knode_id=1,
            )
    finally:
        if old is not None:
            os.environ["DASHSCOPE_API_KEY"] = old
