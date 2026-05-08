"""spec 017: config schema 迁移 + LLMNotConfigured 单测。"""

from pathlib import Path

import pytest
import yaml

from systemedu.core.config import _migrate_legacy_config, load_config
from systemedu.core.llm_client import LLMNotConfigured, get_llm


def _write_yaml(path: Path, data: dict) -> None:
    path.write_text(yaml.dump(data, default_flow_style=False, allow_unicode=True), encoding="utf-8")


def _read_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


# ---------------------------------------------------------------------------
# 迁移: kimi → creative
# ---------------------------------------------------------------------------

def test_migrate_renames_kimi_to_creative(tmp_path: Path) -> None:
    cfg_path = tmp_path / "config.yaml"
    _write_yaml(cfg_path, {
        "llm": {
            "default": "kimi",
            "providers": {
                "kimi": {
                    "base_url": "https://example.com/v1",
                    "api_key": "sk-test",
                    "model": "glm-5.1",
                    "temperature": 1.0,
                },
                "qwen": {
                    "base_url": "https://qwen.example.com/v1",
                    "api_key": "sk-qwen",
                    "model": "qwen3.6-plus",
                },
            },
        },
    })

    raw = _read_yaml(cfg_path)
    migrated = _migrate_legacy_config(raw, cfg_path)

    assert "creative" in migrated["llm"]["providers"]
    assert "kimi" not in migrated["llm"]["providers"]
    creative = migrated["llm"]["providers"]["creative"]
    assert creative["api_key"] == "sk-test"
    assert creative["model"] == "glm-5.1"
    assert migrated["llm"]["default"] == "creative"

    # 写回磁盘
    on_disk = _read_yaml(cfg_path)
    assert on_disk["llm"]["default"] == "creative"
    assert "creative" in on_disk["llm"]["providers"]
    assert "kimi" not in on_disk["llm"]["providers"]


# ---------------------------------------------------------------------------
# spec 019 迁移: 删除 qwen provider，把 qwen.api_key 拷到 tts.api_key
# ---------------------------------------------------------------------------

def test_migrate_removes_qwen_and_copies_key_to_tts(tmp_path: Path) -> None:
    cfg_path = tmp_path / "config.yaml"
    _write_yaml(cfg_path, {
        "llm": {
            "default": "creative",
            "providers": {
                "creative": {
                    "base_url": "https://example.com/v1",
                    "api_key": "sk-creative",
                    "model": "glm-5.1",
                },
                "qwen": {
                    "base_url": "https://qwen.example.com/v1",
                    "api_key": "sk-dashscope-key",
                    "model": "qwen3.6-plus",
                },
            },
        },
    })

    migrated = _migrate_legacy_config(_read_yaml(cfg_path), cfg_path)
    assert "qwen" not in migrated["llm"]["providers"]
    # qwen.api_key 自动拷到 tts.api_key（保持 TTS 不需重新填）
    assert migrated["tts"]["api_key"] == "sk-dashscope-key"


def test_migrate_does_not_overwrite_existing_tts_key(tmp_path: Path) -> None:
    cfg_path = tmp_path / "config.yaml"
    _write_yaml(cfg_path, {
        "llm": {
            "default": "creative",
            "providers": {
                "creative": {"base_url": "x", "api_key": "y", "model": "z"},
                "qwen": {"base_url": "a", "api_key": "old-qwen-key", "model": "c"},
            },
        },
        "tts": {"api_key": "existing-tts-key", "model": "qwen3-tts-flash"},
    })
    migrated = _migrate_legacy_config(_read_yaml(cfg_path), cfg_path)
    assert migrated["tts"]["api_key"] == "existing-tts-key"
    assert "qwen" not in migrated["llm"]["providers"]


# ---------------------------------------------------------------------------
# 迁移: default 强制改写
# ---------------------------------------------------------------------------

