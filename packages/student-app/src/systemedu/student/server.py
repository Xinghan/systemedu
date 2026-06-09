"""spec 027 P1.5 — student-app Starlette server.

启动:
    python -m systemedu.student.server     # 0.0.0.0:18820

环境变量:
    STUDENT_DB_PATH       默认 ~/.systemedu/student.db
    STUDENT_JWT_SECRET    JWT 签名密钥 (生产请覆盖)
    LIBRARY_BASE_URL      默认 http://127.0.0.1:18821
    LIBRARY_LICENSE_TOKEN 调 library-app 公开 API 的 license token
    STUDENT_CORS_ORIGINS  逗号分隔, 允许的 origin (默认 dev: localhost:4000, prod 同源不需要)
    STUDENT_BIND_HOST     默认 0.0.0.0
    STUDENT_PORT          默认 18820
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .auth.routes import ROUTES as _auth_routes
from .catalog.routes import ROUTES as _catalog_routes
from .catalog.user_lit_routes import ROUTES as _user_lit_routes
from .chat import ROUTES as _chat_routes
from .chat import preload_graph as _preload_tutor, shutdown_graph as _shutdown_tutor
from .db import init_db
from .drill import ROUTES as _drill_routes
from .library_proxy.routes import ROUTES as _lib_routes


logger = logging.getLogger(__name__)


def _build_cors_origins() -> list[str]:
    raw = os.environ.get("STUDENT_CORS_ORIGINS")
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    # dev default — student-web 开发端口 + 老 web 端口 + 通用 localhost
    return [
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


async def api_health(request: Request) -> JSONResponse:
    return JSONResponse({"ok": True, "service": "student-app", "version": "0.1.0"})


def create_app() -> Starlette:
    from starlette.routing import Route

    routes = [
        Route("/api/health", api_health, methods=["GET"]),
        *_auth_routes,
        *_lib_routes,
        *_catalog_routes,
        *_user_lit_routes,
        *_chat_routes,
        *_drill_routes,
    ]

    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=_build_cors_origins(),
            allow_methods=["*"],
            allow_headers=["*"],
            allow_credentials=True,
        ),
    ]

    @asynccontextmanager
    async def _lifespan(_app):
        init_db()
        logger.info("student-app started, db initialized")
        # spec 028: 预热 tutor graph 避免首次 chat 请求等 5-10s
        if os.environ.get("STUDENT_SKIP_TUTOR_PRELOAD") != "1":
            try:
                await _preload_tutor()
                logger.info("tutor graph preloaded")
            except Exception:
                logger.exception("preload tutor graph failed (will retry on first request)")
        yield
        try:
            await _shutdown_tutor()
        except Exception:
            logger.exception("shutdown tutor graph failed")
        logger.info("student-app shutting down")

    return Starlette(routes=routes, middleware=middleware, lifespan=_lifespan)


app = create_app()


def main() -> None:
    logging.basicConfig(
        level=os.environ.get("STUDENT_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    host = os.environ.get("STUDENT_BIND_HOST", "0.0.0.0")
    port = int(os.environ.get("STUDENT_PORT", "18820"))
    uvicorn.run(
        "systemedu.student.server:app",
        host=host,
        port=port,
        log_level=os.environ.get("STUDENT_LOG_LEVEL", "info").lower(),
        reload=bool(os.environ.get("STUDENT_RELOAD")),
    )


if __name__ == "__main__":
    main()
