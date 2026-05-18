"""spec 028: AI 助教 (tutor) for student-app.

reuse core/tutor 的 LangGraph + skills + memory_injector, 在 student-app
里包一层数据模型适配 (slug + module_id 字符串).

Public API:
    ROUTES                 Starlette 路由列表 (POST /api/chat + WS + 4 sessions CRUD)
    preload_graph()        启动时预热
    shutdown_graph()       关闭时清理
"""

from .routes import ROUTES as _CHAT_ROUTES
from .exercise_routes import ROUTES as _EXERCISE_ROUTES
from .tutor_runner import preload_graph, shutdown_graph

ROUTES = [*_CHAT_ROUTES, *_EXERCISE_ROUTES]

__all__ = ["ROUTES", "preload_graph", "shutdown_graph"]
