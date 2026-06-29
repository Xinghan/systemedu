"""/api/settings/llm — 用户级 LLM 配置 (spec 040)。

GET  /api/settings/llm   当前用户配置 (key 脱敏) + 系统默认 model 名
PUT  /api/settings/llm   保存 (default 或 custom; custom 保存前真发最小请求校验)
"""
from __future__ import annotations

import asyncio
import logging

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..auth.deps import require_login
from ..db import get_user_llm_config, upsert_user_llm_config
from .crypto import (
    LLMConfigCryptoUnavailable,
    crypto_available,
    decrypt_key,
    encrypt_key,
)

logger = logging.getLogger(__name__)


def _system_default_model() -> str:
    """系统默认 provider 的 model 名 (展示用)。"""
    try:
        from systemedu.core.config import get_config

        cfg = get_config()
        prov = cfg.llm.providers.get(cfg.llm.default)
        return prov.model if prov else "qwen3.7-max"
    except Exception:
        return "qwen3.7-max"


async def api_get_llm(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    cfg = get_user_llm_config(user_id)
    default_model = _system_default_model()
    if cfg is None or cfg.mode == "default":
        return JSONResponse({
            "mode": "default",
            "default_model": default_model,
            "custom_crypto_available": crypto_available(),
        })
    return JSONResponse({
        "mode": "custom",
        "base_url": cfg.base_url,
        "model": cfg.model,
        "has_key": bool(cfg.api_key_enc),  # 不返明文
        "default_model": default_model,
        "custom_crypto_available": crypto_available(),
    })


def _classify_llm_error(exc: Exception) -> str:
    """把 LLM 调用异常归类为 spec 040 的错误码。"""
    msg = str(exc).lower()
    status = getattr(exc, "status_code", None) or getattr(
        getattr(exc, "response", None), "status_code", None
    )
    if status in (401, 403) or "auth" in msg or "api key" in msg or "invalid_api_key" in msg:
        return "invalid_key"
    if status == 404 or "model" in msg and ("not found" in msg or "not exist" in msg or "does not" in msg):
        return "model_not_found"
    if "timeout" in msg or "timed out" in msg or "connect" in msg or "resolve" in msg or "getaddrinfo" in msg:
        return "endpoint_unreachable"
    return "invalid_response"


def _validate_custom(base_url: str, api_key: str, model: str) -> tuple[bool, str]:
    """真发一次最小 LLM 请求验证 custom 配置。返回 (ok, error_code)。"""
    from systemedu.core.llm_client import build_custom_llm

    try:
        llm = build_custom_llm(
            base_url=base_url,
            api_key=api_key,
            model=model,
            streaming=False,
            max_retries=0,
            request_timeout=10,
            max_tokens=8,
        )
        resp = llm.invoke("ping")
        text = getattr(resp, "content", None)
        if text is None:
            return False, "invalid_response"
        return True, ""
    except Exception as exc:  # noqa: BLE001 - 分类后返回
        code = _classify_llm_error(exc)
        logger.info("custom llm validate failed: %s -> %s", type(exc).__name__, code)
        return False, code


async def api_put_llm(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid_json"}, status_code=400)

    mode = body.get("mode")
    if mode not in ("default", "custom"):
        return JSONResponse({"error": "invalid_mode"}, status_code=400)

    if mode == "default":
        upsert_user_llm_config(user_id, mode="default")
        return JSONResponse({"ok": True, "mode": "default"})

    # custom
    base_url = (body.get("base_url") or "").strip()
    model = (body.get("model") or "").strip()
    new_key = body.get("api_key")  # 留空/缺省 = 保留原 key
    if not base_url or not model:
        return JSONResponse({"error": "base_url_and_model_required"}, status_code=400)
    # SSRF MVP: 只允许 https (spec 040 已知风险, 不做白名单)
    if not base_url.startswith("https://"):
        return JSONResponse({"error": "base_url_must_be_https"}, status_code=400)

    existing = get_user_llm_config(user_id)
    keep_key = False
    if new_key:
        if not crypto_available():
            return JSONResponse(
                {"error": "crypto_unavailable",
                 "detail": "服务端未配置加密密钥, 暂不支持保存自定义 key"},
                status_code=503,
            )
        plain_key = new_key
    else:
        # 没传新 key: 必须已有 custom key 才能保留
        if not (existing and existing.api_key_enc):
            return JSONResponse({"error": "api_key_required"}, status_code=400)
        try:
            plain_key = decrypt_key(existing.api_key_enc)
        except LLMConfigCryptoUnavailable:
            return JSONResponse({"error": "api_key_required"}, status_code=400)
        keep_key = True

    # 硬阻断校验: 真发一次最小请求 (放线程池避免阻塞事件循环)
    ok, code = await asyncio.to_thread(_validate_custom, base_url, plain_key, model)
    if not ok:
        return JSONResponse({"error": code}, status_code=422)

    api_key_enc = None if keep_key else encrypt_key(plain_key)
    upsert_user_llm_config(
        user_id,
        mode="custom",
        base_url=base_url,
        api_key_enc=api_key_enc,
        model=model,
        keep_existing_key=keep_key,
    )
    logger.info("user %s saved custom llm config model=%s", user_id, model)
    return JSONResponse({"ok": True, "mode": "custom", "model": model})


ROUTES = [
    Route("/api/settings/llm", api_get_llm, methods=["GET"]),
    Route("/api/settings/llm", api_put_llm, methods=["PUT"]),
]
