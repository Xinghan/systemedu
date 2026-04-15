"""Project context loading and progress persistence."""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import yaml

from systemedu.education.models import (
    KnowledgeNode,
    KnowledgeTree,
    NodeStatus,
    Project,
    UserNodeProgress,
    V5KnowledgeTree,
)
from systemedu.education.progress import initialize_progress
from systemedu.education.services import parse_knowledge_tree
from systemedu.education.tree_adapter import v5_to_milestones_view

logger = logging.getLogger(__name__)


@dataclass
class ProjectContext:
    """Loaded project with tree, progress, and helpers."""

    project: Project
    tree: KnowledgeTree
    progress: list[UserNodeProgress]
    project_dir: Path
    v5_tree: V5KnowledgeTree = field(default_factory=V5KnowledgeTree)

    def all_nodes_flat(self) -> list[KnowledgeNode]:
        """Return all nodes across all milestones, in global index order."""
        nodes = []
        for ms in self.tree.milestones:
            nodes.extend(ms.knodes)
        return nodes

    def current_node(self) -> tuple[int, KnowledgeNode] | None:
        """Return the first AVAILABLE node (index, node)."""
        nodes = self.all_nodes_flat()
        for p in self.progress:
            if p.status == NodeStatus.AVAILABLE and p.knode_id < len(nodes):
                return (p.knode_id, nodes[p.knode_id])
        return None

    def available_nodes(self) -> list[tuple[int, KnowledgeNode]]:
        """Return all AVAILABLE nodes."""
        nodes = self.all_nodes_flat()
        result = []
        for p in self.progress:
            if p.status == NodeStatus.AVAILABLE and p.knode_id < len(nodes):
                result.append((p.knode_id, nodes[p.knode_id]))
        return result

    def get_node_by_id(self, idx: int) -> KnowledgeNode | None:
        """Get a node by its global index."""
        nodes = self.all_nodes_flat()
        if 0 <= idx < len(nodes):
            return nodes[idx]
        return None

    def get_node_progress(self, idx: int) -> UserNodeProgress | None:
        """Get progress for a node by global index."""
        for p in self.progress:
            if p.knode_id == idx:
                return p
        return None


def find_project_dir(name: str) -> Path:
    """Search for a project directory by name.

    Searches:
    1. ./projects/{name}
    2. ~/projects/{name}

    Raises FileNotFoundError if not found.
    """
    candidates = [
        Path.cwd() / "projects" / name,
        Path.home() / "projects" / name,
    ]
    for candidate in candidates:
        if candidate.is_dir() and (candidate / "project.yaml").exists():
            return candidate

    raise FileNotFoundError(
        f"Project '{name}' not found. Searched: {[str(c) for c in candidates]}"
    )


def _load_project_yaml(project_dir: Path) -> Project:
    """Load and parse project.yaml from a project directory."""
    yaml_path = project_dir / "project.yaml"
    if not yaml_path.exists():
        raise FileNotFoundError(f"project.yaml not found in {project_dir}")

    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    return Project.model_validate(data)


def _load_knowledge_tree(
    project_dir: Path, tree_path: str
) -> tuple[V5KnowledgeTree, KnowledgeTree]:
    """Load and parse a knowledge tree JSON file.

    Returns (v5_tree, milestones_view) tuple.
    Auto-detects format and converts to v5 if needed.
    """
    resolved = (project_dir / tree_path).resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"Knowledge tree not found: {resolved}")

    data = json.loads(resolved.read_text(encoding="utf-8"))
    v5_tree = parse_knowledge_tree(data)
    milestones_view = v5_to_milestones_view(v5_tree)
    return v5_tree, milestones_view


def load_progress(
    user_id: str, project_name: str, node_count: int
) -> list[UserNodeProgress] | None:
    """Load progress from SQLite. Returns None if no records exist."""
    try:
        from systemedu.storage.db import ProgressRecord, get_session

        session = get_session()
        try:
            records = (
                session.query(ProgressRecord)
                .filter_by(user_id=user_id, project_name=project_name)
                .order_by(ProgressRecord.knode_id)
                .all()
            )
            if not records:
                return None

            progresses = []
            for rec in records:
                progresses.append(
                    UserNodeProgress(
                        knode_id=rec.knode_id,
                        status=NodeStatus(rec.status),
                        attempts=rec.attempts,
                        best_score=int(rec.best_score),
                        passed_at=rec.passed_at,
                    )
                )
            return progresses
        finally:
            session.close()
    except Exception:
        logger.exception("Failed to load progress from DB")
        return None


