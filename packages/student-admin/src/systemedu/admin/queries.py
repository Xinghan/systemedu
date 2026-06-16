"""只读查询 — 复用 student-app 的 db model, 连同一个生产 PG。绝不写。"""
from __future__ import annotations

from sqlalchemy import func, select

from systemedu.student.db import (
    ChatMessage,
    LastVisited,
    User,
    UserKnodeComplete,
    UserProject,
    get_session,
)


def list_users(limit: int = 50, offset: int = 0) -> list[dict]:
    """所有用户 + 聚合统计, 按注册时间倒序。"""
    with get_session() as s:
        users = s.execute(
            select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
        ).scalars().all()
        out = []
        for u in users:
            pc = s.execute(select(func.count()).select_from(UserProject).where(UserProject.user_id == u.id)).scalar() or 0
            kc = s.execute(select(func.count()).select_from(UserKnodeComplete).where(UserKnodeComplete.user_id == u.id)).scalar() or 0
            qc = s.execute(
                select(func.count()).select_from(ChatMessage).where(ChatMessage.user_id == u.id, ChatMessage.role == "user")
            ).scalar() or 0
            out.append({
                "id": u.id, "phone": u.phone, "display_name": u.display_name,
                "student_age": u.student_age, "gender": u.gender,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "project_count": pc, "knode_count": kc, "question_count": qc,
            })
        return out


def user_detail(user_id: str) -> dict | None:
    """单用户详情: 基本信息 + pull 项目 + 完成节点 + 提问。不存在返 None。"""
    with get_session() as s:
        u = s.get(User, user_id)
        if u is None:
            return None
        projects = s.execute(
            select(UserProject).where(UserProject.user_id == user_id).order_by(UserProject.pulled_at.desc())
        ).scalars().all()
        last_map = {}
        for lv in s.execute(select(LastVisited).where(LastVisited.user_id == user_id)).scalars().all():
            last_map[lv.library_slug] = lv.last_module_id
        knodes = s.execute(
            select(UserKnodeComplete).where(UserKnodeComplete.user_id == user_id).order_by(UserKnodeComplete.completed_at.desc())
        ).scalars().all()
        msgs = s.execute(
            select(ChatMessage).where(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.asc())
        ).scalars().all()
        questions = []
        for i, m in enumerate(msgs):
            if m.role != "user":
                continue
            answer = next((n.content for n in msgs[i + 1:] if n.session_id == m.session_id and n.role == "assistant"), None)
            questions.append({
                "library_slug": m.library_slug, "module_id": m.module_id,
                "content": m.content, "answer": answer,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })
        questions.reverse()
        return {
            "user": {
                "id": u.id, "phone": u.phone, "display_name": u.display_name,
                "student_age": u.student_age, "gender": u.gender,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            },
            "projects": [{
                "library_slug": p.library_slug, "library_version": p.library_version,
                "pulled_at": p.pulled_at.isoformat() if p.pulled_at else None,
                "last_module_id": last_map.get(p.library_slug),
                "knode_count": sum(1 for k in knodes if k.project_slug == p.library_slug),
            } for p in projects],
            "knodes": [{
                "project_slug": k.project_slug, "knode_id": k.knode_id,
                "completed_at": k.completed_at.isoformat() if k.completed_at else None,
            } for k in knodes],
            "questions": questions,
        }