def test_migrate_forces_default_creative(tmp_path: Path) -> None:
    cfg_path = tmp_path / "config.yaml"
    _write_yaml(cfg_path, {
        "llm": {
            "default": "qwen",
            "providers": {
                "creative": {"base_url": "x", "api_key": "y", "model": "z"},
                "qwen": {"base_url": "a", "api_key": "b", "model": "c"},
            },
        },
    })

    migrated = _migrate_legacy_config(_read_yaml(cfg_path), cfg_path)
    assert migrated["llm"]["default"] == "creative"


# ---------------------------------------------------------------------------
# 幂等：已迁移过的 config 不变化、不再写文件
# ---------------------------------------------------------------------------

def test_migrate_is_idempotent(tmp_path: Path) -> None:
    """spec 019: 已迁移过的 config (无 qwen, default=creative) 重跑不动。"""
    cfg_path = tmp_path / "config.yaml"
    initial = {
        "llm": {
            "default": "creative",
            "providers": {
                "creative": {"base_url": "x", "api_key": "y", "model": "z"},
            },
        },
        "tts": {"api_key": "tts-key", "model": "qwen3-tts-flash", "voice": "Cherry"},
    }
    _write_yaml(cfg_path, initial)
    mtime_before = cfg_path.stat().st_mtime_ns

    _migrate_legacy_config(_read_yaml(cfg_path), cfg_path)
    mtime_after = cfg_path.stat().st_mtime_ns

    assert mtime_after == mtime_before, "幂等迁移不应触发文件重写"

    # backup 也不应存在
    backups = list(tmp_path.glob("config.yaml.bak.*"))
    assert backups == []


# ---------------------------------------------------------------------------
# 备份: 改动时备份原文件
# ---------------------------------------------------------------------------

def test_migrate_creates_backup_when_changed(tmp_path: Path) -> None:
    cfg_path = tmp_path / "config.yaml"
    _write_yaml(cfg_path, {
        "llm": {
            "default": "kimi",
            "providers": {
                "kimi": {"base_url": "x", "api_key": "y", "model": "z"},
            },
        },
    })

    _migrate_legacy_config(_read_yaml(cfg_path), cfg_path)

    backups = list(tmp_path.glob("config.yaml.bak.*"))
    assert len(backups) == 1, f"应有备份文件，实际: {backups}"
    backup_data = yaml.safe_load(backups[0].read_text(encoding="utf-8"))
    assert "kimi" in backup_data["llm"]["providers"]


# ---------------------------------------------------------------------------
# load_config 集成：触发迁移并返回 SystemEduConfig
# ---------------------------------------------------------------------------

def test_load_config_triggers_migration(tmp_path: Path) -> None:
    cfg_path = tmp_path / "config.yaml"
    _write_yaml(cfg_path, {
        "llm": {
            "default": "kimi",
            "providers": {
                "kimi": {
                    "base_url": "https://example.com/v1",
                    "api_key": "sk-creative",
                    "model": "glm-5.1",
                },
                "qwen": {"base_url": "x", "api_key": "y", "model": "qwen3.6-plus"},
            },
        },
    })

    cfg = load_config(cfg_path)
    assert cfg.llm.default == "creative"
    assert "creative" in cfg.llm.providers
    assert "kimi" not in cfg.llm.providers
    assert cfg.llm.providers["creative"].api_key == "sk-creative"


# ---------------------------------------------------------------------------
# LLMNotConfigured: get_llm 在 api_key 为空时抛
# ---------------------------------------------------------------------------

def test_get_llm_raises_when_no_api_key(tmp_path: Path, monkeypatch) -> None:
    cfg_path = tmp_path / "config.yaml"
    _write_yaml(cfg_path, {
        "llm": {
            "default": "creative",
            "providers": {
                "creative": {"base_url": "https://x/v1", "api_key": "", "model": "m"},
                "qwen": {"base_url": "https://y/v1", "api_key": "", "model": "n"},
            },
        },
    })

    # patch get_config 的全局 path
    from systemedu.core import config as cfg_mod
    monkeypatch.setattr(cfg_mod, "CONFIG_FILE", cfg_path)
    cfg_mod.reset_config()

    with pytest.raises(LLMNotConfigured) as exc_info:
        get_llm(provider="creative")
    assert exc_info.value.provider_name == "creative"
