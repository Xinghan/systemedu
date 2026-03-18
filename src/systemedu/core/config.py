"""Configuration system for SystemEdu.

Loads config from ~/.systemedu/config.yaml with environment variable expansion.
"""

import os
import re
from pathlib import Path

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
    """LLM configuration with multiple providers."""

    default: str = "qwen"
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


class TTSConfig(BaseModel):
    """Text-to-speech configuration (DashScope qwen3-tts)."""

    enabled: bool = True
    model: str = "qwen3-tts-flash"
    voice: str = "Cherry"


class AgentConfig(BaseModel):
    """Agent runtime configuration."""

    backend: str = "auto"  # "auto" | "langgraph" | "deepagents"


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
    tts: TTSConfig = Field(default_factory=TTSConfig)


def _default_config_dict() -> dict:
    """Return the default config as a dict (for writing to YAML)."""
    return {
        "llm": {
            "default": "qwen",
            "providers": {
                "qwen": {
                    "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                    "api_key": "${DASHSCOPE_API_KEY}",
                    "model": "qwen-plus",
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


def load_config(path: Path | None = None) -> SystemEduConfig:
    """Load and parse the config file, expanding environment variables."""
    config_path = path or CONFIG_FILE

    if not config_path.exists():
        return SystemEduConfig()

    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
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
