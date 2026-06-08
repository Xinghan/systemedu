"""spec 028 P1.4: SessionManager — chat session CRUD on student.db.

落库表:
- chat_sessions (本 spec P1.2 新建)
- chat_messages (升级 P1.2 加 session_id/tool_calls/skill 列)

session 实例不跨进程缓存, 每个请求新建 connection。
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import select

from ..db import (
    ChatMessage,
    ChatSession,
    get_session as _get_db_session,
)


def _detach_session(s: ChatSession | None) -> dict | None:
    if s is None:
        return None
    return {
        "id": s.id,
        "user_id": s.user_id,
        "library_slug": s.library_slug,
        "module_id": s.module_id,
        "title": s.title,
        "active_skill": s.active_skill,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _detach_message(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "session_id": m.session_id,
        "user_id": m.user_id,
        "library_slug": m.library_slug,
        "module_id": m.module_id,
        "role": m.role,
        "content": m.content,
        "tool_calls": json.loads(m.tool_calls) if m.tool_calls else None,
        "skill": m.skill,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def list_sessions(
    user_id: str,
    library_slug: str | None = None,
    module_id: str | None = None,
) -> list[dict]:
    with _get_db_session() as session:
        stmt = select(ChatSession).where(ChatSession.user_id == user_id)
        if library_slug:
            stmt = stmt.where(ChatSession.library_slug == library_slug)
        if module_id:
            stmt = stmt.where(ChatSession.module_id == module_id)
        stmt = stmt.order_by(ChatSession.updated_at.desc())
        rows = session.execute(stmt).scalars().all()
        return [_detach_session(r) for r in rows]  # type: ignore[misc]


def get_session_for_user(session_id: str, user_id: str) -> dict | None:
    """获取 session, 验证所有权."""
    with _get_db_session() as session:
        s = session.get(ChatSession, session_id)
        if s is None or s.user_id != user_id:
            return None
        return _detach_session(s)


def get_messages(session_id: str, limit: int = 200) -> list[dict]:
    with _get_db_session() as session:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        rows = session.execute(stmt).scalars().all()
        return [_detach_message(m) for m in rows]


def create_session(
    user_id: str,
    library_slug: str | None,
    module_id: str | None,
    title: str,
    active_skill: str | None = None,
) -> dict:
    with _get_db_session() as session:
        s = ChatSession(
            user_id=user_id,
            library_slug=library_slug or "",
            module_id=module_id,
            title=title,
            active_skill=active_skill,
        )
        session.add(s)
        session.commit()
        session.refresh(s)
        return _detach_session(s)  # type: ignore[return-value]


def delete_session(session_id: str, user_id: str) -> bool:
    """软/硬删 — 这里走硬删, 级联 chat_messages (FK ondelete=CASCADE 或手动)."""
    with _get_db_session() as session:
        s = session.get(ChatSession, session_id)
        if s is None or s.user_id != user_id:
            return False
        # 手动删 messages (兼容老 sqlite 没 FK cascade)
        session.execute(
            ChatMessage.__table__.delete().where(ChatMessage.session_id == session_id)
        )
        session.delete(s)
        session.commit()
        return True


def append_message(
    session_id: str,
    user_id: str,
    library_slug: str | None,
    module_id: str | None,
    role: str,
    content: str,
    tool_calls: Any | None = None,
    skill: str | None = None,
    source: str = "chat",
) -> dict:
    with _get_db_session() as session:
        m = ChatMessage(
            session_id=session_id,
            user_id=user_id,
            library_slug=library_slug or "",
            module_id=module_id or "",
            role=role,
            content=content,
            tool_calls=json.dumps(tool_calls, ensure_ascii=False) if tool_calls else None,
            skill=skill,
            source=source,
        )
        session.add(m)
        # 同时刷 session.updated_at
        s = session.get(ChatSession, session_id)
        if s is not None:
            s.updated_at = datetime.utcnow()
            if skill and skill != s.active_skill:
                s.active_skill = skill
        session.commit()
        session.refresh(m)
        return _detach_message(m)


def update_session_title(session_id: str, user_id: str, title: str) -> bool:
    with _get_db_session() as session:
        s = session.get(ChatSession, session_id)
        if s is None or s.user_id != user_id:
            return False
        s.title = title
        s.updated_at = datetime.utcnow()
        session.commit()
        return True


__all__ = [
    "list_sessions",
    "get_session_for_user",
    "get_messages",
    "create_session",
    "delete_session",
    "append_message",
    "update_session_title",
]
