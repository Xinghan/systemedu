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


# spec 021: 角色 → provider 映射 + fallback 链
# 用户可只填 thinking 一个, coding/fast 自动 fallback
_ROLE_FALLBACK_CHAINS: dict[str, tuple[str, ...]] = {
    "thinking": ("thinking",),                       # 必须配, 没配 → 412
    "coding":   ("coding", "fast", "thinking"),      # 找不到就退 fast/thinking
    "fast":     ("fast", "coding", "thinking"),      # 找不到就退 coding/thinking
}


def resolve_role_provider(role: str) -> str:
    """spec 021: 把 role 名解析成实际 provider 名 (按 fallback 链).

    Args:
        role: "thinking" / "coding" / "fast" (旧名 "creative" 也接受, 等价 coding)

    Returns:
        实际可用的 provider 名 (cfg.llm.providers 里存在且 api_key 非空)。
        没有任何一个可用时返回链头 (调用方 get_llm 会抛 LLMNotConfigured)。
    """
    # 兼容 spec 019 旧 role 名
    if role == "creative":
        role = "coding"

    chain = _ROLE_FALLBACK_CHAINS.get(role, (role,))
    cfg = get_config()
    for name in chain:
        prov = cfg.llm.providers.get(name)
        if prov and cfg.llm.effective_api_key(name):
            return name
    # 全都没配 → 返回链头, get_llm 会抛 LLMNotConfigured
    return chain[0]


def get_llm(
    provider: str | None = None,
    model: str | None = None,
    temperature: float | None = None,
    streaming: bool = True,
    max_retries: int | None = None,
    **kwargs,
) -> ChatOpenAI:
    """Create a ChatOpenAI instance for the specified provider.

    Args:
        provider: Provider name from config (e.g. "qwen", "claude", "local").
                  Defaults to config's default provider.
        model: Override the provider's default model.
        temperature: Override temperature. Defaults to provider config.
        streaming: Enable streaming.
        max_retries: spec 020: 控制 OpenAI SDK 自动重试次数. 默认不传 (用
            SDK 默认 2 次). 调用方想避免双倍累计超时时显式传 max_retries=0,
            把"失败重试"留给上层业务逻辑控制 (例如 tree_generator 已有
            max_retries=3 包装).
        **kwargs: Extra kwargs passed to ChatOpenAI.
    """
    cfg = get_config()
    provider_name = provider or cfg.llm.default
    prov = get_provider_config(provider_name)

    api_key = cfg.llm.effective_api_key(provider_name)
    base_url = cfg.llm.effective_base_url(provider_name)
    if not api_key:
        raise LLMNotConfigured(provider_name)
    if not base_url:
        raise LLMNotConfigured(provider_name)

    # Bypass system HTTP proxy to avoid SSL errors with LLM API endpoints
    # proxy=None does NOT disable env vars; trust_env=False is required
    # Use http_client / http_async_client (httpx transports passed to OpenAI SDK),
    # NOT async_client (which must be an openai.AsyncOpenAI.chat.completions object).
    no_proxy_client = httpx.Client(trust_env=False)
    no_proxy_async_client = httpx.AsyncClient(trust_env=False)

    llm_kwargs = {
        "model": model or prov.model,
        "api_key": api_key,
        "base_url": base_url,
        "temperature": temperature if temperature is not None else prov.temperature,
        "streaming": streaming,
        "http_client": no_proxy_client,
        "http_async_client": no_proxy_async_client,
        "request_timeout": 300,  # 5 min — coder generates large HTML
    }
    if prov.max_tokens:
        llm_kwargs["max_tokens"] = prov.max_tokens
    if max_retries is not None:
        llm_kwargs["max_retries"] = max_retries

    llm_kwargs.update(kwargs)
    return ChatOpenAI(**llm_kwargs)


def build_custom_llm(
    base_url: str,
    api_key: str,
    model: str,
    *,
    streaming: bool = True,
    temperature: float = 1.0,
    max_retries: int | None = None,
    request_timeout: int = 60,
    **kwargs,
) -> ChatOpenAI:
    """spec 040: 用用户自填的 base_url + api_key + model 构造 ChatOpenAI。

    不依赖 config (绕开 provider 体系), 复用 get_llm 的 no-proxy httpx client。
    供 settings 保存校验 + tutor custom 模式共用, 保证 custom LLM 构造逻辑单一。
    """
    no_proxy_client = httpx.Client(trust_env=False)
    no_proxy_async_client = httpx.AsyncClient(trust_env=False)
    llm_kwargs = {
        "model": model,
        "api_key": api_key,
        "base_url": base_url,
        "temperature": temperature,
        "streaming": streaming,
        "http_client": no_proxy_client,
        "http_async_client": no_proxy_async_client,
        "request_timeout": request_timeout,
    }
    if max_retries is not None:
        llm_kwargs["max_retries"] = max_retries
    llm_kwargs.update(kwargs)
    return ChatOpenAI(**llm_kwargs)
