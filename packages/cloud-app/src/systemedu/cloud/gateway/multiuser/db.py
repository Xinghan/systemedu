"""spec 024-A multi-user DB models (User + Purchase).

复用 systemedu.core.storage.db 的 engine + Base, 表存在
~/.systemedu/systemedu.db 里 (跟其他业务表同库)。

依赖:
- bcrypt (密码哈希)
- uuid (主键)
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    select,
)

from systemedu.core.storage.db import Base, get_engine, get_session


# ---------------------------------------------------------------------------
# models
# ---------------------------------------------------------------------------

def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """注册用户."""

    __tablename__ = "cloud_users"

    id = Column(String(36), primary_key=True, default=_uuid)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)


class Purchase(Base):
    """用户对项目的购买记录 (本期免支付, 点击即购买)."""

    __tablename__ = "cloud_purchases"
    __table_args__ = (
        UniqueConstraint("user_id", "project_slug", name="uq_user_project"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("cloud_users.id"), index=True, nullable=False)
    project_slug = Column(String(128), index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# init / helpers
# ---------------------------------------------------------------------------

def init_db() -> None:
    """启动时调一次, 建表 (如果还没有). 复用 systemedu.core engine."""
    engine = get_engine()
    Base.metadata.create_all(engine)


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


def user_has_purchased(user_id: str, project_slug: str) -> bool:
    with get_session() as session:
        row = session.execute(
            select(Purchase).where(
                Purchase.user_id == user_id,
                Purchase.project_slug == project_slug,
            )
        ).scalar_one_or_none()
        return row is not None


def list_purchases(user_id: str) -> list[Purchase]:
    with get_session() as session:
        rows = session.execute(
            select(Purchase).where(Purchase.user_id == user_id)
        ).scalars().all()
        # detach from session
        return [
            Purchase(
                id=p.id,
                user_id=p.user_id,
                project_slug=p.project_slug,
                created_at=p.created_at,
            )
            for p in rows
        ]


def create_purchase(user_id: str, project_slug: str) -> Purchase | None:
    """创建一条 (如果已存在则返回 None, 调用方应当成 idempotent)."""
    with get_session() as session:
        existing = session.execute(
            select(Purchase).where(
                Purchase.user_id == user_id,
                Purchase.project_slug == project_slug,
            )
        ).scalar_one_or_none()
        if existing:
            return None
        p = Purchase(user_id=user_id, project_slug=project_slug)
        session.add(p)
        session.commit()
        session.refresh(p)
        # detach
        return Purchase(
            id=p.id,
            user_id=p.user_id,
            project_slug=p.project_slug,
            created_at=p.created_at,
        )


def create_user(username: str, password_hash: str) -> User:
    with get_session() as session:
        u = User(username=username, password_hash=password_hash)
        session.add(u)
        session.commit()
        session.refresh(u)
        # detach
        return User(
            id=u.id,
            username=u.username,
            password_hash=u.password_hash,
            created_at=u.created_at,
            last_login_at=u.last_login_at,
        )


def update_last_login(user_id: str) -> None:
    with get_session() as session:
        u = session.get(User, user_id)
        if u:
            u.last_login_at = datetime.utcnow()
            session.commit()
