"""Tests for configuration system."""

import os
from pathlib import Path

import pytest
import yaml

from systemedu.core.config import (
    SystemEduConfig,
    TutorConfig,
    _expand_env_vars,
    _expand_env_recursive,
    init_config_dir,
    load_config,
    reset_config,
)


@pytest.fixture(autouse=True)
def clean_config():
    """Reset singleton config between tests."""
    reset_config()
    yield
    reset_config()


class TestEnvVarExpansion:
    def test_expand_simple_var(self, monkeypatch):
        monkeypatch.setenv("TEST_VAR", "hello")
        assert _expand_env_vars("${TEST_VAR}") == "hello"

    def test_expand_missing_var(self):
        assert _expand_env_vars("${NONEXISTENT_VAR_12345}") == ""

    def test_expand_multiple_vars(self, monkeypatch):
        monkeypatch.setenv("A", "1")
        monkeypatch.setenv("B", "2")
        assert _expand_env_vars("${A}-${B}") == "1-2"

    def test_expand_recursive_dict(self, monkeypatch):
        monkeypatch.setenv("KEY", "value")
        data = {"nested": {"key": "${KEY}"}, "list": ["${KEY}", "plain"]}
        result = _expand_env_recursive(data)
        assert result["nested"]["key"] == "value"
        assert result["list"][0] == "value"
        assert result["list"][1] == "plain"

    def test_no_expansion_needed(self):
        assert _expand_env_vars("plain text") == "plain text"


class TestLoadConfig:
    def test_load_default_config(self):
        config = SystemEduConfig()
        assert config.llm.default == "qwen"
        assert config.sandbox.enabled is True
        assert config.memory.enabled is True

    def test_load_from_yaml(self, tmp_path):
        config_data = {
            "llm": {
                "default": "local",
                "providers": {
                    "local": {
                        "base_url": "http://localhost:11434/v1",
                        "model": "llama3",
                    },
                },
            },
            "sandbox": {"enabled": False},
        }
        config_file = tmp_path / "config.yaml"
        config_file.write_text(yaml.dump(config_data))

        config = load_config(config_file)
        assert config.llm.default == "local"
        assert "local" in config.llm.providers
        assert config.llm.providers["local"].model == "llama3"
        assert config.sandbox.enabled is False

    def test_load_nonexistent_returns_default(self, tmp_path):
        config = load_config(tmp_path / "nope.yaml")
        assert config.llm.default == "qwen"

    def test_env_var_expansion_in_yaml(self, tmp_path, monkeypatch):
        monkeypatch.setenv("TEST_API_KEY", "sk-test123")
        config_data = {
            "llm": {
                "default": "test",
                "providers": {
                    "test": {
                        "base_url": "https://api.example.com/v1",
                        "api_key": "${TEST_API_KEY}",
                        "model": "test-model",
                    },
                },
            },
        }
        config_file = tmp_path / "config.yaml"
        config_file.write_text(yaml.dump(config_data))

        config = load_config(config_file)
        assert config.llm.providers["test"].api_key == "sk-test123"


class TestInitConfigDir:
    def test_creates_directory(self, tmp_path, monkeypatch):
        home = tmp_path / ".systemedu"
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", home)
        monkeypatch.setattr("systemedu.core.config.CONFIG_FILE", home / "config.yaml")
        monkeypatch.setattr("systemedu.core.config.LOGS_DIR", home / "logs")

        result = init_config_dir()
        assert result == home
        assert home.exists()
        assert (home / "config.yaml").exists()
        assert (home / "logs").exists()

    def test_does_not_overwrite_existing(self, tmp_path, monkeypatch):
        home = tmp_path / ".systemedu"
        home.mkdir()
        config_file = home / "config.yaml"
        config_file.write_text("custom: true")

        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", home)
        monkeypatch.setattr("systemedu.core.config.CONFIG_FILE", config_file)
        monkeypatch.setattr("systemedu.core.config.LOGS_DIR", home / "logs")

        init_config_dir()
        assert config_file.read_text() == "custom: true"


