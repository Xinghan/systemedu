"""Local SQLite storage for sessions, messages, and project data."""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

from systemedu.core.config import DB_FILE


class Base(DeclarativeBase):
    pass


class ChatSession(Base):
    """A conversation session."""

    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True)
    agent_name = Column(String(100), default="default")
    project_name = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    """A message within a session."""

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant, system, tool
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    session = relationship("ChatSession", back_populates="messages")


class LocalProject(Base):
    """A locally loaded project."""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    path = Column(String(500), nullable=False)  # Path to project directory
    category = Column(String(50), default="other")
    loaded_at = Column(DateTime, default=datetime.now)


_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(f"sqlite:///{DB_FILE}", echo=False)
        Base.metadata.create_all(_engine)
    return _engine


def get_session() -> Session:
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine())
    return _session_factory()


def reset_db():
    """Reset the database (for testing)."""
    global _engine, _session_factory
    _engine = None
    _session_factory = None
