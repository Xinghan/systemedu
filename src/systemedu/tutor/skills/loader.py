"""SkillLoader for the tutor runtime (spec 014 T3.2, design §7.2).

Scans one or more directories for `SKILL.md` files, parses their YAML
frontmatter into `SkillConfig`, and returns `SkillBase` instances ready
to hand to the main graph.

Search-path semantics (design §7.2):

1. `projects/<project>/skills/` — project-specific overrides
2. `src/systemedu/tutor/skills/` — built-in skills

The first match for a given skill `name` wins (project overrides
built-in). Later duplicates are silently skipped — the loader logs but
does not raise, so a half-configured project never takes the whole
tutor down.

Layout convention per skill directory:

    skills/
      socratic-questioning/
        SKILL.md      <- frontmatter + prompt body
        skill.py      <- class SocraticSkill(SkillBase)

The skill.py must export a class named after the skill (snake→camel +
`Skill` suffix) or set a module-level `SKILL_CLASS`. `loader.scan()`
imports the module, locates the class, and returns
`SkillClass(config)`.
"""

from __future__ import annotations

import importlib
import importlib.util
import logging
import re
import sys
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from .base import SkillBase, SkillConfig

log = logging.getLogger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


class SkillLoadError(Exception):
    """Raised when a specific SKILL.md can't be parsed into a SkillConfig."""


def _parse_skill_md(path: Path) -> SkillConfig:
    """Parse a SKILL.md into a SkillConfig, preserving body markdown."""
    text = path.read_text(encoding="utf-8")
    m = _FRONTMATTER_RE.match(text)
    if not m:
        raise SkillLoadError(f"{path}: missing YAML frontmatter")
    try:
        meta = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        raise SkillLoadError(f"{path}: invalid YAML frontmatter — {e}") from e
    if not isinstance(meta, dict):
        raise SkillLoadError(f"{path}: frontmatter must be a mapping")
    body = m.group(2).strip()
    try:
        return SkillConfig(**meta, body=body, path=path)
    except ValidationError as e:
        raise SkillLoadError(f"{path}: invalid SkillConfig — {e}") from e


def _snake_to_camel_class(name: str) -> str:
    """`socratic-questioning` → `SocraticQuestioningSkill`."""
    parts = re.split(r"[-_]", name)
    return "".join(p.capitalize() for p in parts if p) + "Skill"


def _load_skill_class(skill_dir: Path, config: SkillConfig) -> type[SkillBase]:
    """Import the skill.py in `skill_dir` and locate the concrete class."""
    module_path = skill_dir / "skill.py"
    if not module_path.exists():
        raise SkillLoadError(
            f"{skill_dir}: missing skill.py for skill '{config.name}'"
        )
    mod_name = f"_tutor_skill_{config.name.replace('-', '_')}_{id(skill_dir)}"
    spec = importlib.util.spec_from_file_location(mod_name, module_path)
    if spec is None or spec.loader is None:
        raise SkillLoadError(f"{module_path}: cannot create module spec")
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        raise SkillLoadError(f"{module_path}: import failed — {e}") from e

    cls = getattr(module, "SKILL_CLASS", None)
    if cls is None:
        cls = getattr(module, _snake_to_camel_class(config.name), None)
    if cls is None or not isinstance(cls, type) or not issubclass(cls, SkillBase):
        raise SkillLoadError(
            f"{module_path}: no SkillBase subclass named "
            f"`SKILL_CLASS` or `{_snake_to_camel_class(config.name)}`"
        )
    return cls


class SkillLoader:
    """Discovers and instantiates skills across prioritised search paths."""

    def __init__(self, search_paths: list[Path | str]):
        self.search_paths: list[Path] = [Path(p) for p in search_paths]
        self._skills: dict[str, SkillBase] = {}
        self._scanned = False

    def scan(self) -> list[SkillBase]:
        """Load every skill found along the search paths (first wins).

        Safe to call multiple times — subsequent calls reuse the cached
        result. Use `reset()` if you need to rescan after mutating the
        file tree (e.g. tests).
        """
        if self._scanned:
            return list(self._skills.values())

        for root in self.search_paths:
            if not root.exists() or not root.is_dir():
                continue
            for entry in sorted(root.iterdir()):
                if not entry.is_dir():
                    continue
                skill_md = entry / "SKILL.md"
                if not skill_md.exists():
                    continue
                try:
                    cfg = _parse_skill_md(skill_md)
                except SkillLoadError as e:
                    log.warning("skipping invalid skill at %s: %s", entry, e)
                    continue
                if cfg.name in self._skills:
                    log.info(
                        "skill '%s' already loaded from %s; ignoring %s",
                        cfg.name,
                        self._skills[cfg.name].config.path,
                        skill_md,
                    )
                    continue
                try:
                    cls = _load_skill_class(entry, cfg)
                except SkillLoadError as e:
                    log.warning("skipping skill '%s': %s", cfg.name, e)
                    continue
                self._skills[cfg.name] = cls(cfg)

        self._scanned = True
        return list(self._skills.values())

    def get(self, name: str) -> SkillBase | None:
        if not self._scanned:
            self.scan()
        return self._skills.get(name)

    def list_all(self) -> list[SkillBase]:
        return self.scan()

    def reset(self) -> None:
        self._skills.clear()
        self._scanned = False


__all__ = ["SkillLoader", "SkillLoadError"]
