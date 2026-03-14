"""Tests for multi-provider LLM client."""

from unittest.mock import MagicMock, patch

import pytest

from systemedu.core.config import LLMConfig, LLMProviderConfig, SystemEduConfig, reset_config
from systemedu.core.llm_client import get_llm, get_provider_config


@pytest.fixture(autouse=True)
def clean_config():
    reset_config()
    yield
    reset_config()


@pytest.fixture
def mock_config():
    """Create a mock config with multiple providers."""
    config = SystemEduConfig(
        llm=LLMConfig(
            default="qwen",
            providers={
                "qwen": LLMProviderConfig(
                    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                    api_key="sk-test-qwen",
                    model="qwen-plus",
                ),
                "local": LLMProviderConfig(
                    base_url="http://localhost:11434/v1",
                    api_key="not-needed",
                    model="llama3",
                ),
            },
        )
    )
    with patch("systemedu.core.llm_client.get_config", return_value=config):
        yield config


class TestGetProviderConfig:
    def test_get_default_provider(self, mock_config):
        prov = get_provider_config()
        assert prov.model == "qwen-plus"
        assert prov.api_key == "sk-test-qwen"

    def test_get_named_provider(self, mock_config):
        prov = get_provider_config("local")
        assert prov.model == "llama3"
        assert prov.base_url == "http://localhost:11434/v1"

    def test_get_nonexistent_provider(self, mock_config):
        with pytest.raises(ValueError, match="not configured"):
            get_provider_config("nonexistent")


class TestGetLLM:
    def test_creates_chat_openai_instance(self, mock_config):
        llm = get_llm()
        assert llm.model_name == "qwen-plus"

    def test_override_model(self, mock_config):
        llm = get_llm(model="qwen-turbo")
        assert llm.model_name == "qwen-turbo"

    def test_override_temperature(self, mock_config):
        llm = get_llm(temperature=0.3)
        assert llm.temperature == 0.3

    def test_missing_api_key_raises(self):
        config = SystemEduConfig(
            llm=LLMConfig(
                default="empty",
                providers={
                    "empty": LLMProviderConfig(
                        base_url="https://example.com",
                        api_key="",
                        model="test",
                    ),
                },
            )
        )
        with patch("systemedu.core.llm_client.get_config", return_value=config):
            with pytest.raises(ValueError, match="API key not set"):
                get_llm()

    def test_specific_provider(self, mock_config):
        llm = get_llm(provider="local")
        assert llm.model_name == "llama3"
