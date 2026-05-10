"""library-app FastAPI entry point.

启动: python -m library.main
或者: uvicorn library.main:app --host 127.0.0.1 --port 18821
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .auth import maybe_bootstrap_admin
from .models import init_db
from .routes import admin, public
from .settings import HOST, PORT, ensure_dirs

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动 / 关闭逻辑."""
    ensure_dirs()
    init_db()
    bootstrapped = maybe_bootstrap_admin()
    if bootstrapped:
        logger.warning(
            "Bootstrapped super_admin user %r from LIBRARY_BOOTSTRAP_ADMIN env var", bootstrapped
        )
    logger.info("library-app started")
    yield
    logger.info("library-app shutting down")


app = FastAPI(
    title="systemedu-library",
    description="Content service for systemedu (admin + public API)",
    version="0.1.0",
    lifespan=lifespan,
)

# routes
app.include_router(public.router, prefix="/v1", tags=["public"])
app.include_router(admin.auth_router, prefix="/admin/auth", tags=["admin-auth"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])


@app.get("/")
def root() -> dict:
    return {
        "service": "systemedu-library",
        "version": "0.1.0",
        "endpoints": {
            "public": "/v1/projects (license token required)",
            "admin": "/admin/* (JWT required)",
            "auth": "/admin/auth/login",
        },
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


def main():
    """CLI entry point: python -m library.main"""
    import argparse

    import uvicorn

    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s:%(name)s:%(message)s",
    )

    parser = argparse.ArgumentParser(description="systemedu-library service")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
