"""Tests for SkillLoader (spec 014 T3.2).

Each test writes a tiny skill tree to `tmp_path` and checks that the
loader finds / parses / prioritises correctly. We don't actually build
a LangGraph — every fake skill returns a sentinel from build_subgraph.
"""

from __future__ import annotations

from pathlib import Path
from textwrap import dedent

import pytest

from systemedu.core.tutor.skills import SkillBase, SkillConfig, SkillLoader


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
FAKE_SKILL_PY = dedent('''
    """Fake skill used in loader tests."""
    from systemedu.core.tutor.skills import SkillBase

    class __CLS__(SkillBase):
        def build_subgraph(self, llm, tools):
            return f"compiled::{self.config.name}"
''').lstrip()


def _render_skill_py(cls_name: str) -> str:
    return FAKE_SKILL_PY.replace("__CLS__", cls_name)


def _write_skill(
    root: Path,
    name: str,
    *,
    description: str = "desc",
    triggers: list[str] | None = None,
    tools: list[str] | None = None,
    max_turns: int = 5,
    body: str = "prompt body",
    cls_name: str | None = None,
    extra_frontmatter: str = "",
) -> Path:
    """Create a skill directory with SKILL.md + skill.py."""
    skill_dir = root / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    fm_lines = [
        f"name: {name}",
        f"description: {description}",
        f"max_turns: {max_turns}",
    ]
    if triggers:
        fm_lines.append("triggers:")
        fm_lines.extend(f"  - {t}" for t in triggers)
    if tools:
        fm_lines.append("tools:")
        fm_lines.extend(f"  - {t}" for t in tools)
    if extra_frontmatter:
        fm_lines.append(extra_frontmatter)
    frontmatter = "\n".join(fm_lines)
    (skill_dir / "SKILL.md").write_text(
        f"---\n{frontmatter}\n---\n\n{body}\n",
        encoding="utf-8",
    )
    cls_name = cls_name or "".join(p.capitalize() for p in name.split("-")) + "Skill"
    (skill_dir / "skill.py").write_text(
        _render_skill_py(cls_name),
        encoding="utf-8",
    )
    return skill_dir


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
class TestParsing:
    def test_loads_single_skill(self, tmp_path):
        _write_skill(tmp_path, "socratic-questioning",
                     triggers=["概念问题"], tools=["get_knode_content"])
        loader = SkillLoader([tmp_path])
        skills = loader.scan()
        assert len(skills) == 1
        s = skills[0]
        assert s.config.name == "socratic-questioning"
        assert s.config.triggers == ["概念问题"]
        assert s.config.tools == ["get_knode_content"]
        assert s.config.body.startswith("prompt body")
        assert s.config.path is not None

    def test_parses_body_markdown(self, tmp_path):
        _write_skill(tmp_path, "s1", body="# Title\nSome body content.")
        loader = SkillLoader([tmp_path])
        s = loader.scan()[0]
        assert "Title" in s.config.body
        assert "body content" in s.config.body

    def test_defaults_applied(self, tmp_path):
        _write_skill(tmp_path, "defaulted", max_turns=5)
        loader = SkillLoader([tmp_path])
        s = loader.scan()[0]
        assert s.config.max_turns == 5
        assert s.config.priority == 50
        assert s.config.triggers == []
        assert s.config.tools == []

    def test_ignores_unknown_fields(self, tmp_path):
        _write_skill(tmp_path, "s2", extra_frontmatter="author: alice")
        loader = SkillLoader([tmp_path])
        skills = loader.scan()
        assert len(skills) == 1


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------
class TestValidationErrors:
    def test_missing_frontmatter_skipped(self, tmp_path, caplog):
        skill_dir = tmp_path / "broken"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# Just markdown, no frontmatter\n")
        (skill_dir / "skill.py").write_text(
            _render_skill_py("BrokenSkill"),
        )
        loader = SkillLoader([tmp_path])
        skills = loader.scan()
        assert skills == []

    def test_missing_required_name(self, tmp_path, caplog):
        skill_dir = tmp_path / "no-name"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "---\ndescription: missing name\n---\n\nbody\n",
        )
        (skill_dir / "skill.py").write_text(
            _render_skill_py("NoNameSkill"),
        )
        loader = SkillLoader([tmp_path])
        assert loader.scan() == []

    def test_missing_skill_py_skipped(self, tmp_path):
        skill_dir = tmp_path / "no-py"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "---\nname: no-py\ndescription: d\n---\n\nbody\n",
        )
        loader = SkillLoader([tmp_path])
        assert loader.scan() == []

    def test_invalid_yaml_skipped(self, tmp_path):
        skill_dir = tmp_path / "badyaml"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "---\nname: x\n  bad: indent: here\n---\n\nbody\n",
        )
        (skill_dir / "skill.py").write_text(
            _render_skill_py("XSkill"),
        )
        loader = SkillLoader([tmp_path])
        assert loader.scan() == []


