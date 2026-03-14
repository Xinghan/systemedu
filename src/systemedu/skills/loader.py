"""SKILL.md parser and hierarchical skill loader."""

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class Skill:
    """A parsed skill definition."""

    name: str
    description: str = ""
    user_invocable: bool = False
    requires_env: list[str] = field(default_factory=list)
    content: str = ""  # The markdown body (system prompt)
    source_path: str = ""


def parse_skill_md(path: Path) -> Skill:
    """Parse a SKILL.md file into a Skill object.

    Format:
    ```markdown
    ---
    name: skill-name
    description: ...
    user-invocable: true
    requires:
      env:
        - ENV_VAR
    ---

    # Body content (system prompt)
    ...
    ```
    """
    text = path.read_text(encoding="utf-8")

    # Extract YAML frontmatter
    frontmatter = {}
    body = text
    fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if fm_match:
        frontmatter = yaml.safe_load(fm_match.group(1)) or {}
        body = fm_match.group(2).strip()

    requires = frontmatter.get("requires", {}) or {}
    return Skill(
        name=frontmatter.get("name", path.parent.name),
        description=frontmatter.get("description", ""),
        user_invocable=frontmatter.get("user-invocable", False),
        requires_env=requires.get("env", []),
        content=body,
        source_path=str(path),
    )


class SkillLoader:
    """Loads skills from multiple directories with priority ordering.

    Load order (highest priority first):
    1. Project-level: <project>/skills/
    2. User-level: ~/.systemedu/skills/
    3. Built-in: src/systemedu/skills/builtin/
    """

    def __init__(self):
        self._skills: dict[str, Skill] = {}

    def load_directory(self, path: Path, priority: int = 0) -> list[Skill]:
        """Load all SKILL.md files from a directory.

        Higher priority skills override lower priority ones with the same name.
        """
        loaded = []
        if not path.exists():
            return loaded

        for skill_dir in sorted(path.iterdir()):
            skill_file = skill_dir / "SKILL.md"
            if skill_dir.is_dir() and skill_file.exists():
                skill = parse_skill_md(skill_file)
                # Only override if same or higher priority
                if skill.name not in self._skills:
                    self._skills[skill.name] = skill
                    loaded.append(skill)

        return loaded

    def load_builtin(self) -> list[Skill]:
        """Load built-in skills from the package."""
        builtin_dir = Path(__file__).parent / "builtin"
        return self.load_directory(builtin_dir, priority=0)

    def get_skill(self, name: str) -> Skill | None:
        return self._skills.get(name)

    def list_skills(self) -> list[Skill]:
        return list(self._skills.values())
