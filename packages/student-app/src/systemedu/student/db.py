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
# engine / session — spec 031: PG via STUDENT_DB_URL
#
# 优先级:
#   STUDENT_DB_URL env (e.g. postgresql+psycopg2://...)
#   else if STUDENT_DB_PATH env: SQLite file (老 pytest 兼容)
#   else: default PG localhost
# ---------------------------------------------------------------------------

DEFAULT_PG_URL = "postgresql+psycopg2://systemedu:systemedu@127.0.0.1:5432/student"


def _resolve_db_url() -> str:
    if url := os.environ.get("STUDENT_DB_URL"):
        return url
    # 兼容老 STUDENT_DB_PATH (pytest fixture 用)
    if path := os.environ.get("STUDENT_DB_PATH"):
        p = Path(path).expanduser()
        p.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{p}"
    return DEFAULT_PG_URL


_engine = None
_SessionLocal = None


def _ensure_engine():
    global _engine, _SessionLocal
    if _engine is not None:
        return _engine
    url = _resolve_db_url()
    if url.startswith("sqlite"):
        _engine = create_engine(
            url, connect_args={"check_same_thread": False}, future=True
        )
    else:
        _engine = create_engine(url, future=True, pool_pre_ping=True)
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
    """"我的书架" — 学生 Pull 进自己列表的 library 项目.

    spec 033: pull 时真把 tarball 解压到本地 (~/.systemedu/student/users/<uid>/projects/<slug>/<version>/).
    `cloned_version` / `local_path` / `cloned_at` 三列代表本地 clone 状态;
    全 NULL = 老式 pull (没真下载), 学习时返 403 让用户重新 Pull.
    """

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
    # spec 033: 本地 clone 状态
    cloned_version = Column(String(64), nullable=True)
    local_path = Column(String(512), nullable=True)
    cloned_at = Column(DateTime, nullable=True)


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
# spec 036: 用户级 knode 完成状态 (per-user, toggle 可撤销)
# ---------------------------------------------------------------------------

