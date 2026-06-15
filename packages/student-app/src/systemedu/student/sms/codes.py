"""验证码生成/存取/冷却 — 复用 student/cache.py 的 Redis。

- code: 6 位数字, key sms:code:<phone>, TTL 5 分钟, 验证成功即删 (一次性)
- 冷却: sms:cooldown:<phone> 60 秒
频次/IP 限制由阿里云后台配置, 本模块不实现。

注: cache.py 暴露的是单例 client (get_cache()) 而非模块级 get/setex/delete,
所以这里统一走 cache.get_cache() 拿 client 再调方法 (不改 cache.py)。
"""
from __future__ import annotations

import secrets

from .. import cache

CODE_TTL = 300      # 5 分钟
COOLDOWN = 60       # 60 秒发送冷却


def _code_key(phone: str) -> str:
    return f"sms:code:{phone}"


def _cooldown_key(phone: str) -> str:
    return f"sms:cooldown:{phone}"


async def issue_code(phone: str) -> str:
    """生成 6 位码, 存 Redis (TTL 5min), 置 60s 冷却。返回明文码 (供发送)。"""
    code = f"{secrets.randbelow(1_000_000):06d}"
    client = cache.get_cache()
    await client.setex(_code_key(phone), CODE_TTL, code)
    await client.setex(_cooldown_key(phone), COOLDOWN, "1")
    return code


async def verify_code(phone: str, code: str) -> bool:
    """校验码。命中即删 (一次性)。"""
    client = cache.get_cache()
    stored = await client.get(_code_key(phone))
    if stored is None:
        return False
    stored_str = stored.decode() if isinstance(stored, bytes) else str(stored)
    if stored_str != code:
        return False
    await client.delete(_code_key(phone))
    return True


async def in_cooldown(phone: str) -> bool:
    client = cache.get_cache()
    return (await client.get(_cooldown_key(phone))) is not None
