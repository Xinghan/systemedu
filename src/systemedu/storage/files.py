"""File system operations for project management."""

from pathlib import Path

import yaml

from systemedu.core.config import SYSTEMEDU_HOME


def get_projects_dir() -> Path:
    """Get the default projects directory."""
    return Path.home() / "projects"


def get_cache_dir() -> Path:
    """Get the Hub download cache directory."""
    cache = SYSTEMEDU_HOME / "hub_cache"
    cache.mkdir(parents=True, exist_ok=True)
    return cache


def load_project_yaml(project_dir: Path) -> dict:
    """Load and parse a project.yaml file."""
    project_file = project_dir / "project.yaml"
    if not project_file.exists():
        raise FileNotFoundError(f"No project.yaml found in {project_dir}")

    return yaml.safe_load(project_file.read_text(encoding="utf-8"))


def save_project_yaml(project_dir: Path, data: dict) -> None:
    """Save a project.yaml file."""
    project_dir.mkdir(parents=True, exist_ok=True)
    project_file = project_dir / "project.yaml"
    project_file.write_text(
        yaml.dump(data, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )


def init_project_skeleton(project_dir: Path, name: str) -> None:
    """Create a new project directory with skeleton files."""
    project_dir.mkdir(parents=True, exist_ok=True)

    # project.yaml
    project_data = {
        "name": name,
        "version": "0.1.0",
        "title": name,
        "description": "",
        "category": "other",
        "age_range": [6, 18],
        "estimated_hours": 10,
        "author": "",
        "tags": [],
        "agents": {
            "tutor": {
                "type": "builtin:tutor",
                "llm": "qwen",
            },
        },
        "mcp": {},
        "knowledge_tree": "./knowledge_tree.json",
    }
    save_project_yaml(project_dir, project_data)

    # Empty knowledge tree
    import json

    kt_file = project_dir / "knowledge_tree.json"
    kt_file.write_text(json.dumps({"milestones": []}, indent=2, ensure_ascii=False))

    # Subdirectories
    (project_dir / "skills").mkdir(exist_ok=True)
    (project_dir / "agents").mkdir(exist_ok=True)
    (project_dir / "mcp").mkdir(exist_ok=True)
    (project_dir / "artifacts").mkdir(exist_ok=True)
