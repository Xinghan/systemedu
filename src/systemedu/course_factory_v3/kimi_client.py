"""统一 Kimi LLM 客户端。

封装 core.llm_client.get_llm("kimi") 并加上:
- 429 / 5xx 指数退避(最多 3 次)
- 失败转储到 ~/.systemedu/logs/kimi_failures/<timestamp>.json,便于调试

注意 kimi-k2.6 强制 temperature=1,本模块不允许调温度。
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from langchain_openai import ChatOpenAI

from systemedu.core.config import SYSTEMEDU_HOME
from systemedu.core.llm_client import get_llm

logger = logging.getLogger(__name__)

FAILURE_DUMP_DIR = SYSTEMEDU_HOME / "logs" / "kimi_failures"
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0  # 1s, 2s, 4s


def kimi(*, streaming: bool = False, max_tokens: int | None = None) -> ChatOpenAI:
    """获取 Kimi ChatOpenAI 实例。

    v3 所有 LLM 调用必须通过此函数,不要直接调 get_llm。
    这样后续要加监控 / 限流 / 模型路由时只改一处。
    """
    return get_llm(provider="kimi", streaming=streaming, max_tokens=max_tokens)


def _dump_failure(messages: list, error: Exception, attempt: int) -> Path:
    """把失败的 prompt+异常 转储到磁盘,返回文件路径。"""
    FAILURE_DUMP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    path = FAILURE_DUMP_DIR / f"{ts}_attempt{attempt}.json"
    try:
        path.write_text(json.dumps({
            "timestamp": ts,
            "attempt": attempt,
            "error": repr(error),
            "messages": [_serialize_msg(m) for m in messages],
        }, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as dump_err:
        logger.warning(f"Failed to dump kimi failure: {dump_err}")
    return path


def _serialize_msg(m: Any) -> dict:
    """把 LangChain message 或 dict 转成可 JSON 化的 dict。"""
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


async def ainvoke(
    llm: ChatOpenAI,
    messages: list,
    *,
    max_retries: int = MAX_RETRIES,
    label: str = "kimi",
) -> str:
    """异步调用,带重试 + 失败转储。返回纯文本 content。"""
    last_exc: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = await asyncio.to_thread(llm.invoke, messages)
            content = resp.content if hasattr(resp, "content") else str(resp)
            return content
        except Exception as exc:
            last_exc = exc
            if attempt >= max_retries or not _is_retryable(exc):
                dump_path = _dump_failure(messages, exc, attempt)
                logger.exception(
                    f"[{label}] kimi call failed (attempt {attempt}/{max_retries}), "
                    f"dumped to {dump_path}"
                )
                raise
            wait = RETRY_BACKOFF_BASE ** (attempt - 1)
            logger.warning(
                f"[{label}] kimi call attempt {attempt} failed: {exc}; "
                f"retrying in {wait}s"
            )
            await asyncio.sleep(wait)
    # unreachable
    raise last_exc  # type: ignore[misc]


def invoke(
    llm: ChatOpenAI,
    messages: list,
    *,
    max_retries: int = MAX_RETRIES,
    label: str = "kimi",
) -> str:
    """同步版本,内部跑事件循环兼容性差,优先用 ainvoke。"""
    last_exc: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = llm.invoke(messages)
            return resp.content if hasattr(resp, "content") else str(resp)
        except Exception as exc:
            last_exc = exc
            if attempt >= max_retries or not _is_retryable(exc):
                dump_path = _dump_failure(messages, exc, attempt)
                logger.exception(
                    f"[{label}] kimi call failed (attempt {attempt}/{max_retries}), "
                    f"dumped to {dump_path}"
                )
                raise
            wait = RETRY_BACKOFF_BASE ** (attempt - 1)
            logger.warning(
                f"[{label}] kimi call attempt {attempt} failed: {exc}; "
                f"retrying in {wait}s"
            )
            time.sleep(wait)
    raise last_exc  # type: ignore[misc]
