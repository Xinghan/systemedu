"""SQLAlchemy DB schema (spec 023).

3 张表:
- AdminUser: 管理员账号 (跟 cloud-app 用户系统隔离)
- Project: 项目元数据 (映射 manifest.json)
- Lesson: 每个 knode 的 lesson 内容 (映射 package layout 的 knodes/<id>/)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# AdminUser
# ---------------------------------------------------------------------------

class AdminRole(str, Enum):
    super_admin = "super_admin"
    editor = "editor"
    viewer = "viewer"


class AdminStatus(str, Enum):
    active = "active"
    disabled = "disabled"


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    role = Column(SQLEnum(AdminRole), nullable=False, default=AdminRole.editor)
    status = Column(SQLEnum(AdminStatus), nullable=False, default=AdminStatus.active)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class ProjectStatus(str, Enum):
    draft = "draft"
    published = "published"


class Project(Base):
    __tablename__ = "projects"

    slug = Column(String(128), primary_key=True)
    title = Column(String(256), nullable=False)
    title_zh = Column(String(256), nullable=True)
    description = Column(Text, nullable=False, default="")

    # frontmatter (spec 023 §package layout)
    age_band = Column(String(16), nullable=True)            # "10-12" / "13-15" / "16-18"
    domain = Column(String(64), nullable=True)              # AI / Aerospace / 等
    duration_weeks = Column(Integer, nullable=True)
    weekly_hours = Column(Integer, nullable=True)
    budget_usd = Column(Integer, nullable=True)
    difficulty = Column(Integer, nullable=True)             # 1-5
    tags = Column(JSON, nullable=False, default=list)       # list[str]

    cover_image_path = Column(String(256), nullable=True)   # 相对 media/projects/<slug>/

    # version + 索引
    version = Column(String(64), nullable=False, default="1.0.0")
    knode_count = Column(Integer, nullable=False, default=0)
    stage_count = Column(Integer, nullable=False, default=0)
    languages = Column(JSON, nullable=False, default=lambda: ["zh-CN"])
    total_size_bytes = Column(Integer, nullable=False, default=0)

    # 完整 manifest + tree (导入时整包解析存)
    manifest_json = Column(JSON, nullable=False, default=dict)        # 完整 manifest.json
    knowledge_tree_json = Column(JSON, nullable=False, default=dict)  # V5KnowledgeTree

    # 发布状态
    status = Column(SQLEnum(ProjectStatus), nullable=False, default=ProjectStatus.draft)
    published_at = Column(DateTime, nullable=True)

    # 时间戳
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# Lesson (per knode)
# ---------------------------------------------------------------------------

class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint("project_slug", "knode_id", name="uq_lesson"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_slug = Column(String(128), ForeignKey("projects.slug", ondelete="CASCADE"), nullable=False, index=True)
    knode_id = Column(String(64), nullable=False)         # "M01" / "M02" / 等

    # 内容
    title = Column(String(256), nullable=False, default="")
    summary = Column(Text, nullable=True)
    plan_markdown = Column(Text, nullable=False, default="")
    rendered_sections = Column(JSON, nullable=False, default=dict)
    audio_scripts = Column(JSON, nullable=False, default=dict)
    assignment_md = Column(Text, nullable=False, default="")
    theories = Column(JSON, nullable=False, default=list)
    slides = Column(JSON, nullable=False, default=list)  # slides.json 的 slides 数组

    # 文件清单 (位置 + sha256, 实际文件在 media/)
    files = Column(JSON, nullable=False, default=list)    # [{path, sha256, size}]
    knode_dir = Column(String(256), nullable=False, default="")  # "knodes/M01-w1-xxx"

    # 跟 Project.version 同步
    version = Column(String(64), nullable=False, default="1.0.0")
    duration_minutes = Column(Integer, nullable=True)
    week = Column(Integer, nullable=True)
    stage = Column(String(64), nullable=True)


# ---------------------------------------------------------------------------
# Engine factory (lazy)
# ---------------------------------------------------------------------------

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        from .settings import DB_PATH, LIBRARY_HOME
        LIBRARY_HOME.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
    return _engine


def get_session():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine())
    return _SessionLocal()


def init_db() -> None:
    """启动时调一次, 创建表."""
    Base.metadata.create_all(bind=get_engine())
