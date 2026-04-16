"""Tests for SkillBase + SkillConfig (spec 014 T3.1)."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from systemedu.tutor.skills import SkillBase, SkillConfig


# ---------------------------------------------------------------------------
# SkillConfig
# ---------------------------------------------------------------------------
class TestSkillConfig:
    def test_minimal_valid(self):
        c = SkillConfig(name="x", description="does x")
        assert c.name == "x"
        assert c.max_turns == 5
        assert c.priority == 50
        assert c.triggers == []
        assert c.tools == []
        assert c.body == ""
        assert c.path is None

    def test_accepts_full_frontmatter(self):
        c = SkillConfig(
            name="socratic",
            description="提问式",
            triggers=["概念理解类"],
            tools=["search_student_facts", "get_knode_content"],
            max_turns=5,
            priority=80,
            body="# body",
            path=Path("/tmp/SKILL.md"),
        )
        assert c.tools == ["search_student_facts", "get_knode_content"]
        assert c.path == Path("/tmp/SKILL.md")

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            SkillConfig(description="x")

    def test_empty_name_raises(self):
        with pytest.raises(ValidationError):
            SkillConfig(name="", description="x")

    def test_empty_description_raises(self):
        with pytest.raises(ValidationError):
            SkillConfig(name="x", description="")

    def test_max_turns_bounds(self):
        with pytest.raises(ValidationError):
            SkillConfig(name="x", description="d", max_turns=0)
        with pytest.raises(ValidationError):
            SkillConfig(name="x", description="d", max_turns=21)

    def test_priority_bounds(self):
        with pytest.raises(ValidationError):
            SkillConfig(name="x", description="d", priority=-1)
        with pytest.raises(ValidationError):
            SkillConfig(name="x", description="d", priority=101)

    def test_ignores_unknown_fields(self):
        """Frontmatter may carry fields we don't care about — don't crash."""
        c = SkillConfig(name="x", description="d", author="alice")
        assert c.name == "x"


# ---------------------------------------------------------------------------
# SkillBase
# ---------------------------------------------------------------------------
class _FakeSkill(SkillBase):
    """Minimal subclass that satisfies the ABC."""

    def build_subgraph(self, llm, tools):
        return "compiled-graph"


class TestSkillBase:
    def test_cannot_instantiate_abstract(self):
        with pytest.raises(TypeError):
            SkillBase(SkillConfig(name="x", description="d"))  # type: ignore[abstract]

    def test_subclass_instantiation(self):
        s = _FakeSkill(SkillConfig(name="socratic", description="d"))
        assert s.name == "socratic"
        assert s.config.max_turns == 5

    def test_build_subgraph_invoked(self):
        s = _FakeSkill(SkillConfig(name="x", description="d"))
        assert s.build_subgraph(llm=None, tools=[]) == "compiled-graph"


class TestSummarizeState:
    def test_default_with_turn_only(self):
        s = _FakeSkill(SkillConfig(name="socratic", description="d"))
        text = s.summarize_state({"turn_count": 3})
        assert "socratic" in text
        assert "turn 3" in text
        # no summary line
        assert "进展" not in text

    def test_with_summary(self):
        s = _FakeSkill(SkillConfig(name="socratic", description="d"))
        text = s.summarize_state({"turn_count": 2, "summary": "在引导归纳"})
        assert "进展" in text
        assert "在引导归纳" in text

    def test_with_last_step_fallback(self):
        """When no 'summary', fall back to 'last_step'."""
        s = _FakeSkill(SkillConfig(name="socratic", description="d"))
        text = s.summarize_state({"turn_count": 1, "last_step": "question_1"})
        assert "question_1" in text

    def test_empty_state(self):
        s = _FakeSkill(SkillConfig(name="socratic", description="d"))
        text = s.summarize_state({})
        assert "turn 0" in text
