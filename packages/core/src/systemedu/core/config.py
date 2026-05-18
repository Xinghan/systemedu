"""Configuration system for SystemEdu.

Loads config from ~/.systemedu/config.yaml with environment variable expansion.
"""

import os
import re
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field

# Default paths
SYSTEMEDU_HOME = Path(os.environ.get("SYSTEMEDU_HOME", Path.home() / ".systemedu"))
CONFIG_FILE = SYSTEMEDU_HOME / "config.yaml"
DB_FILE = SYSTEMEDU_HOME / "systemedu.db"
LOGS_DIR = SYSTEMEDU_HOME / "logs"

_ENV_VAR_PATTERN = re.compile(r"\$\{(\w+)\}")


def _expand_env_vars(value: str) -> str:
    """Expand ${VAR_NAME} references in a string."""

    def _replace(match: re.Match) -> str:
        var_name = match.group(1)
        return os.environ.get(var_name, "")

    return _ENV_VAR_PATTERN.sub(_replace, value)


def _expand_env_recursive(obj):
    """Recursively expand environment variables in a dict/list structure."""
    if isinstance(obj, str):
        return _expand_env_vars(obj)
    if isinstance(obj, dict):
        return {k: _expand_env_recursive(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_expand_env_recursive(item) for item in obj]
    return obj


class LLMProviderConfig(BaseModel):
    """Configuration for a single LLM provider."""

    base_url: str
    api_key: str = ""
    model: str
    temperature: float = 0.7
    max_tokens: int | None = None


class LLMConfig(BaseModel):
    """LLM configuration with multiple providers.

    spec 021: default = "thinking"。用户在 web /config 配 3 张 LLM 卡片
    (Thinking / Coding / Fast) + 1 张 TTS 卡片。代码层按角色路由到
    对应 provider, 没配 key 时按 fallback 链向后退档。
    """

    default: str = "thinking"
    providers: dict[str, LLMProviderConfig] = Field(default_factory=dict)


class SandboxConfig(BaseModel):
    """Sandbox configuration for tool execution."""

    enabled: bool = True
    allowed_dirs: list[str] = Field(default_factory=lambda: [str(Path.home() / "projects")])
    blocked_commands: list[str] = Field(default_factory=lambda: ["rm -rf /", "format"])
    network: bool = True
    max_execution_time: int = 300


class MCPServerConfig(BaseModel):
    """Configuration for a single MCP server."""

    command: str
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)


class MCPConfig(BaseModel):
    """MCP servers configuration."""

    servers: dict[str, MCPServerConfig] = Field(default_factory=dict)


class ChannelConfig(BaseModel):
    """Configuration for a single channel."""

    enabled: bool = True
    port: int | None = None
    extra: dict = Field(default_factory=dict)


class ChannelsConfig(BaseModel):
    """All channels configuration."""

    cli: ChannelConfig = Field(default_factory=lambda: ChannelConfig(enabled=True))
    web: ChannelConfig = Field(default_factory=lambda: ChannelConfig(enabled=False))


class GatewayConfig(BaseModel):
    """Gateway (local HTTP server) configuration."""

    port: int = 18820
    host: str = "127.0.0.1"


class HubConfig(BaseModel):
    """Hub server configuration."""

    url: str = "https://hub.systemedu.com"
    token: str = ""


class MemoryConfig(BaseModel):
    """Memory system configuration."""

    enabled: bool = True
    backend: str = "mem0"
    # spec 031: Qdrant server (docker), 替代老的 embedded file path
    qdrant_url: str = ""  # e.g. http://127.0.0.1:6335; 空时 fallback embedded file
    qdrant_collection: str = "student_memories"
    # spec 031: 默认用 qwen-plus 做 embed (跟项目主 LLM 同 provider)
    embed_provider: str = ""  # 空时 fallback default llm provider
    embed_model: str = "text-embedding-v3"
    embed_dims: int = 1024


class TTSConfig(BaseModel):
    """Text-to-speech configuration (DashScope qwen-tts).

    spec 019: api_key 独立，不再从 llm.providers.qwen 借。
    用户必须在 web /config 单独填，或设 DASHSCOPE_API_KEY env var。
    """

    enabled: bool = True
    api_key: str = ""
    model: str = "qwen3-tts-flash"
    voice: str = "Cherry"


class AgentConfig(BaseModel):
    """Agent runtime configuration."""

    backend: str = "langgraph"  # legacy field, always langgraph now


