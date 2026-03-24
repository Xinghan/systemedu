"""Local SQLite storage for sessions, messages, and project data."""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
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
    cover_image_url = Column(Text, default="")
    loaded_at = Column(DateTime, default=datetime.now)


class ProgressRecord(Base):
    """Persisted progress for a knowledge node."""

    __tablename__ = "progress"
    __table_args__ = (
        UniqueConstraint("user_id", "project_name", "knode_id", name="uq_progress"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default")
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="locked")
    attempts = Column(Integer, default=0)
    best_score = Column(Float, default=0.0)
    passed_at = Column(DateTime, nullable=True)


class NodeContextCache(Base):
    """Cached AI-generated knowledge context for a node."""

    __tablename__ = "node_context_cache"
    __table_args__ = (
        UniqueConstraint("project_name", "knode_id", name="uq_node_context"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    prerequisites_trace = Column(Text, default="")
    learning_suggestions = Column(Text, default="")
    related_extensions = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)


class Enrollment(Base):
    """Tracks user enrollment and learning progress for a project."""

    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("user_id", "project_name", name="uq_enrollment"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default")
    project_name = Column(String(200), nullable=False)
    status = Column(String(20), nullable=False, default="active")  # active, paused, completed
    started_at = Column(DateTime, nullable=True)
    last_activity_at = Column(DateTime, nullable=True)
    total_time_seconds = Column(Integer, default=0)
    nodes_passed = Column(Integer, default=0)
    total_nodes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)


class Highlight(Base):
    """User text highlight / annotation on lesson content."""

    __tablename__ = "highlights"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "project_name", "knode_id", "tab", "page_index", "text",
            name="uq_highlight",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default")
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    tab = Column(String(20), nullable=False)  # concept/examples/code_samples/...
    page_index = Column(Integer, default=0)
    text = Column(Text, nullable=False)
    start_offset = Column(Integer, nullable=False)
    end_offset = Column(Integer, nullable=False)
    note = Column(Text, default="")
    color = Column(String(20), default="yellow")
    created_at = Column(DateTime, default=datetime.now)


class PracticeSubmission(Base):
    """Tracks user practice exercise submissions and AI grading results."""

    __tablename__ = "practice_submissions"
    __table_args__ = (
        UniqueConstraint("user_id", "project_name", "knode_id", "attempt", name="uq_submission"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default")
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    attempt = Column(Integer, nullable=False, default=1)
    answers_json = Column(Text, nullable=False)       # [{exercise_idx, user_answer}]
    score = Column(Float, default=0)
    total_points = Column(Float, default=0)
    feedback_json = Column(Text, default="")           # AI grading result
    status = Column(String(20), default="submitted")   # submitted | graded
    submitted_at = Column(DateTime, default=datetime.now)
    graded_at = Column(DateTime, nullable=True)


class LessonGenerationProgress(Base):
    """Tracks step-by-step progress of lesson generation pipeline."""

    __tablename__ = "lesson_generation_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    step_name = Column(String(50), nullable=False)
    step_label = Column(String(100), nullable=False)
    status = Column(String(20), default="pending")
    agent_name = Column(String(50), default="")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    output_preview = Column(Text, default="")


class LessonContent(Base):
    """AI-generated lesson content for a knowledge node."""

    __tablename__ = "lesson_content"
    __table_args__ = (
        UniqueConstraint("project_name", "knode_id", name="uq_lesson_content"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    concept = Column(Text, default="")
    examples = Column(Text, default="")
    code_samples = Column(Text, default="")
    practice = Column(Text, default="")
    key_takeaways = Column(Text, default="")
    quiz_data = Column(Text, default="")
    interactive_lab = Column(Text, default="")
    lesson_plan_json = Column(Text, default="")
    teacher_script = Column(Text, default="")
    teacher_audio_url = Column(Text, default="")
    teacher_timestamps = Column(Text, default="")
    # Per-tab audio URLs (section narration)
    concept_audio_url = Column(Text, default="")
    practice_audio_url = Column(Text, default="")
    lab_audio_url = Column(Text, default="")
    key_takeaways_audio_url = Column(Text, default="")
    project_assignment = Column(Text, default="")
    # When interactive_lab cannot be generated because the object isn't in the
    # Registry yet, this field stores the pending object_key (e.g. "triangle.basic").
    # ObjectFactory sets it to "" once the object is ready and the lab is regenerated.
    interactive_lab_pending_object = Column(String(200), default="")
    content_type = Column(String(20), default="text")
    generated_at = Column(DateTime, nullable=True)


class NodeResource(Base):
    """Search result resource for a knowledge node."""

    __tablename__ = "node_resources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    source_type = Column(String(20), nullable=False)   # "web" | "youtube"
    title = Column(String(500), nullable=False)
    url = Column(String(1000), nullable=False)
    snippet = Column(Text, default="")
    score = Column(Float, default=0.0)
    saved = Column(Integer, default=0)                 # 0=unsaved, 1=saved
    searched_at = Column(DateTime, default=datetime.now)
    saved_at = Column(DateTime, nullable=True)


class NodeSearchStatus(Base):
    """Tracks search state for a knowledge node."""

    __tablename__ = "node_search_status"
    __table_args__ = (
        UniqueConstraint("project_name", "knode_id", name="uq_search_status"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="idle")  # idle|searching|done|failed
    searched_at = Column(DateTime, nullable=True)
    error = Column(Text, default="")


class LessonQueueItem(Base):
    """Tracks batch lesson pre-generation queue items."""

    __tablename__ = "lesson_queue"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    knode_title = Column(String(500), default="")
    batch_id = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")  # pending|generating|done|failed|skipped
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error = Column(Text, default="")


class UserNote(Base):
    """User Markdown note for a knowledge node."""

    __tablename__ = "user_notes"
    __table_args__ = (
        UniqueConstraint("user_id", "project_name", "knode_id", name="uq_user_note"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default")
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)


_engine = None
_session_factory = None


def _migrate_schema(engine):
    """Add missing columns to existing tables (lightweight auto-migration)."""
    import sqlalchemy as sa

    inspector = sa.inspect(engine)

    # Map: (table_name, column_name, column_DDL)
    expected_columns = [
        ("lesson_content", "interactive_lab", "TEXT DEFAULT ''"),
        ("lesson_content", "lesson_plan_json", "TEXT DEFAULT ''"),
        ("lesson_content", "teacher_script", "TEXT DEFAULT ''"),
        ("lesson_content", "teacher_audio_url", "TEXT DEFAULT ''"),
        ("lesson_content", "teacher_timestamps", "TEXT DEFAULT ''"),
        ("lesson_content", "concept_audio_url", "TEXT DEFAULT ''"),
        ("lesson_content", "practice_audio_url", "TEXT DEFAULT ''"),
        ("lesson_content", "lab_audio_url", "TEXT DEFAULT ''"),
        ("lesson_content", "key_takeaways_audio_url", "TEXT DEFAULT ''"),
        ("lesson_content", "project_assignment", "TEXT DEFAULT ''"),
        ("lesson_content", "interactive_lab_pending_object", "VARCHAR(200) DEFAULT ''"),
        ("projects", "cover_image_url", "TEXT DEFAULT ''"),
    ]

    with engine.connect() as conn:
        for table, col, ddl in expected_columns:
            if inspector.has_table(table):
                existing = {c["name"] for c in inspector.get_columns(table)}
                if col not in existing:
                    conn.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))
                    conn.commit()

        # Create lesson_queue table if it doesn't exist (handled by create_all, but ensure schema)
        if not inspector.has_table("lesson_queue"):
            conn.execute(sa.text("""
                CREATE TABLE lesson_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name VARCHAR(200) NOT NULL,
                    knode_id INTEGER NOT NULL,
                    knode_title VARCHAR(500) DEFAULT '',
                    batch_id INTEGER NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at DATETIME,
                    started_at DATETIME,
                    completed_at DATETIME,
                    error TEXT DEFAULT ''
                )
            """))
            conn.commit()


def get_engine():
    global _engine
    if _engine is None:
        DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(f"sqlite:///{DB_FILE}", echo=False)
        Base.metadata.create_all(_engine)
        _migrate_schema(_engine)
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
