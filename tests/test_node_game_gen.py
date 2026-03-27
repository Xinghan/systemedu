"""Node tests: GameGenAgent."""

import sys
import types
from dataclasses import dataclass
from unittest.mock import MagicMock

import pytest


@dataclass
class _FakeSpec:
    color_theme: str | None = None
    bg_gradient: list[str] | None = None


class _FakePlanner:
    def __init__(self, llm=None):
        self.llm = llm

    async def plan(self, **kwargs):
        return _FakeSpec()


class _FakeCompiler:
    def compile(self, spec):
        return "<!DOCTYPE html><html><head></head><body><div>game</div></body></html>"


class TestGameGenNode:
    @pytest.mark.asyncio
    async def test_generate_injects_style_kit(self, monkeypatch):
        from systemedu.agents.builtin.game_gen_agent import GameGenAgent

        fake_planner_module = types.SimpleNamespace(GameSpecPlannerAgent=_FakePlanner)
        fake_compiler_module = types.SimpleNamespace(GameCompiler=_FakeCompiler)
        monkeypatch.setitem(
            sys.modules,
            "systemedu.agents.builtin.gameagent.planner",
            fake_planner_module,
        )
        monkeypatch.setitem(
            sys.modules,
            "systemedu.agents.builtin.gameagent.compiler",
            fake_compiler_module,
        )

        html = await GameGenAgent(MagicMock()).generate(
            detail_plan={
                "game_mechanic": "simulation",
                "game_concept": "理解因果",
                "game_title": "实验",
                "style_key": "concept_lab_clean",
            },
            node_title="力",
            node_summary="力学",
            difficulty=3,
        )
        assert "edu-game-style-kit" in html
        assert "--accent" in html
