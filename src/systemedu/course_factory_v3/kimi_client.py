"""统一 LLM 客户端 + 角色路由。

按 SKILL 步骤的"创意复杂度"分两档:
- creative: kimi-k2.6 (慢但深思考,长 HTML 输出 / 创意发散)
- fast    : qwen3-max (快,确定性高,JSON 抽取/评判/科普文本)

路由表 (与 plan.md §模型路由对齐):
| Step / Role           | Provider         |
|-----------------------|------------------|
| s05 抽 query          | qwen (fast)      |
| s10 plan_markdown     | qwen (fast)      |
| s15 theory pick / body| qwen (fast)      |
| s20 ideation 8debate  | qwen (fast)      |
| s25 divergence        | kimi (creative)  |
| s26 creativity 4q     | qwen (fast)      |
| s30 detail_plan       | qwen (fast)      |
| s40 debate decide     | qwen (fast)      |
| s50 implement_anim    | kimi (creative)  |
| s50 implement_game    | kimi (creative)  |
| s50 implement_diagram | qwen (fast)      |
| 5.5c science          | qwen (fast)      |
| 5.5d theory_grader    | qwen (fast)      |
| 5.5e game_aesthetic   | qwen (fast)      |
| 5.5f text_overlap     | qwen (fast)      |
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from langchain_openai import ChatOpenAI

from systemedu.core.config import SYSTEMEDU_HOME
from systemedu.core.llm_client import get_llm

logger = logging.getLogger(__name__)

FAILURE_DUMP_DIR = SYSTEMEDU_HOME / "logs" / "kimi_failures"
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0

Role = Literal["creative", "fast"]

# 角色 → provider 映射 (config 中必须配好对应 provider)
ROLE_TO_PROVIDER: dict[str, str] = {
    "creative": "kimi",
    "fast": "qwen",
}


def llm_for(role: Role = "fast", *, streaming: bool = False, max_tokens: int | None = None) -> ChatOpenAI:
    """按角色获取 LLM 实例。

    用法:
        llm_for("creative")   # kimi-k2.6, 用于复杂创意/HTML 实现
        llm_for("fast")       # qwen3-max, 用于评判/JSON 抽取/科普文本
    """
    provider = ROLE_TO_PROVIDER.get(role, "qwen")
    return get_llm(provider=provider, streaming=streaming, max_tokens=max_tokens)


def kimi(*, streaming: bool = False, max_tokens: int | None = None) -> ChatOpenAI:
    """向后兼容: 等价于 llm_for("creative")。新代码请用 llm_for。"""
    return llm_for("creative", streaming=streaming, max_tokens=max_tokens)


def _dump_failure(messages: list, error: Exception, attempt: int, label: str = "") -> Path:
    FAILURE_DUMP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    path = FAILURE_DUMP_DIR / f"{ts}_{label}_attempt{attempt}.json"
    try:
        path.write_text(json.dumps({
            "timestamp": ts,
            "label": label,
            "attempt": attempt,
            "error": repr(error),
            "messages": [_serialize_msg(m) for m in messages],
        }, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as dump_err:
        logger.warning(f"Failed to dump LLM failure: {dump_err}")
    return path


def _serialize_msg(m: Any) -> dict:
    if isinstance(m, dict):
        return m
    return {"role": getattr(m, "type", "?"), "content": getattr(m, "content", str(m))}


def _is_retryable(exc: Exception) -> bool:
    s = str(exc).lower()
    return any(kw in s for kw in [
        "429", "rate limit", "rate_limit",
        "500", "502", "503", "504",
        "timeout", "connection", "remote disconnected",
    ])


_PROXY_ENV_KEYS = (
    "http_proxy", "https_proxy",
    "HTTP_PROXY", "HTTPS_PROXY",
    "all_proxy", "ALL_PROXY",
)


def _patched_thread_invoke(llm, messages):
    """在子线程内**临时**清掉 proxy env, 让 OpenAI SDK 不被本机 proxy 拦截。

    虽然 core.llm_client 已用 httpx.Client(trust_env=False), 但 OpenAI SDK
    在某些路径仍会读 env, 这里强行覆盖兜底。
    注意 os.environ 是进程级共享的, 这里 push/pop 保护避免污染其它代码。
    """
    import os
    saved = {k: os.environ.get(k) for k in _PROXY_ENV_KEYS}
    for k in _PROXY_ENV_KEYS:
        os.environ.pop(k, None)
    try:
        return llm.invoke(messages)
    finally:
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v


async def ainvoke(
    llm: ChatOpenAI,
    messages: list,
    *,
    max_retries: int = MAX_RETRIES,
    label: str = "llm",
) -> str:
    last_exc: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = await asyncio.to_thread(_patched_thread_invoke, llm, messages)
            content = resp.content if hasattr(resp, "content") else str(resp)
            return content
        except Exception as exc:
            last_exc = exc
            if attempt >= max_retries or not _is_retryable(exc):
                dump_path = _dump_failure(messages, exc, attempt, label=label)
                logger.exception(
                    f"[{label}] LLM call failed (attempt {attempt}/{max_retries}), "
                    f"dumped to {dump_path}"
                )
                raise
            wait = RETRY_BACKOFF_BASE ** (attempt - 1)
            logger.warning(
                f"[{label}] LLM attempt {attempt} failed: {exc}; retrying in {wait}s"
            )
            await asyncio.sleep(wait)
    raise last_exc  # type: ignore[misc]


def invoke(
    llm: ChatOpenAI,
    messages: list,
    *,
    max_retries: int = MAX_RETRIES,
    label: str = "llm",
) -> str:
    """同步版本。"""
    last_exc: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = _patched_thread_invoke(llm, messages)
            return resp.content if hasattr(resp, "content") else str(resp)
        except Exception as exc:
            last_exc = exc
            if attempt >= max_retries or not _is_retryable(exc):
                dump_path = _dump_failure(messages, exc, attempt, label=label)
                logger.exception(
                    f"[{label}] LLM call failed (attempt {attempt}/{max_retries}), "
                    f"dumped to {dump_path}"
                )
                raise
            wait = RETRY_BACKOFF_BASE ** (attempt - 1)
            logger.warning(
                f"[{label}] LLM attempt {attempt} failed: {exc}; retrying in {wait}s"
            )
            time.sleep(wait)
    raise last_exc  # type: ignore[misc]
