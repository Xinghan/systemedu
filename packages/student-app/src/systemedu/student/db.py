"""spec 027 P1.3: student-app 独立 DB (~/.systemedu/student.db).

跟老 cloud-app 的 ~/.systemedu/systemedu.db 完全分离, 表只服务 student 业务:
- users               用户
- user_projects       "我的书架" (替代 024-A 的 cloud_purchases)
- last_visited        学习进度占位 (最后访问的 module)
- chat_messages       预留 (spec 028)
- notes               预留 (spec 029)
- assignment_submissions  预留 (spec 029)
"""

from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    select,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


# ---------------------------------------------------------------------------
# engine / session — 独立于 systemedu.core
# ---------------------------------------------------------------------------

def _default_db_path() -> Path:
    """`~/.systemedu/student.db`，可由 STUDENT_DB_PATH 覆盖（测试用）。"""
    override = os.environ.get("STUDENT_DB_PATH")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".systemedu" / "student.db"


_engine = None
_SessionLocal = None


def _ensure_engine():
    global _engine, _SessionLocal
    if _engine is not None:
        return _engine
    db_path = _default_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    _engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, future=True)
    return _engine


def reset_engine_for_tests() -> None:
    """pytest fixture 用: 强制下次访问重新读 STUDENT_DB_PATH."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None


@contextmanager
def get_session():
    _ensure_engine()
    assert _SessionLocal is not None
    sess: Session = _SessionLocal()
    try:
        yield sess
    finally:
        sess.close()


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# models
# ---------------------------------------------------------------------------

def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)


class UserProject(Base):
    """"我的书架" — 学生 Pull 进自己列表的 library 项目。"""

    __tablename__ = "user_projects"
    __table_args__ = (
        UniqueConstraint("user_id", "library_slug", name="uq_user_project"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    library_slug = Column(String(128), index=True, nullable=False)
    library_version = Column(String(64), nullable=True)
    pulled_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    removed_at = Column(DateTime, nullable=True)


class LastVisited(Base):
    """学习进度占位 — 最后访问的 module。"""

    __tablename__ = "last_visited"
    __table_args__ = (
        UniqueConstraint("user_id", "library_slug", name="uq_last_visited"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    library_slug = Column(String(128), index=True, nullable=False)
    last_module_id = Column(String(64), nullable=False)
    last_visited_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# spec 028: AI 助教 chat session + message
# ---------------------------------------------------------------------------

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        UniqueConstraint("user_id", "library_slug", "module_id", "title", name="uq_chat_session"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    library_slug = Column(String(128), index=True, nullable=False, default="")
    module_id = Column(String(64), index=True, nullable=True)
    title = Column(String(120), nullable=False, default="新对话")
    active_skill = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=_uuid)
    session_id = Column(String(36), ForeignKey("chat_sessions.id"), index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    library_slug = Column(String(128), index=True, nullable=False, default="")
    module_id = Column(String(64), index=True, nullable=False, default="")
    role = Column(String(16), nullable=False)  # 'user' | 'assistant' | 'tool' | 'system'
    content = Column(Text, nullable=False)
    tool_calls = Column(Text, nullable=True)  # JSON string
    skill = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Note(Base):
    __tablename__ = "notes"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    library_slug = Column(String(128), index=True, nullable=False)
    module_id = Column(String(64), index=True, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    library_slug = Column(String(128), index=True, nullable=False)
    module_id = Column(String(64), index=True, nullable=False)
    content = Column(Text, nullable=False)
    media_paths = Column(Text, nullable=True)  # JSON array as string
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# spec 031: tutor context + memory 3 张新表
# ---------------------------------------------------------------------------

class ExerciseAttempt(Base):
    """L3 学生答题记录."""

    __tablename__ = "exercise_attempts"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    library_slug = Column(String(128), nullable=False)
    module_id = Column(String(64), nullable=False)
    idea_id = Column(String(128), nullable=True)
    exercise_index = Column(Integer, nullable=True)
    question = Column(Text, nullable=True)
    student_answer = Column(Text, nullable=True)
    correct = Column(Boolean, nullable=True)
    explanation_shown = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_ea_user_slug_module", "user_id", "library_slug", "module_id"),
        Index("idx_ea_user_created", "user_id", "created_at"),
    )


class StudentFact(Base):
    """L1/L3 长期记忆事实 — 跨 session 的学生画像 / 项目级 / knode 级.

    Supersede chain: 新事实进 → 老事实 valid_to=now + superseded_by=new.id.
    """

    __tablename__ = "student_facts"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    scope = Column(String(16), nullable=False)  # 'global' | 'project' | 'knode'
    library_slug = Column(String(128), nullable=True)
    module_id = Column(String(64), nullable=True)
    category = Column(String(32), nullable=False)  # interest|goal|skill_level|family|misconception|preference
    key = Column(String(128), nullable=False)
    value = Column(Text, nullable=False)
    source_session = Column(String(36), nullable=True)
    confidence = Column(Float, default=0.7, nullable=False)
    valid_from = Column(DateTime, default=datetime.utcnow, nullable=False)
    valid_to = Column(DateTime, nullable=True)  # NULL = current
    superseded_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index(
            "idx_sf_user_scope_current",
            "user_id",
            "scope",
            postgresql_where=text("valid_to IS NULL"),
        ),
        Index(
            "idx_sf_user_slug_current",
            "user_id",
            "library_slug",
            postgresql_where=text("valid_to IS NULL"),
        ),
    )


class PendingExtraction(Base):
    """fact_extractor worker 队列 — chat session done 后入队."""

    __tablename__ = "pending_extractions"

    id = Column(String(36), primary_key=True, default=_uuid)
    session_id = Column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    enqueued_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    status = Column(String(16), default="pending", nullable=False)  # pending|processing|done|failed|dead
    error = Column(Text, nullable=True)
    attempts = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        # 一个 session 最多一条 pending — dedup
        UniqueConstraint("session_id", name="uq_pending_extraction_session"),
        Index(
            "idx_pe_status_enqueued",
            "status",
            "enqueued_at",
            postgresql_where=text("status IN ('pending','failed')"),
        ),
    )


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------

def init_db() -> None:
    """启动时调一次, 建表 (幂等)."""
    engine = _ensure_engine()
    Base.metadata.create_all(engine)


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------

def _detach_user(u: User | None) -> User | None:
    if u is None:
        return None
    return User(
        id=u.id,
        username=u.username,
        password_hash=u.password_hash,
        created_at=u.created_at,
        last_login_at=u.last_login_at,
    )


def get_user_by_username(username: str) -> User | None:
    with get_session() as session:
        u = session.execute(
            select(User).where(User.username == username)
        ).scalar_one_or_none()
        return _detach_user(u)


def get_user_by_id(user_id: str) -> User | None:
    with get_session() as session:
        return _detach_user(session.get(User, user_id))


def create_user(username: str, password_hash: str) -> User:
    with get_session() as session:
        u = User(username=username, password_hash=password_hash)
        session.add(u)
        session.commit()
        session.refresh(u)
        return _detach_user(u)  # type: ignore[return-value]


def update_last_login(user_id: str) -> None:
    with get_session() as session:
        u = session.get(User, user_id)
        if u:
            u.last_login_at = datetime.utcnow()
            session.commit()


# ---------------------------------------------------------------------------
# UserProject helpers
# ---------------------------------------------------------------------------

def _detach_user_project(p: UserProject | None) -> UserProject | None:
    if p is None:
        return None
    return UserProject(
        id=p.id,
        user_id=p.user_id,
        library_slug=p.library_slug,
        library_version=p.library_version,
        pulled_at=p.pulled_at,
        removed_at=p.removed_at,
    )


def get_user_project(user_id: str, library_slug: str) -> UserProject | None:
    with get_session() as session:
        p = session.execute(
            select(UserProject).where(
                UserProject.user_id == user_id,
                UserProject.library_slug == library_slug,
            )
        ).scalar_one_or_none()
        return _detach_user_project(p)


def user_has_pulled(user_id: str, library_slug: str) -> bool:
    """user 是否已 Pull (且未 remove) 该 slug?"""
    p = get_user_project(user_id, library_slug)
    return p is not None and p.removed_at is None


def list_user_projects(user_id: str, include_removed: bool = False) -> list[UserProject]:
    with get_session() as session:
        stmt = select(UserProject).where(UserProject.user_id == user_id)
        if not include_removed:
            stmt = stmt.where(UserProject.removed_at.is_(None))
        rows = session.execute(stmt).scalars().all()
        return [_detach_user_project(p) for p in rows]  # type: ignore[misc]


def upsert_user_project(
    user_id: str,
    library_slug: str,
    library_version: str | None = None,
) -> tuple[UserProject, bool]:
    """Pull: 如果存在 (即便 removed) 则 removed_at=NULL + 刷 version; 否则新建.

    Returns: (project, created) — created=True 表示是新行。
    """
    with get_session() as session:
        existing = session.execute(
            select(UserProject).where(
                UserProject.user_id == user_id,
                UserProject.library_slug == library_slug,
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.removed_at = None
            if library_version:
                existing.library_version = library_version
            existing.pulled_at = datetime.utcnow()
            session.commit()
            session.refresh(existing)
            return _detach_user_project(existing), False  # type: ignore[return-value]
        p = UserProject(
            user_id=user_id,
            library_slug=library_slug,
            library_version=library_version,
        )
        session.add(p)
        session.commit()
        session.refresh(p)
        return _detach_user_project(p), True  # type: ignore[return-value]


def soft_remove_user_project(user_id: str, library_slug: str) -> bool:
    """软删: removed_at=now(). 返回 True 表示有更新."""
    with get_session() as session:
        existing = session.execute(
            select(UserProject).where(
                UserProject.user_id == user_id,
                UserProject.library_slug == library_slug,
                UserProject.removed_at.is_(None),
            )
        ).scalar_one_or_none()
        if existing is None:
            return False
        existing.removed_at = datetime.utcnow()
        session.commit()
        return True


# ---------------------------------------------------------------------------
# LastVisited helpers
# ---------------------------------------------------------------------------

def _detach_last_visited(lv: LastVisited | None) -> LastVisited | None:
    if lv is None:
        return None
    return LastVisited(
        id=lv.id,
        user_id=lv.user_id,
        library_slug=lv.library_slug,
        last_module_id=lv.last_module_id,
        last_visited_at=lv.last_visited_at,
    )


def get_last_visited(user_id: str, library_slug: str) -> LastVisited | None:
    with get_session() as session:
        lv = session.execute(
            select(LastVisited).where(
                LastVisited.user_id == user_id,
                LastVisited.library_slug == library_slug,
            )
        ).scalar_one_or_none()
        return _detach_last_visited(lv)


def upsert_last_visited(user_id: str, library_slug: str, module_id: str) -> LastVisited:
    with get_session() as session:
        existing = session.execute(
            select(LastVisited).where(
                LastVisited.user_id == user_id,
                LastVisited.library_slug == library_slug,
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.last_module_id = module_id
            existing.last_visited_at = datetime.utcnow()
            session.commit()
            session.refresh(existing)
            return _detach_last_visited(existing)  # type: ignore[return-value]
        lv = LastVisited(
            user_id=user_id,
            library_slug=library_slug,
            last_module_id=module_id,
        )
        session.add(lv)
        session.commit()
        session.refresh(lv)
        return _detach_last_visited(lv)  # type: ignore[return-value]
