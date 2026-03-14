"""Pydantic models for education data (migrated from Django ORM models)."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ContentType(str, Enum):
    TEXT = "text"
    INTERACTIVE = "interactive"
    CODE = "code"
    EXPERIMENT = "experiment"
    QUIZ = "quiz"
    VIDEO = "video"


class AcceptanceType(str, Enum):
    QUIZ = "quiz"
    CODE_SUBMIT = "code_submit"
    ESSAY = "essay"
    DEMO = "demo"
    PEER_REVIEW = "peer_review"
    AUTO = "auto"


class Category(str, Enum):
    AI = "ai"
    BIOTECH = "biotech"
    AEROSPACE = "aerospace"
    MUSIC = "music"
    CLIMATE = "climate"
    ROBOTICS = "robotics"
    CHEMISTRY = "chemistry"
    MATH = "math"
    CS = "cs"
    OTHER = "other"


class NodeStatus(str, Enum):
    LOCKED = "locked"
    AVAILABLE = "available"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    PASSED = "passed"
    FAILED = "failed"


class EnrollmentStatus(str, Enum):
    EXPLORING = "exploring"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class KnowledgeNode(BaseModel):
    """An atomic learning unit within a milestone."""

    id: int | None = None
    title: str
    summary: str = ""
    difficulty_level: int = Field(default=1, ge=1, le=10)
    content_type: ContentType = ContentType.TEXT
    acceptance_type: AcceptanceType = AcceptanceType.QUIZ
    estimated_minutes: int = 15
    xp_reward: int = 20
    order: int = 0
    prerequisite_indices: list[int] = Field(default_factory=list)


class Milestone(BaseModel):
    """A major deliverable within a project."""

    id: int | None = None
    title: str
    description: str = ""
    order: int = 0
    xp_reward: int = 100
    knodes: list[KnowledgeNode] = Field(default_factory=list)


class KnowledgeTree(BaseModel):
    """A project's complete knowledge tree."""

    milestones: list[Milestone] = Field(default_factory=list)


class ProjectAgentConfig(BaseModel):
    """Agent configuration within a project."""

    type: str = "builtin:tutor"
    llm: str | None = None
    skills: list[str] = Field(default_factory=list)
    mcp_servers: list[str] = Field(default_factory=list)


class ProjectMCPConfig(BaseModel):
    """MCP server configuration within a project."""

    command: str
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)


class Project(BaseModel):
    """A learning project."""

    name: str
    version: str = "0.1.0"
    title: str
    description: str = ""
    category: Category = Category.OTHER
    age_range: list[int] = Field(default_factory=lambda: [6, 18])
    estimated_hours: int = 10
    author: str = ""
    tags: list[str] = Field(default_factory=list)
    agents: dict[str, ProjectAgentConfig] = Field(default_factory=dict)
    mcp: dict[str, ProjectMCPConfig] = Field(default_factory=dict)
    knowledge_tree_path: str = "./knowledge_tree.json"


class UserNodeProgress(BaseModel):
    """Track progress on a single knowledge node."""

    knode_id: int
    status: NodeStatus = NodeStatus.LOCKED
    attempts: int = 0
    best_score: int = 0
    ai_feedback: str = ""
    started_at: datetime | None = None
    passed_at: datetime | None = None