class TutorConfig(BaseModel):
    """Tutor 记忆与教学策略系统配置(spec 014)。

    checkpoint_backend 控制 LangGraph checkpoint 存储后端:
    - sqlite:本地开发/单机生产,WAL 模式共享 aiosqlite 连接池
    - postgres:spec 016 扩容时启用(当前骨架为 NotImplementedError)
    """

    checkpoint_backend: Literal["sqlite", "postgres"] = "sqlite"
    checkpoint_sqlite_path: str = str(SYSTEMEDU_HOME / "tutor_checkpoints.db")
    postgres_url: str | None = None

    skill_search_paths: list[str] = Field(
        default_factory=lambda: [
            "projects/{project}/skills/",
            "src/systemedu/tutor/skills/",
        ]
    )

    mem0_enabled: bool = False
    mem0_provider: str = "qdrant"

    fact_extraction_interval_seconds: int = 30
    fact_extraction_fallback_hours: int = 2
    fact_extraction_batch_size: int = 5
    fact_extraction_max_retries: int = 3

    router_llm_provider: str | None = None
    router_llm_model: str | None = None
    skill_llm_provider: str | None = None
    skill_llm_model: str | None = None
    fact_extractor_llm_provider: str | None = None
    fact_extractor_llm_model: str | None = None


class SearchConfig(BaseModel):
    """Search configuration (Tavily)."""

    enabled: bool = True
    tavily_api_key: str = ""
    max_results_per_source: int = 10