def save_progress(
    user_id: str,
    project_name: str,
    progresses: list[UserNodeProgress],
) -> None:
    """Save progress to SQLite (upsert)."""
    try:
        from systemedu.storage.db import ProgressRecord, get_session

        session = get_session()
        try:
            for p in progresses:
                existing = (
                    session.query(ProgressRecord)
                    .filter_by(
                        user_id=user_id,
                        project_name=project_name,
                        knode_id=p.knode_id,
                    )
                    .first()
                )
                if existing:
                    existing.status = p.status.value
                    existing.attempts = p.attempts
                    existing.best_score = float(p.best_score)
                    existing.passed_at = p.passed_at
                else:
                    session.add(
                        ProgressRecord(
                            user_id=user_id,
                            project_name=project_name,
                            knode_id=p.knode_id,
                            status=p.status.value,
                            attempts=p.attempts,
                            best_score=float(p.best_score),
                            passed_at=p.passed_at,
                        )
                    )
            session.commit()
        finally:
            session.close()
    except Exception:
        logger.exception("Failed to save progress to DB")


def create_project(
    name: str,
    title: str,
    tree_data: dict,
    meta: dict | None = None,
) -> Path:
    """Create a new project on disk with project.yaml and knowledge_tree.json.

    Args:
        name: Project slug (e.g. "tree-leaf-ai").
        title: Human-readable project title.
        tree_data: Knowledge tree in milestones format (already converted).
        meta: Optional metadata dict (age_range, estimated_hours, etc.).

    Returns:
        Path to the created project directory.

    Raises:
        FileExistsError: If the project directory already exists.
    """
    project_dir = Path.cwd() / "projects" / name
    if project_dir.exists():
        raise FileExistsError(f"Project '{name}' already exists at {project_dir}")

    project_dir.mkdir(parents=True)

    # Build project.yaml data
    project_data = {
        "name": name,
        "title": title,
        "knowledge_tree": "./knowledge_tree.json",
    }
    if meta:
        for key in ("description", "category", "age_range", "estimated_hours", "tags"):
            if key in meta:
                project_data[key] = meta[key]

    (project_dir / "project.yaml").write_text(
        yaml.dump(project_data, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )

    # Write knowledge tree
    (project_dir / "knowledge_tree.json").write_text(
        json.dumps(tree_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return project_dir


def load_project_context(
    name: str,
    user_id: str = "default",
    project_dir: Path | None = None,
) -> ProjectContext:
    """Load a complete project context: project + tree + progress.

    Args:
        name: Project name to search for.
        user_id: User ID for progress tracking.
        project_dir: Override project directory (for testing).
    """
    if project_dir is None:
        project_dir = find_project_dir(name)

    project = _load_project_yaml(project_dir)
    v5_tree, tree = _load_knowledge_tree(project_dir, project.knowledge_tree_path)

    # Count total nodes
    node_count = sum(len(ms.knodes) for ms in tree.milestones)

    # Try loading existing progress
    progress = load_progress(user_id, name, node_count)
    if progress is None:
        progress = initialize_progress(tree)
        save_progress(user_id, name, progress)
    elif len(progress) < node_count:
        # Tree grew (new knodes added) — backfill missing records, respecting
        # prerequisites: a new knode is AVAILABLE only if all its prereqs are
        # already passed, otherwise LOCKED.
        existing_ids = {p.knode_id for p in progress}
        status_map = {p.knode_id: p.status for p in progress}
        flat_nodes: list = []
        for ms in tree.milestones:
            flat_nodes.extend(ms.knodes)
        for idx in range(node_count):
            if idx in existing_ids:
                continue
            node = flat_nodes[idx] if idx < len(flat_nodes) else None
            prereqs = list(getattr(node, "prerequisite_indices", []) or [])
            unlocked = bool(prereqs) and all(
                status_map.get(pi) == NodeStatus.PASSED for pi in prereqs
            )
            new_status = NodeStatus.AVAILABLE if unlocked else NodeStatus.LOCKED
            progress.append(UserNodeProgress(knode_id=idx, status=new_status))
            status_map[idx] = new_status
        progress.sort(key=lambda p: p.knode_id)
        save_progress(user_id, name, progress)

    return ProjectContext(
        project=project,
        v5_tree=v5_tree,
        tree=tree,
        progress=progress,
        project_dir=project_dir,
    )
