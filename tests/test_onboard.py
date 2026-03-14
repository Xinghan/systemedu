"""Tests for onboarding flow."""

import pytest
import yaml

from systemedu.cli.onboard import PROVIDERS
from systemedu.core.config import load_config, reset_config, save_config


@pytest.fixture(autouse=True)
def clean_config():
    reset_config()
    yield
    reset_config()


class TestProviderPresets:
    def test_all_providers_have_required_fields(self):
        for key, prov in PROVIDERS.items():
            assert "name" in prov
            assert "label" in prov
            assert "base_url" in prov
            assert "model" in prov
            assert "needs_key" in prov

    def test_ollama_no_key_needed(self):
        ollama = PROVIDERS["4"]
        assert ollama["name"] == "ollama"
        assert ollama["needs_key"] is False

    def test_provider_count(self):
        assert len(PROVIDERS) == 5


class TestSaveConfig:
    def test_save_and_load(self, tmp_path):
        config_file = tmp_path / "config.yaml"
        config_dict = {
            "llm": {
                "default": "test",
                "providers": {
                    "test": {
                        "base_url": "http://localhost:1234/v1",
                        "api_key": "sk-test",
                        "model": "test-model",
                    },
                },
            },
        }

        save_config(config_dict, path=config_file)

        assert config_file.exists()
        loaded = load_config(config_file)
        assert loaded.llm.default == "test"
        assert loaded.llm.providers["test"].api_key == "sk-test"
        assert loaded.llm.providers["test"].model == "test-model"

    def test_save_creates_parent_dirs(self, tmp_path):
        config_file = tmp_path / "deep" / "nested" / "config.yaml"
        save_config({"llm": {"default": "x"}}, path=config_file)
        assert config_file.exists()


class TestGatewayConfig:
    def test_default_gateway_config(self):
        from systemedu.core.config import GatewayConfig, SystemEduConfig

        config = SystemEduConfig()
        assert config.gateway.port == 18820
        assert config.gateway.host == "127.0.0.1"

    def test_gateway_in_yaml(self, tmp_path):
        config_file = tmp_path / "config.yaml"
        config_dict = {
            "gateway": {"port": 9999, "host": "0.0.0.0"},
        }
        config_file.write_text(yaml.dump(config_dict))
        config = load_config(config_file)
        assert config.gateway.port == 9999
        assert config.gateway.host == "0.0.0.0"
