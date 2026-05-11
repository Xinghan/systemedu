"""library-app 配置 (spec 023).

从 env var 读, 部署时通过 systemd unit Environment= 注入。
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final


# --- 路径 ---
LIBRARY_HOME: Final[Path] = Path(
    os.environ.get("LIBRARY_HOME", str(Path.home() / ".systemedu-library"))
)
DB_PATH: Final[Path] = LIBRARY_HOME / "db.sqlite"
MEDIA_DIR: Final[Path] = LIBRARY_HOME / "media"
PROJECTS_MEDIA_DIR: Final[Path] = MEDIA_DIR / "projects"

# --- 服务端口 ---
HOST: Final[str] = os.environ.get("LIBRARY_HOST", "127.0.0.1")
PORT: Final[int] = int(os.environ.get("LIBRARY_PORT", "18821"))

# --- 鉴权 (MVP hardcoded; spec 024 后改 JWT-only) ---

# admin JWT 签名密钥 (admin UI 登录用); 启动时必须设
JWT_SECRET: Final[str] = os.environ.get(
    "LIBRARY_JWT_SECRET",
    # 仅 dev 默认值, 生产必须 override
    "dev-only-jwt-secret-change-me-in-production",
)
JWT_ALGORITHM: Final[str] = "HS256"
JWT_EXPIRE_HOURS: Final[int] = int(os.environ.get("LIBRARY_JWT_EXPIRE_HOURS", "24"))

# 公开 API 的 license token (service-to-service shared secret, cloud-app 调用时带);
# spec 024 后改成 cloud-app 颁发的 JWT
LICENSE_TOKEN: Final[str] = os.environ.get(
    "LIBRARY_LICENSE_TOKEN",
    "dev-only-license-token-change-me",
)

# 首次部署时 bootstrap admin (env var 形式: LIBRARY_BOOTSTRAP_ADMIN=user:pass)
BOOTSTRAP_ADMIN: Final[str | None] = os.environ.get("LIBRARY_BOOTSTRAP_ADMIN")

# CORS allowed origins (逗号分隔; 默认含 dev 端口)
# 生产: nginx 同源代理时可留空, 但 dev 时 SPA 在 3001 跨源调 18821 必须开
_default_origins = "http://localhost:3001,http://127.0.0.1:3001"
CORS_ORIGINS: Final[list[str]] = [
    o.strip()
    for o in os.environ.get("LIBRARY_CORS_ORIGINS", _default_origins).split(",")
    if o.strip()
]


def ensure_dirs() -> None:
    """启动时确保目录存在."""
    LIBRARY_HOME.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    PROJECTS_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
