"""student-admin Starlette app。独立服务, 共用 student PG (只读)。"""
from __future__ import annotations

from starlette.applications import Starlette

from .routes import ROUTES

app = Starlette(routes=ROUTES)


def main() -> None:
    import os
    import uvicorn
    port = int(os.environ.get("ADMIN_PORT", "18822"))
    uvicorn.run(app, host=os.environ.get("ADMIN_BIND_HOST", "127.0.0.1"), port=port)


if __name__ == "__main__":
    main()
