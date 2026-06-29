"""用户自填 LLM api_key 的对称加密 (spec 040)。

Fernet 密钥来自 env STUDENT_LLM_CONFIG_KEY (32 字节 urlsafe base64)。
缺失时加解密抛 LLMConfigCryptoUnavailable, 上层据此禁用自定义 key 功能。
"""
from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken

_ENV_KEY = "STUDENT_LLM_CONFIG_KEY"


class LLMConfigCryptoUnavailable(Exception):
    """STUDENT_LLM_CONFIG_KEY 未配置或无效。"""


def _fernet() -> Fernet:
    key = os.environ.get(_ENV_KEY, "")
    if not key:
        raise LLMConfigCryptoUnavailable(
            f"{_ENV_KEY} 未配置, 无法加解密用户自填 LLM api_key"
        )
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as exc:  # 密钥格式错
        raise LLMConfigCryptoUnavailable(f"{_ENV_KEY} 格式无效: {exc}") from exc


def crypto_available() -> bool:
    """密钥是否就绪 (前端据此决定是否允许自定义 key)。"""
    try:
        _fernet()
        return True
    except LLMConfigCryptoUnavailable:
        return False


def encrypt_key(plain: str) -> str:
    """加密明文 key -> 密文字符串 (存库)。"""
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_key(token: str) -> str:
    """解密密文 -> 明文 key。密文损坏抛 LLMConfigCryptoUnavailable。"""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise LLMConfigCryptoUnavailable("api_key 密文无法解密 (密钥变更?)") from exc


def generate_key() -> str:
    """生成一个新的 Fernet 密钥 (部署脚本用)。"""
    return Fernet.generate_key().decode()
