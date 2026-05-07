"""spec 017: v3 pipeline 角色路由解硬编码测试。

确认:
- llm_for("creative") → 用 cfg.llm.providers["creative"]
- llm_for("fast")     → 用 cfg.llm.providers["qwen"]
- 不再依赖 "kimi" 这个 provider 名字
"""

from pathlib import Path
from unittest.mock import patch

import pytest
import yaml

from systemedu.core import config as cfg_mod


@pytest.fixture
def isolated_config(tmp_path: Path, monkeypatch):
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({
        "llm": {
            "default": "creative",
            "providers": {
                "creative": {
                    "base_url": "https://creative.example.com/v1",
                    "api_key": "sk-creative-key",
                    "model": "glm-5.1",
                    "temperature": 1.0,
                },
                "qwen": {
                    "base_url": "https://qwen.example.com/v1",
                    "api_key": "sk-qwen-key",
                    "model": "qwen3.6-plus",
                    "temperature": 0.3,
                },
            },
        },
    }, default_flow_style=False), encoding="utf-8")

    monkeypatch.setattr(cfg_mod, "CONFIG_FILE", cfg_path)
    cfg_mod.reset_config()
    return cfg_path


def test_role_to_provider_constant() -> None:
    """硬编码常量 = {creative: creative, fast: qwen}（不再是 kimi/qwen）"""
    from systemedu.course_factory_v3.kimi_client import ROLE_TO_PROVIDER
    assert ROLE_TO_PROVIDER == {"creative": "creative", "fast": "qwen"}


def test_llm_for_creative_uses_creative_provider(isolated_config) -> None:
    captured: dict = {}

    def fake_get_llm(*, provider=None, **kw):
        captured["provider"] = provider
        return object()

    with patch("systemedu.course_factory_v3.kimi_client.get_llm", side_effect=fake_get_llm):
        from systemedu.course_factory_v3.kimi_client import llm_for
        llm_for("creative")

    assert captured["provider"] == "creative"


def test_llm_for_fast_uses_qwen_provider(isolated_config) -> None:
    captured: dict = {}

    def fake_get_llm(*, provider=None, **kw):
        captured["provider"] = provider
        return object()

    with patch("systemedu.course_factory_v3.kimi_client.get_llm", side_effect=fake_get_llm):
        from systemedu.course_factory_v3.kimi_client import llm_for
        llm_for("fast")

    assert captured["provider"] == "qwen"


def test_factory_assignment_uses_qwen_calls_correct_url(isolated_config, monkeypatch) -> None:
    """course_factory/factory.py:generate_assignment 应该读 qwen provider 的 url，
    不再 fallback 到 default。"""
    captured: dict = {}

    class _FakeResp:
        status_code = 200
        text = '{"choices":[{"message":{"content":"# Test\\n"}}]}'

        def json(self):
            return {"choices": [{"message": {"content": "# Test\n"}}]}

        def raise_for_status(self):
            pass

    def fake_post(url, **kw):
        captured["url"] = url
        captured["headers"] = kw.get("headers", {})
        return _FakeResp()

    import requests as _requests
    monkeypatch.setattr(_requests, "post", fake_post)

    from course_factory.factory import generate_assignment
    generate_assignment(
        knode={"name": "test", "module_role": "regular"},
        milestone={"title": "test"},
        plan_markdown="## test",
    )

    # 应该打到 qwen.example.com，不是 creative.example.com
    assert "qwen.example.com" in captured["url"]
    assert "creative.example.com" not in captured["url"]
    assert captured["headers"]["Authorization"] == "Bearer sk-qwen-key"


def test_factory_assignment_qwen_no_key_raises_llm_not_configured(isolated_config) -> None:
    """qwen 存在但 api_key 为空，应该抛 LLMNotConfigured。"""
    raw = yaml.safe_load(isolated_config.read_text(encoding="utf-8"))
    raw["llm"]["providers"]["qwen"]["api_key"] = ""
    isolated_config.write_text(yaml.dump(raw, default_flow_style=False), encoding="utf-8")
    cfg_mod.reset_config()

    from course_factory.factory import generate_assignment
    from systemedu.core.llm_client import LLMNotConfigured

    with pytest.raises(LLMNotConfigured) as exc_info:
        generate_assignment(
            knode={"name": "test", "module_role": "regular"},
            milestone={"title": "test"},
            plan_markdown="## test",
        )
    assert exc_info.value.provider_name == "qwen"
