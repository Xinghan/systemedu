"""spec 024-A multi-user system.

Public API:
    init_db()                  # 启动时建表
    api_register / api_login / api_logout / api_me   # auth endpoints
    api_library_*              # library proxy endpoints
    api_purchase_buy / api_purchase_list             # purchases
"""

import logging
import os

from .db import (
    Purchase,
    User,
    create_user,
    get_user_by_id,
    get_user_by_username,
    init_db as _init_db_tables,
)
from .jwt import create_access_token, decode_token
from .passwords import hash_password


logger = logging.getLogger(__name__)


def maybe_bootstrap_admin() -> str | None:
    """通过 env CLOUD_BOOTSTRAP_USER=user:pass 首次部署创建一个用户.

    幂等: 用户名已存在直接 skip。
    """
    spec = os.environ.get("CLOUD_BOOTSTRAP_USER")
    if not spec:
        return None
    if ":" not in spec:
        logger.warning("CLOUD_BOOTSTRAP_USER 格式应为 user:pass, 忽略")
        return None
    username, password = spec.split(":", 1)
    username = username.strip()
    password = password.strip()
    if not username or not password:
        return None
    if get_user_by_username(username):
        return None
    create_user(username, hash_password(password))
    logger.warning("Bootstrapped cloud-app user %r from CLOUD_BOOTSTRAP_USER", username)
    return username


def init_db() -> None:
    """启动时调一次: 建表 + bootstrap admin."""
    _init_db_tables()
    maybe_bootstrap_admin()


__all__ = [
    "User",
    "Purchase",
    "init_db",
    "get_user_by_username",
    "get_user_by_id",
    "create_access_token",
    "decode_token",
    "maybe_bootstrap_admin",
]
