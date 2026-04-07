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
    # v4.1 optional metadata
    module_id: str = ""
    module_role: str = ""
    core_question: str = ""
    acceptance_artifacts: list[dict] = Field(default_factory=list)
    acceptance_standard: list[str] = Field(default_factory=list)
    hands_on_components: list[str] = Field(default_factory=list)
    outputs_produced: list[str] = Field(default_factory=list)


class Milestone(BaseModel):
    """A major deliverable within a project."""

    id: int | None = None
    title: str
    description: str = ""
    order: int = 0
    xp_reward: int = 100
    knodes: list[KnowledgeNode] = Field(default_factory=list)


class SubProject(BaseModel):
    """A sub-project (stage) within a larger project."""

    id: str = ""  # "P0", "P1", ...
    title: str
    description: str = ""
    stage_id: str = ""  # "S0", "S1", ...
    milestone_indices: list[int] = Field(default_factory=list)
    prerequisite_sub_project_ids: list[str] = Field(default_factory=list)
    difficulty: int = 1
    estimated_hours: float = 0
    deliverables: list[str] = Field(default_factory=list)
    display_order: int = 50
    brief: str = ""
    task: str = ""
    core_problem: str = ""
    inputs: list[str] = Field(default_factory=list)
    data_usage: list[str] = Field(default_factory=list)
    demo_unit: str = ""
    why_separate: str = ""
    handover: dict = Field(default_factory=dict)
    acceptance_criteria: list[str] = Field(default_factory=list)


class KnowledgeTree(BaseModel):
    """A project's complete knowledge tree."""

    milestones: list[Milestone] = Field(default_factory=list)
    sub_projects: list[SubProject] = Field(default_factory=list)
    special_nodes: list[dict] = Field(default_factory=list)


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

    model_config = {"populate_by_name": True}

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
    knowledge_tree_path: str = Field(
        default="./knowledge_tree.json", alias="knowledge_tree"
    )


class Edge(BaseModel):
    """A directed relationship between two modules in the knowledge tree."""

    edge_id: str
    from_module_id: str
    to_module_id: str
    relation_type: str = ""
    what_is_transferred: str = ""
    reason: str = ""


class Module(BaseModel):
    """A learning module in the v5 knowledge tree (replaces KnowledgeNode)."""

    module_id: str
    title: str
    stage_id: str
    sequence_order: int = 0
    module_role: str = ""
    is_acceptance_unit: bool = True
    summary: str = ""
    detailed_description: str = ""
    mission_role: str = ""
    core_question: str = ""
    why_non_skippable: str = ""
    rough_learning_topics: list[str] = Field(default_factory=list)
    what_it_inherits: str = ""
    outputs_produced: list[str] = Field(default_factory=list)
    what_it_passes_forward: str = ""
    real_world_anchor: str = ""
    capstone_scope: str | None = None
    integrates_previous_stage_outputs: list[str] = Field(default_factory=list)
    hands_on_components: list[str] = Field(default_factory=list)
    engineering_practice_evidence: str = ""
    acceptance_artifacts: list[dict] = Field(default_factory=list)
    acceptance_standard: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    dependency_reason: str = ""
    estimated_duration_months: str | int | float = "1"
    knowledge_level: str = "K1"
    expansion_priority: str = ""


class Stage(BaseModel):
    """A learning stage in the v5 knowledge tree (replaces SubProject)."""

    stage_id: str
    title: str
    stage_goal: str = ""
    stage_description: str = ""
    why_this_stage_exists: str = ""
    concept_density_class: str = ""
    new_concept_count_estimate: str = ""
    module_count_reason: str = ""
    stage_output: str = ""
    closing_capstone_module_id: str = ""
    capstone_scope: str = ""
    capstone_reuses_outputs_from_stages: list[str] = Field(default_factory=list)
    capstone_hands_on_expectation: str = ""
    capstone_integration_reason: str = ""
    expansion_priority: str = ""


class V5KnowledgeTree(BaseModel):
    """Native v5 knowledge tree with stages, modules, and edges."""

    schema_version: str = "5.0"
    tree_type: str = ""
    title: str = ""
    description: str = ""
    stages: list[Stage] = Field(default_factory=list)
    modules: list[Module] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)
    special_nodes: list[dict] = Field(default_factory=list)
    project_identity: dict = Field(default_factory=dict)
    target_learner: dict = Field(default_factory=dict)
    project_positioning: dict = Field(default_factory=dict)
    decomposition_strategy: dict = Field(default_factory=dict)
    safety_boundaries: dict = Field(default_factory=dict)
    knowledge_levels: list[dict] = Field(default_factory=list)
    stage_relationship_rule: str = ""
    global_integration_rule: str = ""


class UserNodeProgress(BaseModel):
    """Track progress on a single knowledge node."""

    knode_id: int
    status: NodeStatus = NodeStatus.LOCKED
    attempts: int = 0
    best_score: int = 0
    ai_feedback: str = ""
    started_at: datetime | None = None
    passed_at: datetime | None = None
