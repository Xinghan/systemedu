"""Tests for skills system."""

from pathlib import Path

import pytest

from systemedu.core.skills.loader import SkillLoader, parse_skill_md


@pytest.fixture
def sample_skill_dir(tmp_path):
    """Create a sample skill directory with SKILL.md."""
    skill_dir = tmp_path / "test-skill"
    skill_dir.mkdir()
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text("""---
name: test-skill
description: A test skill
user-invocable: true
requires:
  env:
    - TEST_API_KEY
---

# Test Skill

This is the skill body content.

## Instructions

Do something useful.
""")
    return skill_dir


class TestParseSkillMd:
    def test_parse_skill(self, sample_skill_dir):
        skill = parse_skill_md(sample_skill_dir / "SKILL.md")
        assert skill.name == "test-skill"
        assert skill.description == "A test skill"
        assert skill.user_invocable is True
        assert "TEST_API_KEY" in skill.requires_env
        assert "Test Skill" in skill.content
        assert "Instructions" in skill.content

    def test_parse_skill_no_frontmatter(self, tmp_path):
        skill_dir = tmp_path / "simple"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# Just a body\nNo frontmatter here.")

        skill = parse_skill_md(skill_dir / "SKILL.md")
        assert skill.name == "simple"  # Falls back to directory name
        assert "Just a body" in skill.content


class TestSkillLoader:
    def test_load_directory(self, sample_skill_dir):
        loader = SkillLoader()
        loaded = loader.load_directory(sample_skill_dir.parent)
        assert len(loaded) == 1
        assert loaded[0].name == "test-skill"

    def test_load_builtin(self):
        loader = SkillLoader()
        loaded = loader.load_builtin()
        names = [s.name for s in loaded]
        assert "tutor" in names
        assert "assessor" in names
        assert "planner" in names

    def test_list_skills(self, sample_skill_dir):
        loader = SkillLoader()
        loader.load_directory(sample_skill_dir.parent)
        skills = loader.list_skills()
        assert len(skills) >= 1

    def test_get_skill(self, sample_skill_dir):
        loader = SkillLoader()
        loader.load_directory(sample_skill_dir.parent)
        skill = loader.get_skill("test-skill")
        assert skill is not None
        assert skill.name == "test-skill"

    def test_nonexistent_directory(self):
        loader = SkillLoader()
        loaded = loader.load_directory(Path("/nonexistent/dir"))
        assert loaded == []