# ---------------------------------------------------------------------------
# Override precedence
# ---------------------------------------------------------------------------
class TestOverride:
    def test_project_overrides_builtin(self, tmp_path):
        project_root = tmp_path / "project"
        builtin_root = tmp_path / "builtin"
        _write_skill(project_root, "socratic-questioning",
                     description="project version", max_turns=7)
        _write_skill(builtin_root, "socratic-questioning",
                     description="builtin version", max_turns=5)

        loader = SkillLoader([project_root, builtin_root])
        skills = loader.scan()
        assert len(skills) == 1
        assert skills[0].config.description == "project version"
        assert skills[0].config.max_turns == 7

    def test_builtin_wins_when_no_project_override(self, tmp_path):
        project_root = tmp_path / "project"
        builtin_root = tmp_path / "builtin"
        _write_skill(builtin_root, "direct-instruction",
                     description="builtin only")

        loader = SkillLoader([project_root, builtin_root])
        skills = loader.scan()
        assert len(skills) == 1
        assert skills[0].config.description == "builtin only"

    def test_nonexistent_path_tolerated(self, tmp_path):
        """A missing project/skills/ dir shouldn't blow up scan()."""
        builtin = tmp_path / "builtin"
        _write_skill(builtin, "s")
        loader = SkillLoader([tmp_path / "does-not-exist", builtin])
        assert len(loader.scan()) == 1


# ---------------------------------------------------------------------------
# Instantiation
# ---------------------------------------------------------------------------
class TestInstantiation:
    def test_get_by_name(self, tmp_path):
        _write_skill(tmp_path, "s1")
        _write_skill(tmp_path, "s2")
        loader = SkillLoader([tmp_path])
        s2 = loader.get("s2")
        assert s2 is not None
        assert s2.config.name == "s2"

    def test_returns_skillbase_subclass(self, tmp_path):
        _write_skill(tmp_path, "xyz")
        loader = SkillLoader([tmp_path])
        skill = loader.get("xyz")
        assert isinstance(skill, SkillBase)

    def test_build_subgraph_works_on_loaded(self, tmp_path):
        _write_skill(tmp_path, "xyz")
        loader = SkillLoader([tmp_path])
        s = loader.get("xyz")
        assert s.build_subgraph(llm=None, tools=[]) == "compiled::xyz"

    def test_scan_caches(self, tmp_path):
        _write_skill(tmp_path, "a")
        loader = SkillLoader([tmp_path])
        first = loader.scan()
        second = loader.scan()
        assert first == second  # same instances, cached

    def test_reset_rescans(self, tmp_path):
        _write_skill(tmp_path, "a")
        loader = SkillLoader([tmp_path])
        assert len(loader.scan()) == 1
        _write_skill(tmp_path, "b")
        # without reset, new skill invisible
        assert len(loader.scan()) == 1
        loader.reset()
        assert len(loader.scan()) == 2


# ---------------------------------------------------------------------------
# Missing SkillBase subclass
# ---------------------------------------------------------------------------
class TestClassResolution:
    def test_explicit_skill_class_attr(self, tmp_path):
        """`SKILL_CLASS = MyImpl` takes precedence over the auto-named class."""
        d = tmp_path / "override"
        d.mkdir()
        (d / "SKILL.md").write_text(
            "---\nname: override\ndescription: d\n---\n\nbody\n",
        )
        (d / "skill.py").write_text(dedent('''
            from systemedu.core.tutor.skills import SkillBase
            class SomethingElse(SkillBase):
                def build_subgraph(self, llm, tools):
                    return "via-SKILL_CLASS"
            SKILL_CLASS = SomethingElse
        '''))
        loader = SkillLoader([tmp_path])
        s = loader.get("override")
        assert s is not None
        assert s.build_subgraph(None, []) == "via-SKILL_CLASS"

    def test_no_matching_class_skipped(self, tmp_path, caplog):
        d = tmp_path / "nomatch"
        d.mkdir()
        (d / "SKILL.md").write_text(
            "---\nname: nomatch\ndescription: d\n---\n\nbody\n",
        )
        (d / "skill.py").write_text("# no skill class at all\n")
        loader = SkillLoader([tmp_path])
        assert loader.scan() == []