class TestTutorConfig:
    """spec 014:tutor 记忆系统配置。"""

    def test_defaults(self):
        cfg = TutorConfig()
        assert cfg.checkpoint_backend == "sqlite"
        assert cfg.checkpoint_sqlite_path.endswith("tutor_checkpoints.db")
        assert cfg.postgres_url is None
        assert cfg.mem0_enabled is False
        assert cfg.mem0_provider == "qdrant"
        assert cfg.fact_extraction_interval_seconds == 30
        assert cfg.fact_extraction_fallback_hours == 2
        assert cfg.fact_extraction_batch_size == 5
        assert cfg.fact_extraction_max_retries == 3
        assert cfg.router_llm_model is None
        assert cfg.skill_llm_model is None
        assert cfg.fact_extractor_llm_model is None

    def test_default_skill_search_paths_order(self):
        cfg = TutorConfig()
        assert cfg.skill_search_paths[0] == "projects/{project}/skills/"
        assert cfg.skill_search_paths[1] == "src/systemedu/tutor/skills/"

    def test_root_config_exposes_tutor(self):
        config = SystemEduConfig()
        assert isinstance(config.tutor, TutorConfig)
        assert config.tutor.checkpoint_backend == "sqlite"

    def test_missing_tutor_section_uses_defaults(self, tmp_path):
        config_data = {"llm": {"default": "qwen"}}
        config_file = tmp_path / "config.yaml"
        config_file.write_text(yaml.dump(config_data))

        config = load_config(config_file)
        assert config.tutor.checkpoint_backend == "sqlite"
        assert config.tutor.mem0_enabled is False

    def test_load_tutor_from_yaml(self, tmp_path):
        config_data = {
            "tutor": {
                "checkpoint_backend": "sqlite",
                "checkpoint_sqlite_path": "/tmp/custom_ckpt.db",
                "skill_search_paths": ["/custom/skills/"],
                "mem0_enabled": True,
                "fact_extraction_interval_seconds": 60,
                "fact_extraction_batch_size": 10,
                "router_llm_provider": "qwen",
                "router_llm_model": "qwen-turbo",
                "skill_llm_provider": "qwen",
                "skill_llm_model": "qwen-plus",
            },
        }
        config_file = tmp_path / "config.yaml"
        config_file.write_text(yaml.dump(config_data))

        config = load_config(config_file)
        assert config.tutor.checkpoint_sqlite_path == "/tmp/custom_ckpt.db"
        assert config.tutor.skill_search_paths == ["/custom/skills/"]
        assert config.tutor.mem0_enabled is True
        assert config.tutor.fact_extraction_interval_seconds == 60
        assert config.tutor.fact_extraction_batch_size == 10
        assert config.tutor.router_llm_model == "qwen-turbo"
        assert config.tutor.skill_llm_model == "qwen-plus"

    def test_invalid_checkpoint_backend_rejected(self, tmp_path):
        config_data = {"tutor": {"checkpoint_backend": "dynamodb"}}
        config_file = tmp_path / "config.yaml"
        config_file.write_text(yaml.dump(config_data))

        with pytest.raises(Exception):  # pydantic ValidationError
            load_config(config_file)

    def test_postgres_url_env_var_expansion(self, tmp_path, monkeypatch):
        monkeypatch.setenv("TUTOR_PG_URL", "postgres://user:pass@host:5432/db")
        config_data = {
            "tutor": {
                "checkpoint_backend": "postgres",
                "postgres_url": "${TUTOR_PG_URL}",
            },
        }
        config_file = tmp_path / "config.yaml"
        config_file.write_text(yaml.dump(config_data))

        config = load_config(config_file)
        assert config.tutor.postgres_url == "postgres://user:pass@host:5432/db"
