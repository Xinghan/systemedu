"""spec 017+019+021: v3 pipeline 角色路由 + factory 路径测试.

spec 021 把单一 creative provider 拆成 thinking / coding / fast 三个角色:
- creative role -> coding provider (fallback: fast / thinking)
- fast role     -> fast provider   (fallback: coding / thinking)
(spec 034: factory.generate_assignment / generate_audio_scripts 已删除, 这里只剩 v3 pipeline 角色路由测试)
"""

from pathlib import Path
from unittest.mock import patch

import pytest
import yaml

from systemedu.core import config as cfg_mod


@pytest.fixture
def isolated_config(tmp_path: Path, monkeypatch):
    """完整三角色都配齐, 测试 happy path."""
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({
        "llm": {
            "default": "thinking",
            "providers": {
                "thinking": {
                    "base_url": "https://thinking.example.com/v1",
                    "api_key": "sk-thinking-key",
                    "model": "glm-5.1",
                    "temperature": 1.0,
                },
                "coding": {
                    "base_url": "https://coding.example.com/v1",
                    "api_key": "sk-coding-key",
                    "model": "glm-4.6",
                    "temperature": 0.7,
                },
                "fast": {
                    "base_url": "https://fast.example.com/v1",
                    "api_key": "sk-fast-key",
                    "model": "glm-4.6",
                    "temperature": 0.3,
                },
            },
        },
    }, default_flow_style=False), encoding="utf-8")

    monkeypatch.setattr(cfg_mod, "CONFIG_FILE", cfg_path)
    cfg_mod.reset_config()
    return cfg_path


def test_role_to_provider_constant() -> None:
    """spec 021: creative -> coding, fast -> fast"""
    from systemedu.core.course_factory_v3.kimi_client import ROLE_TO_PROVIDER
    assert ROLE_TO_PROVIDER == {"creative": "coding", "fast": "fast"}


def test_llm_for_creative_uses_coding_provider(isolated_config) -> None:
    """spec 021: llm_for('creative') -> coding provider (没 fallback 时)"""
    captured: dict = {}

    def fake_get_llm(*, provider=None, **kw):
        captured["provider"] = provider
        return object()

    with patch("systemedu.core.course_factory_v3.kimi_client.get_llm", side_effect=fake_get_llm):
        from systemedu.core.course_factory_v3.kimi_client import llm_for
        llm_for("creative")

    assert captured["provider"] == "coding"


def test_llm_for_fast_uses_fast_provider(isolated_config) -> None:
    """spec 021: llm_for('fast') -> fast provider (没 fallback 时)"""
    captured: dict = {}

    def fake_get_llm(*, provider=None, **kw):
        captured["provider"] = provider
        return object()

    with patch("systemedu.core.course_factory_v3.kimi_client.get_llm", side_effect=fake_get_llm):
        from systemedu.core.course_factory_v3.kimi_client import llm_for
        llm_for("fast")

    assert captured["provider"] == "fast"


def test_llm_for_creative_fallbacks_to_fast(tmp_path, monkeypatch) -> None:
    """spec 021: coding 没配 key -> fallback 到 fast"""
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({
        "llm": {
            "default": "thinking",
            "providers": {
                "thinking": {"base_url": "https://t/v1", "api_key": "k1", "model": "m"},
                "coding":   {"base_url": "https://c/v1", "api_key": "",   "model": "m"},
                "fast":     {"base_url": "https://f/v1", "api_key": "k3", "model": "m"},
            },
        },
    }, default_flow_style=False), encoding="utf-8")
    monkeypatch.setattr(cfg_mod, "CONFIG_FILE", cfg_path)
    cfg_mod.reset_config()

    captured: dict = {}

    def fake_get_llm(*, provider=None, **kw):
        captured["provider"] = provider
        return object()

    with patch("systemedu.core.course_factory_v3.kimi_client.get_llm", side_effect=fake_get_llm):
        from systemedu.core.course_factory_v3.kimi_client import llm_for
        llm_for("creative")

    assert captured["provider"] == "fast"

