"""Local SQLite storage for sessions, messages, and project data."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
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
    # spec 014: tutor 记忆系统字段
    user_id = Column(String(100), nullable=True, index=True)
    knode_id = Column(String(100), nullable=True)
    active_skill = Column(String(50), nullable=True)
    skill_turn_count = Column(Integer, default=0)
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


class CapstoneSubmission(Base):
    """Tracks capstone assignment submissions, file uploads, and AI grading."""

    __tablename__ = "capstone_submissions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "project_name", "knode_id", "attempt",
            name="uq_capstone_sub",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default")
    project_name = Column(String(200), nullable=False)
    knode_id = Column(Integer, nullable=False)
    attempt = Column(Integer, nullable=False, default=1)
    checklist_json = Column(Text, default="[]")     # [{artifact_id, checked}]
    reflections_json = Column(Text, default="[]")   # [{criterion_idx, description}]
    file_url = Column(Text, default="")
    file_name = Column(String(500), default="")
    file_size = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    max_score = Column(Float, default=0.0)
    feedback_json = Column(Text, default="[]")      # [{criterion_idx, score, max_score, feedback}]
    status = Column(String(20), default="submitted")  # submitted | grading | graded
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
    content_type = Column(String(20), default="text")
    generated_at = Column(DateTime, nullable=True)
    # Course (step-based learning) fields
    course_manifest = Column(Text, default="")   # CourseManifest JSON
    course_steps = Column(Text, default="")      # Generated steps JSON array
    # Course v2 (multi-agent pipeline) field
    course_content = Column(Text, default="")    # CourseContent JSON (new pipeline)


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


class CareerPathRecord(Base):
    """A locally loaded career path."""

    __tablename__ = "career_paths"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    path = Column(String(500), nullable=False)  # Filesystem path to path directory
    category = Column(String(50), default="other")
    loaded_at = Column(DateTime, default=datetime.now)


class CareerPathProgress(Base):
    """User progress on a career path."""

    __tablename__ = "career_path_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "path_name", name="uq_career_progress"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default")
    path_name = Column(String(200), nullable=False)
    current_stage = Column(Integer, default=0)
    current_avatar_stage = Column(Integer, default=0)
    total_xp = Column(Integer, default=0)
    status = Column(String(20), default="active")  # active / completed
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class EarnedBadge(Base):
    """Badge earned by completing a career path stage."""

    __tablename__ = "earned_badges"
    __table_args__ = (
        UniqueConstraint("user_id", "path_name", "stage_order", name="uq_earned_badge"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, default="default")
    path_name = Column(String(200), nullable=False)
    stage_order = Column(Integer, nullable=False)
    badge_name = Column(String(200), nullable=False)
    earned_at = Column(DateTime, default=datetime.now)


class StudentFact(Base):
    """Structured student fact with supersede chain (spec 014)."""

    __tablename__ = "student_facts"
    __table_args__ = (
        Index("ix_sf_user_current", "user_id", "valid_to"),
        Index("ix_sf_user_knode_category", "user_id", "knode_id", "category"),
        Index("ix_sf_project_current", "project_name", "valid_to"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(String(100), nullable=False, index=True)
    project_name = Column(String(200), nullable=True, index=True)
    knode_id = Column(String(100), nullable=True, index=True)

    category = Column(String(30), nullable=False)
    # interest / knowledge / struggle / goal / context
    content = Column(Text, nullable=False)
    confidence = Column(Float, default=0.7)

    fact_metadata = Column(JSON, default=dict)

    valid_from = Column(DateTime, default=datetime.utcnow, nullable=False)
    valid_to = Column(DateTime, nullable=True, index=True)
    superseded_by = Column(Integer, ForeignKey("student_facts.id"), nullable=True)

    source_session_id = Column(String(36), nullable=True)
    extracted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PendingFactExtraction(Base):
    """Queue of sessions awaiting fact extraction (spec 014)."""

    __tablename__ = "pending_fact_extraction"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), nullable=False, unique=True)
    user_id = Column(String(100), nullable=False)
    first_unextracted_msg_id = Column(Integer, nullable=True)
    last_message_at = Column(DateTime, nullable=False)

    status = Column(String(20), default="pending")
    # pending / processing / done / failed
    retry_count = Column(Integer, default=0)
    error_msg = Column(Text, nullable=True)

    enqueued_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class ToolCallLog(Base):
    """Audit log for tool invocations (spec 014 §8.2)."""

    __tablename__ = "tool_call_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), index=True)
    session_id = Column(String(36), index=True)
    active_skill = Column(String(50), nullable=True)
    tool_name = Column(String(50), nullable=False)
    args_json = Column(JSON, default=dict)
    result_json = Column(JSON, default=dict)
    approved = Column(Boolean, nullable=True)
    called_at = Column(DateTime, default=datetime.utcnow)
    latency_ms = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)


class Escalation(Base):
    """Human-intervention markers (spec 014 §8.4)."""

    __tablename__ = "escalations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), index=True)
    session_id = Column(String(36))
    reason = Column(Text, nullable=False)
    severity = Column(String(10), default="warn")  # info/warn/urgent
    status = Column(String(20), default="open")    # open/handled/closed
    handled_by = Column(String(100), nullable=True)
    handled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


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
        ("lesson_content", "course_manifest", "TEXT DEFAULT ''"),
        ("lesson_content", "course_steps", "TEXT DEFAULT ''"),
        ("lesson_content", "course_content", "TEXT DEFAULT ''"),
        ("projects", "cover_image_url", "TEXT DEFAULT ''"),
        ("career_path_progress", "total_xp", "INTEGER DEFAULT 0"),
        # spec 014: tutor 记忆系统 sessions 扩展列
        ("sessions", "user_id", "VARCHAR(100)"),
        ("sessions", "knode_id", "VARCHAR(100)"),
        ("sessions", "active_skill", "VARCHAR(50)"),
        ("sessions", "skill_turn_count", "INTEGER DEFAULT 0"),
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

        # Create capstone_submissions table if it doesn't exist
        if not inspector.has_table("capstone_submissions"):
            conn.execute(sa.text("""
                CREATE TABLE capstone_submissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR(100) NOT NULL DEFAULT 'default',
                    project_name VARCHAR(200) NOT NULL,
                    knode_id INTEGER NOT NULL,
                    attempt INTEGER NOT NULL DEFAULT 1,
                    checklist_json TEXT DEFAULT '[]',
                    reflections_json TEXT DEFAULT '[]',
                    file_url TEXT DEFAULT '',
                    file_name VARCHAR(500) DEFAULT '',
                    file_size INTEGER DEFAULT 0,
                    score FLOAT DEFAULT 0.0,
                    max_score FLOAT DEFAULT 0.0,
                    feedback_json TEXT DEFAULT '[]',
                    status VARCHAR(20) DEFAULT 'submitted',
                    submitted_at DATETIME,
                    graded_at DATETIME,
                    UNIQUE(user_id, project_name, knode_id, attempt)
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