class SystemEduConfig(BaseModel):
    """Root configuration model."""

    llm: LLMConfig = Field(default_factory=LLMConfig)
    sandbox: SandboxConfig = Field(default_factory=SandboxConfig)
    mcp: MCPConfig = Field(default_factory=MCPConfig)
    channels: ChannelsConfig = Field(default_factory=ChannelsConfig)
    gateway: GatewayConfig = Field(default_factory=GatewayConfig)
    hub: HubConfig = Field(default_factory=HubConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    agent: AgentConfig = Field(default_factory=AgentConfig)
    tutor: TutorConfig = Field(default_factory=TutorConfig)
    tts: TTSConfig = Field(default_factory=TTSConfig)
    search: SearchConfig = Field(default_factory=SearchConfig)


def _default_config_dict() -> dict:
    """Return the default config as a dict (for writing to YAML)."""
    return {
        "llm": {
            # spec 021: 3 角色 provider (Thinking / Coding / Fast)
            "default": "thinking",
            "providers": {
                "thinking": {
                    # 知识树规划 / 长程 reasoning, GLM-5.1 (默认 thinking 模式)
                    "base_url": "https://open.bigmodel.cn/api/paas/v4",
                    "api_key": "${ZHIPU_API_KEY}",
                    "model": "glm-5.1",
                    "temperature": 1.0,
                    "max_tokens": 65536,
                },
                "coding": {
                    # anim / game / HTML 静态图, GLM-4.6 非 thinking 速度快 2-3 倍
                    "base_url": "https://open.bigmodel.cn/api/paas/v4",
                    "api_key": "${ZHIPU_API_KEY}",
                    "model": "glm-4.6",
                    "temperature": 0.7,
                    "max_tokens": 65536,
                },
                "fast": {
                    # idea / 评判 / audio_script / assignment / JSON 抽取
                    "base_url": "https://open.bigmodel.cn/api/paas/v4",
                    "api_key": "${ZHIPU_API_KEY}",
                    "model": "glm-4.6",
                    "temperature": 0.3,
                    "max_tokens": 8192,
                },
            },
        },
        "sandbox": {
            "enabled": True,
            "allowed_dirs": [str(Path.home() / "projects")],
            "blocked_commands": ["rm -rf /", "format"],
            "network": True,
            "max_execution_time": 300,
        },
        "mcp": {"servers": {}},
        "channels": {
            "cli": {"enabled": True},
            "web": {"enabled": False},
        },
        "gateway": {"port": 18820, "host": "127.0.0.1"},
        "hub": {"url": "https://hub.systemedu.com"},
        "memory": {"enabled": True, "backend": "mem0"},
        "agent": {"backend": "auto"},
        "tts": {
            # spec 019: TTS api_key 独立字段, 用户在 web /config 单独填 DashScope key
            "enabled": True,
            "api_key": "${DASHSCOPE_API_KEY}",
            "model": "qwen3-tts-flash",
            "voice": "Cherry",
        },
        "tutor": {
            "checkpoint_backend": "sqlite",
            "checkpoint_sqlite_path": str(SYSTEMEDU_HOME / "tutor_checkpoints.db"),
            "skill_search_paths": [
                "projects/{project}/skills/",
                "src/systemedu/tutor/skills/",
            ],
            "mem0_enabled": False,
            "fact_extraction_interval_seconds": 30,
            "fact_extraction_fallback_hours": 2,
        },
    }


def init_config_dir() -> Path:
    """Initialize ~/.systemedu/ directory with default config if not present."""
    SYSTEMEDU_HOME.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    if not CONFIG_FILE.exists():
        CONFIG_FILE.write_text(
            yaml.dump(_default_config_dict(), default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )

    return SYSTEMEDU_HOME


def save_config(config_dict: dict, path: Path | None = None) -> None:
    """Save a config dict to the config file."""
    config_path = path or CONFIG_FILE
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(
        yaml.dump(config_dict, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )
    reset_config()


def _migrate_legacy_config(raw: dict, config_path: Path) -> dict:
    """spec 017+019+021 迁移：

    spec 017: kimi → creative (改名)
    spec 019: 删除 qwen provider, 把 qwen.api_key 拷到 tts.api_key
    spec 021: 拆分 creative → thinking (规划) + coding (anim/game) + fast (评判)
              creative 改名为 thinking (保留 GLM-5.1 那套);
              coding / fast 写空占位让 UI 有入口。
              llm.default 强制 = "thinking"

    幂等：若已迁移过则不动文件。改动时备份到 config.yaml.bak.<ts>
    """
    import time

    llm = raw.setdefault("llm", {})
    providers = llm.setdefault("providers", {})
    tts = raw.setdefault("tts", {})

    changed = False

    # 1. spec 017: kimi → creative 改名 (历史路径)
    if "kimi" in providers and "creative" not in providers and "thinking" not in providers:
        providers["creative"] = providers.pop("kimi")
        changed = True

    # 2. spec 021: creative → thinking 改名
    if "creative" in providers and "thinking" not in providers:
        providers["thinking"] = providers.pop("creative")
        changed = True

    # 3. spec 021: thinking 不存在则写占位 (GLM-5.1)
    if "thinking" not in providers:
        providers["thinking"] = {
            "base_url": "https://open.bigmodel.cn/api/paas/v4",
            "api_key": "",
            "model": "glm-5.1",
            "temperature": 1.0,
            "max_tokens": 65536,
        }
        changed = True

    # 4. spec 021: coding 占位 (GLM-4.6, 非 thinking, 速度快)
    if "coding" not in providers:
        providers["coding"] = {
            "base_url": "https://open.bigmodel.cn/api/paas/v4",
            "api_key": "",
            "model": "glm-4.6",
            "temperature": 0.7,
            "max_tokens": 65536,
        }
        changed = True

    # 5. spec 021: fast 占位 (GLM-4.6, 评判 / 文本任务)
    if "fast" not in providers:
        providers["fast"] = {
            "base_url": "https://open.bigmodel.cn/api/paas/v4",
            "api_key": "",
            "model": "glm-4.6",
            "temperature": 0.3,
            "max_tokens": 8192,
        }
        changed = True

    # 6. spec 019: 删除 qwen provider (qwen.api_key 迁 tts.api_key)
    if "qwen" in providers:
        qwen_key = providers["qwen"].get("api_key", "") or ""
        if qwen_key and not tts.get("api_key"):
            tts["api_key"] = qwen_key
        del providers["qwen"]
        changed = True

    # 7. spec 021: default 强制 = thinking
    if llm.get("default") != "thinking":
        llm["default"] = "thinking"
        changed = True

    if changed and config_path.exists():
        # 备份再写回
        ts = int(time.time())
        backup = config_path.with_suffix(f".yaml.bak.{ts}")
        backup.write_bytes(config_path.read_bytes())
        config_path.write_text(
            yaml.dump(raw, default_flow_style=False, allow_unicode=True),
            encoding="utf-8",
        )

    return raw


def load_config(path: Path | None = None) -> SystemEduConfig:
    """Load and parse the config file, expanding environment variables."""
    config_path = path or CONFIG_FILE

    if not config_path.exists():
        return SystemEduConfig()

    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    raw = _migrate_legacy_config(raw, config_path)
    expanded = _expand_env_recursive(raw)

    return SystemEduConfig.model_validate(expanded)


# Lazy singleton
_config: SystemEduConfig | None = None


def get_config(path: Path | None = None) -> SystemEduConfig:
    """Get or load the singleton config."""
    global _config
    if _config is None:
        _config = load_config(path)
    return _config


def reset_config() -> None:
    """Reset the singleton config (useful for testing)."""
    global _config
    _config = None