class UserKnodeComplete(Base):
    """用户标记某 knode 已学完. 可 toggle (撤销 = 删行).

    跨 library_version 保留 — 项目升级新版后, 老完成记录仍计 (聚合时复用).
    """

    __tablename__ = "user_knode_complete"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "project_slug", "knode_id",
            name="uq_user_knode_complete",
        ),
        Index("ix_user_knode_complete_user_slug", "user_id", "project_slug"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    project_slug = Column(String(128), nullable=False)
    knode_id = Column(String(64), nullable=False)
    library_version = Column(String(64), nullable=True)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


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
    source = Column(String(32), nullable=False, default="chat")  # chat | highlight_ask
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
    """启动时调一次, 建表 (幂等).

    spec 031: PG 用 alembic, SQLite (pytest 兼容) 用 create_all.
    """
    engine = _ensure_engine()
    url = str(engine.url)
    if url.startswith("sqlite"):
        # pytest 临时 db 走 create_all (alembic 太重)
        Base.metadata.create_all(engine)
    else:
        # PG 生产 / dev 走 alembic upgrade head
        _run_alembic_upgrade()


def _run_alembic_upgrade() -> None:
    """跑 alembic upgrade head, 用 student-app 自带的 alembic 配置."""
    import logging
    from alembic import command
    from alembic.config import Config

    pkg_dir = Path(__file__).resolve().parent.parent.parent.parent  # student-app/
    alembic_ini = pkg_dir / "alembic.ini"
    if not alembic_ini.exists():
        logging.getLogger(__name__).warning(
            "alembic.ini not found at %s; skip migration", alembic_ini
        )
        return
    cfg = Config(str(alembic_ini))
    # script_location 指向 student-app/alembic
    cfg.set_main_option("script_location", str(pkg_dir / "alembic"))
    command.upgrade(cfg, "head")


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
        cloned_version=p.cloned_version,
        local_path=p.local_path,
        cloned_at=p.cloned_at,
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

    cloud 版本 (spec 037): pull 仅记一行关联, 不落盘, 不写 cloned_* 列。
    cloned_version / local_path / cloned_at 列保留在表里但不再写入 (无 migration)。

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


def delete_last_visited(user_id: str, library_slug: str) -> bool:
    """删除某用户某项目的学习进度记录. 返回是否真删了.

    卸载项目时调用, 避免"移除 -> 重新 clone"后旧进度 (last_module_id) 复活。
    """
    with get_session() as session:
        existing = session.execute(
            select(LastVisited).where(
                LastVisited.user_id == user_id,
                LastVisited.library_slug == library_slug,
            )
        ).scalar_one_or_none()
        if existing is None:
            return False
        session.delete(existing)
        session.commit()
        return True


# ---------------------------------------------------------------------------
# spec 031: ExerciseAttempt DAO
# ---------------------------------------------------------------------------

def _detach_exercise_attempt(ea: ExerciseAttempt | None) -> dict | None:
    if ea is None:
        return None
    return {
        "id": ea.id,
        "user_id": ea.user_id,
        "library_slug": ea.library_slug,
        "module_id": ea.module_id,
        "idea_id": ea.idea_id,
        "exercise_index": ea.exercise_index,
        "question": ea.question,
        "student_answer": ea.student_answer,
        "correct": ea.correct,
        "explanation_shown": ea.explanation_shown,
        "created_at": ea.created_at,
    }


def record_exercise_attempt(
    user_id: str,
    library_slug: str,
    module_id: str,
    *,
    idea_id: str | None = None,
    exercise_index: int | None = None,
    question: str | None = None,
    student_answer: str | None = None,
    correct: bool | None = None,
    explanation_shown: str | None = None,
) -> dict:
    with get_session() as sess:
        ea = ExerciseAttempt(
            user_id=user_id,
            library_slug=library_slug,
            module_id=module_id,
            idea_id=idea_id,
            exercise_index=exercise_index,
            question=question,
            student_answer=student_answer,
            correct=correct,
            explanation_shown=explanation_shown,
        )
        sess.add(ea)
        sess.commit()
        sess.refresh(ea)
        return _detach_exercise_attempt(ea)  # type: ignore[return-value]


def list_exercise_attempts(
    user_id: str,
    library_slug: str | None = None,
    module_id: str | None = None,
    only_wrong: bool = False,
    limit: int = 20,
) -> list[dict]:
    with get_session() as sess:
        stmt = select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
        if library_slug:
            stmt = stmt.where(ExerciseAttempt.library_slug == library_slug)
        if module_id:
            stmt = stmt.where(ExerciseAttempt.module_id == module_id)
        if only_wrong:
            stmt = stmt.where(ExerciseAttempt.correct.is_(False))
        stmt = stmt.order_by(ExerciseAttempt.created_at.desc()).limit(limit)
        rows = sess.execute(stmt).scalars().all()
        return [_detach_exercise_attempt(r) for r in rows]  # type: ignore[misc]


# ---------------------------------------------------------------------------
# spec 031: StudentFact DAO (supersede chain)
# ---------------------------------------------------------------------------

def _detach_student_fact(f: StudentFact | None) -> dict | None:
    if f is None:
        return None
    return {
        "id": f.id,
        "user_id": f.user_id,
        "scope": f.scope,
        "library_slug": f.library_slug,
        "module_id": f.module_id,
        "category": f.category,
        "key": f.key,
        "value": f.value,
        "source_session": f.source_session,
        "confidence": f.confidence,
        "valid_from": f.valid_from,
        "valid_to": f.valid_to,
        "superseded_by": f.superseded_by,
        "created_at": f.created_at,
    }


def list_current_facts(
    user_id: str,
    scope: str | None = None,
    library_slug: str | None = None,
    module_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """查当前 (valid_to IS NULL) 事实."""
    with get_session() as sess:
        stmt = select(StudentFact).where(
            StudentFact.user_id == user_id,
            StudentFact.valid_to.is_(None),
        )
        if scope:
            stmt = stmt.where(StudentFact.scope == scope)
        if library_slug is not None:
            stmt = stmt.where(StudentFact.library_slug == library_slug)
        if module_id is not None:
            stmt = stmt.where(StudentFact.module_id == module_id)
        stmt = stmt.order_by(StudentFact.created_at.desc()).limit(limit)
        rows = sess.execute(stmt).scalars().all()
        return [_detach_student_fact(r) for r in rows]  # type: ignore[misc]


def upsert_fact(
    user_id: str,
    scope: str,
    category: str,
    key: str,
    value: str,
    *,
    library_slug: str | None = None,
    module_id: str | None = None,
    source_session: str | None = None,
    confidence: float = 0.7,
) -> dict:
    """Supersede chain: 同 (user_id, scope, slug, module_id, key) 的老 fact valid_to=now,
    superseded_by=new.id. 新 fact INSERT 并返回."""
    now = datetime.utcnow()
    with get_session() as sess:
        # find existing current
        existing = sess.execute(
            select(StudentFact).where(
                StudentFact.user_id == user_id,
                StudentFact.scope == scope,
                StudentFact.key == key,
                StudentFact.valid_to.is_(None),
            ).where(
                # 处理 nullable slug/module: 比较时把 NULL 当 ''
                (StudentFact.library_slug == (library_slug or None))
                | (
                    StudentFact.library_slug.is_(None)
                    & (library_slug is None)
                )
            )
        ).scalar_one_or_none()

        # 构造新 fact
        new = StudentFact(
            user_id=user_id,
            scope=scope,
            library_slug=library_slug,
            module_id=module_id,
            category=category,
            key=key,
            value=value,
            source_session=source_session,
            confidence=confidence,
            valid_from=now,
        )
        sess.add(new)
        sess.flush()  # 拿 new.id

        if existing is not None:
            existing.valid_to = now
            existing.superseded_by = new.id

        sess.commit()
        sess.refresh(new)
        return _detach_student_fact(new)  # type: ignore[return-value]


def retire_fact(fact_id: str, user_id: str) -> tuple[bool, str]:
    """spec 032 P2: 手动 retire 一条 fact (valid_to=now, superseded_by=None).

    返回 (ok, reason). reason: "" / "not_found" / "forbidden" / "already_retired".
    校验 user_id 必须等于 fact.user_id, 避免 A 删 B 的 fact.
    """
    now = datetime.utcnow()
    with get_session() as sess:
        row = sess.get(StudentFact, fact_id)
        if row is None:
            return False, "not_found"
        if row.user_id != user_id:
            return False, "forbidden"
        if row.valid_to is not None:
            return False, "already_retired"
        row.valid_to = now
        sess.commit()
        return True, ""


# ---------------------------------------------------------------------------
# spec 031: PendingExtraction DAO
# ---------------------------------------------------------------------------

def _detach_pending(p: PendingExtraction | None) -> dict | None:
    if p is None:
        return None
    return {
        "id": p.id,
        "session_id": p.session_id,
        "user_id": p.user_id,
        "enqueued_at": p.enqueued_at,
        "processed_at": p.processed_at,
        "status": p.status,
        "error": p.error,
        "attempts": p.attempts,
    }


def enqueue_extraction(session_id: str, user_id: str) -> dict | None:
    """入队. 同 session_id 已存在则静默返 None (unique 约束 dedup)."""
    from sqlalchemy.exc import IntegrityError
    with get_session() as sess:
        try:
            p = PendingExtraction(session_id=session_id, user_id=user_id)
            sess.add(p)
            sess.commit()
            sess.refresh(p)
            return _detach_pending(p)
        except IntegrityError:
            sess.rollback()
            return None


def enqueue_inactive_sessions(inactive_minutes: int = 30, limit: int = 50) -> int:
    """spec 031 P4.3: 扫所有 chat_sessions, 把 updated_at 超 inactive_minutes
    且尚无 pending_extractions row 的 session 入队.

    幂等 — enqueue_extraction 内部去重. 返新入队条数.
    """
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(minutes=inactive_minutes)
    enqueued = 0
    with get_session() as sess:
        # 找出: chat_sessions.updated_at < cutoff AND 没在 pending_extractions
        # 注: 简单 left join (SQLite/PG 都行)
        stmt = (
            select(ChatSession.id, ChatSession.user_id)
            .outerjoin(PendingExtraction, PendingExtraction.session_id == ChatSession.id)
            .where(ChatSession.updated_at < cutoff)
            .where(PendingExtraction.id.is_(None))
            .limit(limit)
        )
        rows = sess.execute(stmt).all()
    for sid, uid in rows:
        if enqueue_extraction(sid, uid) is not None:
            enqueued += 1
    return enqueued


def list_pending_extractions(limit: int = 20) -> list[dict]:
    """status='pending', 按 enqueued_at 早→晚."""
    with get_session() as sess:
        stmt = (
            select(PendingExtraction)
            .where(PendingExtraction.status == "pending")
            .order_by(PendingExtraction.enqueued_at)
            .limit(limit)
        )
        rows = sess.execute(stmt).scalars().all()
        return [_detach_pending(r) for r in rows]  # type: ignore[misc]


def mark_extraction_processing(extraction_id: str) -> None:
    with get_session() as sess:
        p = sess.get(PendingExtraction, extraction_id)
        if p is None:
            return
        p.status = "processing"
        p.attempts += 1
        sess.commit()


def mark_extraction_done(extraction_id: str) -> None:
    with get_session() as sess:
        p = sess.get(PendingExtraction, extraction_id)
        if p is None:
            return
        p.status = "done"
        p.processed_at = datetime.utcnow()
        sess.commit()


def mark_extraction_failed(
    extraction_id: str,
    error: str,
    max_attempts: int = 3,
) -> None:
    """attempts >= max_attempts → status='dead', 否则 'failed' (5min 后 worker 重试)."""
    with get_session() as sess:
        p = sess.get(PendingExtraction, extraction_id)
        if p is None:
            return
        p.error = error[:1000]
        p.processed_at = datetime.utcnow()
        p.status = "dead" if p.attempts >= max_attempts else "failed"
        sess.commit()
