"""Multi-provider LLM client supporting any OpenAI-compatible API."""

import httpx
from langchain_openai import ChatOpenAI

from .config import LLMProviderConfig, get_config


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
        raise ValueError(
            f"API key not set for provider '{provider or get_config().llm.default}'. "
            "Set it in ~/.systemedu/config.yaml or via environment variable."
        )

    # Bypass system HTTP proxy to avoid SSL errors with LLM API endpoints
    # proxy=None does NOT disable env vars; trust_env=False is required
    no_proxy_client = httpx.Client(trust_env=False)
    no_proxy_async_client = httpx.AsyncClient(trust_env=False)

    llm_kwargs = {
        "model": model or prov.model,
        "api_key": prov.api_key,
        "base_url": prov.base_url,
        "temperature": temperature if temperature is not None else prov.temperature,
        "streaming": streaming,
        "http_client": no_proxy_client,
        "async_client": no_proxy_async_client,
    }
    if prov.max_tokens:
        llm_kwargs["max_tokens"] = prov.max_tokens

    llm_kwargs.update(kwargs)
    return ChatOpenAI(**llm_kwargs)
