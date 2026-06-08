"""spec 028 P1.3 + spec 031 P3.1: ChatPayload — 学生端字段适配.

跟 cloud-app/.../chat_payload.py 同名字段语义对齐, 但:
- project_name → library_slug
- knode_id 是字符串 (M01 等), 不是 int
- 移除老兼容字段 (agent / node_id / active_tab / page_index / project alias)
- spec 031 加 page_kind 字段, 前端按当前路由透传, 后端按之激活相应 memory 层
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, model_validator


PageKind = Literal["global", "home", "library_detail", "learn"]


class ChatPayload(BaseModel):
    """Validated chat request body."""

    message: str
    session_id: str | None = None
    library_slug: str | None = None
    module_id: str | None = None
    page_kind: PageKind = "global"
    source: str = "chat"  # chat | highlight_ask (spec 2026-06-08)
    confirm_response: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _validate(self) -> "ChatPayload":
        if self.module_id and not self.library_slug:
            raise ValueError("module_id 需要 library_slug")
        if not self.message or not self.message.strip():
            raise ValueError("message 不能为空")
        # learn page 必须有 module_id
        if self.page_kind == "learn" and not self.module_id:
            raise ValueError("page_kind='learn' 需要 module_id")
        # library_detail 必须有 library_slug
        if self.page_kind == "library_detail" and not self.library_slug:
            raise ValueError("page_kind='library_detail' 需要 library_slug")
        return self

    def thread_id(self, user_id: str) -> str:
        """LangGraph checkpointer 的 thread key.

        (user_id, library_slug, module_id) 三元组组装, 跨 module 切换会得到
        不同 thread, agent 不混淆 module 上下文.
        """
        if self.library_slug:
            return f"{user_id}:{self.library_slug}:{self.module_id or 'project-main'}"
        return f"{user_id}:global"

    @property
    def context_scope(self) -> str:
        """供 MemoryInjector 区分 project / global 记忆层."""
        return "project" if self.library_slug else "global"


__all__ = ["ChatPayload"]
