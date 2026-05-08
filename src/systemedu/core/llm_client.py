"""Multi-provider LLM client supporting any OpenAI-compatible API."""

import httpx
from langchain_openai import ChatOpenAI

from .config import LLMProviderConfig, get_config


class LLMNotConfigured(Exception):
    """provider 存在但 api_key 未填写。

    Gateway 路由层 catch 后返回 HTTP 412 + error code "LLM_NOT_CONFIGURED"，
    前端识别后引导用户去 /config。
    """

    def __init__(self, provider_name: str):
        self.provider_name = provider_name
        super().__init__(
            f"LLM provider '{provider_name}' has no api_key configured. "
            "请先在设置里配置 LLM。"
        )


class TTSNotConfigured(Exception):
    """spec 019: tts.api_key 未配置（DashScope qwen-tts 需要 key）。

    Gateway 路由层 catch 后返回 HTTP 412 + error code "TTS_NOT_CONFIGURED"，
    前端识别后引导用户去 /config 填写 TTS API Key。
    """

    def __init__(self):
        super().__init__(
            "TTS api_key 未配置。请在设置里填写 DashScope qwen-tts 的 API Key。"
        )


def get_provider_config(provider_name: str | None = None) -> LLMProviderConfig:
    """Get the LLM provider config by name, or the default provider."""
    config = get_config()
    name = provider_name or config.llm.default

    if name not in config.llm.providers:
        available = list(config.llm.providers.keys())
        raise ValueError(
            f"LLM provider '{name}' not configured. Available: {available}"
        )

    return config.llm.providers[name]


def get_llm(
    provider: str | None = None,
    model: str | None = None,
    temperature: float | None = None,
    streaming: bool = True,
    **kwargs,
) -> ChatOpenAI:
    """Create a ChatOpenAI instance for the specified provider.

    Args:
        provider: Provider name from config (e.g. "qwen", "claude", "local").
                  Defaults to config's default provider.
        model: Override the provider's default model.
        temperature: Override temperature. Defaults to provider config.
        streaming: Enable streaming.
        **kwargs: Extra kwargs passed to ChatOpenAI.
    """
    prov = get_provider_config(provider)

    if not prov.api_key:
        raise LLMNotConfigured(provider or get_config().llm.default)

    # Bypass system HTTP proxy to avoid SSL errors with LLM API endpoints
    # proxy=None does NOT disable env vars; trust_env=False is required
    # Use http_client / http_async_client (httpx transports passed to OpenAI SDK),
    # NOT async_client (which must be an openai.AsyncOpenAI.chat.completions object).
    no_proxy_client = httpx.Client(trust_env=False)
    no_proxy_async_client = httpx.AsyncClient(trust_env=False)

    llm_kwargs = {
        "model": model or prov.model,
        "api_key": prov.api_key,
        "base_url": prov.base_url,
        "temperature": temperature if temperature is not None else prov.temperature,
        "streaming": streaming,
        "http_client": no_proxy_client,
        "http_async_client": no_proxy_async_client,
        "request_timeout": 300,  # 5 min — coder generates large HTML
    }
    if prov.max_tokens:
        llm_kwargs["max_tokens"] = prov.max_tokens

    llm_kwargs.update(kwargs)
    return ChatOpenAI(**llm_kwargs)
