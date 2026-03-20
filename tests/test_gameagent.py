"""Tests for GameAgent V1 pipeline: spec, validator, compiler, planner."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from systemedu.agents.builtin.gameagent.compiler import GameCompiler
from systemedu.agents.builtin.gameagent.spec import GameFeedback, GameLevel, GameRules, GameSpec
from systemedu.agents.builtin.gameagent.validator import GameSpecValidator


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_drag_sort_spec(**overrides) -> GameSpec:
    data = dict(
        mechanic="drag_sort",
        topic="动物分类",
        theme="森林探险",
        difficulty=4,
        entities=[
            {"id": "e1", "label": "狮子", "category": "cat1", "color": "#F87171"},
            {"id": "e2", "label": "鲨鱼", "category": "cat2", "color": "#4F8EF7"},
            {"id": "e3", "label": "老虎", "category": "cat1", "color": "#FB923C"},
            {"id": "e4", "label": "金枪鱼", "category": "cat2", "color": "#06B6D4"},
        ],
        categories=[
            {"id": "cat1", "label": "陆地动物"},
            {"id": "cat2", "label": "海洋动物"},
        ],
        rules=GameRules(),
        levels=[GameLevel(prompt="将动物拖入正确类别")],
        feedback=GameFeedback(),
    )
    data.update(overrides)
    return GameSpec(**data)


def make_match_pairs_spec(**overrides) -> GameSpec:
    data = dict(
        mechanic="match_pairs",
        topic="Python 数据类型",
        theme="数据类型连连看",
        difficulty=3,
        entities=[
            {"id": "e1", "term": "int", "definition": "整数类型"},
            {"id": "e2", "term": "str", "definition": "字符串类型"},
            {"id": "e3", "term": "list", "definition": "可变序列"},
            {"id": "e4", "term": "dict", "definition": "键值对映射"},
        ],
        rules=GameRules(),
        levels=[GameLevel(prompt="点击左侧概念，再点击右侧定义")],
        feedback=GameFeedback(),
    )
    data.update(overrides)
    return GameSpec(**data)


def make_simulation_spec(**overrides) -> GameSpec:
    data = dict(
        mechanic="simulation",
        topic="光合作用",
        theme="植物工厂模拟",
        difficulty=6,
        entities=[
            {"id": "p1", "param_name": "light", "label": "光照强度", "min": 0, "max": 100, "default": 20, "unit": "%", "effect_key": "rate"},
            {"id": "p2", "param_name": "co2", "label": "二氧化碳", "min": 0, "max": 100, "default": 30, "unit": "ppm", "effect_key": "rate"},
            {"id": "p3", "param_name": "water", "label": "水分", "min": 0, "max": 100, "default": 40, "unit": "%", "effect_key": "rate"},
        ],
        target_condition="将三个参数都调高，使光合速率超过 70%",
        visual_description="叶绿体产氧速率可视化",
        rules=GameRules(),
        levels=[GameLevel(prompt="调节参数，观察光合速率变化")],
        feedback=GameFeedback(),
    )
    data.update(overrides)
    return GameSpec(**data)


def make_label_map_spec(**overrides) -> GameSpec:
    data = dict(
        mechanic="label_map",
        topic="细胞结构",
        theme="细胞探索地图",
        difficulty=5,
        entities=[
            {"id": "l1", "name": "细胞核", "x": 50, "y": 50, "description": "控制细胞活动的中心"},
            {"id": "l2", "name": "线粒体", "x": 30, "y": 35, "description": "细胞的能量工厂"},
            {"id": "l3", "name": "细胞膜", "x": 70, "y": 20, "description": "控制物质进出的屏障"},
            {"id": "l4", "name": "核糖体", "x": 40, "y": 70, "description": "合成蛋白质的场所"},
        ],
        scene_description="动物细胞截面图",
        rules=GameRules(),
        levels=[GameLevel(prompt="点击闪烁圆点，探索细胞结构")],
        feedback=GameFeedback(),
    )
    data.update(overrides)
    return GameSpec(**data)


def make_timeline_order_spec(**overrides) -> GameSpec:
    data = dict(
        mechanic="timeline_order",
        topic="法国大革命",
        theme="历史时间线",
        difficulty=5,
        ordered_items=[
            {"id": "t1", "label": "三级会议召开", "date": "1789年5月"},
            {"id": "t2", "label": "巴士底狱被攻占", "date": "1789年7月"},
            {"id": "t3", "label": "《人权宣言》发布", "date": "1789年8月"},
            {"id": "t4", "label": "路易十六被处决", "date": "1793年1月"},
        ],
        entities=[],
        rules=GameRules(),
        levels=[GameLevel(prompt="拖动卡片，按正确的时间顺序排列")],
        feedback=GameFeedback(),
    )
    data.update(overrides)
    return GameSpec(**data)


def make_boss_quiz_spec(**overrides) -> GameSpec:
    data = dict(
        mechanic="boss_quiz",
        topic="Python 基础语法",
        theme="知识挑战",
        difficulty=6,
        boss_name="语法守卫者",
        boss_emoji="🤖",
        questions=[
            {"id": "q1", "question": "Python 中定义函数使用哪个关键字？", "options": ["def", "function", "fn", "func"], "correct": "def"},
            {"id": "q2", "question": "Python 列表使用什么符号定义？", "options": ["[]", "{}", "()", "<>"], "correct": "[]"},
            {"id": "q3", "question": "Python 中注释使用什么符号开头？", "options": ["#", "//", "--", "/*"], "correct": "#"},
            {"id": "q4", "question": "哪个语句用于退出循环？", "options": ["break", "exit", "stop", "end"], "correct": "break"},
        ],
        entities=[],
        rules=GameRules(),
        levels=[GameLevel(prompt="回答问题击败 Boss！")],
        feedback=GameFeedback(),
    )
    data.update(overrides)
    return GameSpec(**data)


# ---------------------------------------------------------------------------
# GameSpec model tests
# ---------------------------------------------------------------------------

class TestGameSpec:
    def test_drag_sort_spec_valid(self):
        spec = make_drag_sort_spec()
        assert spec.mechanic == "drag_sort"
        assert len(spec.entities) == 4
        assert spec.categories is not None

    def test_match_pairs_spec_valid(self):
        spec = make_match_pairs_spec()
        assert spec.mechanic == "match_pairs"

    def test_simulation_spec_valid(self):
        spec = make_simulation_spec()
        assert spec.mechanic == "simulation"
        assert spec.target_condition is not None

    def test_label_map_spec_valid(self):
        spec = make_label_map_spec()
        assert spec.mechanic == "label_map"
        assert spec.scene_description is not None

    def test_timeline_order_spec_valid(self):
        spec = make_timeline_order_spec()
        assert spec.mechanic == "timeline_order"
        assert spec.ordered_items is not None
        assert len(spec.ordered_items) == 4

    def test_boss_quiz_spec_valid(self):
        spec = make_boss_quiz_spec()
        assert spec.mechanic == "boss_quiz"
        assert spec.questions is not None
        assert len(spec.questions) == 4
        assert spec.boss_name == "语法守卫者"
        assert spec.boss_emoji == "🤖"

    def test_difficulty_bounds(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            GameSpec(
                mechanic="drag_sort", topic="t", theme="t",
                difficulty=11, entities=[{"id":"e1","label":"x","category":"c1"}],
            )

    def test_model_dump_round_trip(self):
        spec = make_drag_sort_spec()
        data = spec.model_dump()
        spec2 = GameSpec(**data)
        assert spec2.mechanic == spec.mechanic
        assert spec2.topic == spec.topic


# ---------------------------------------------------------------------------
# GameSpecValidator tests
# ---------------------------------------------------------------------------

class TestGameSpecValidator:
    def setup_method(self):
        self.v = GameSpecValidator()

    def test_drag_sort_valid(self):
        spec = make_drag_sort_spec()
        valid, errors = self.v.validate(spec)
        assert valid, errors

    def test_match_pairs_valid(self):
        spec = make_match_pairs_spec()
        valid, errors = self.v.validate(spec)
        assert valid, errors

    def test_simulation_valid(self):
        spec = make_simulation_spec()
        valid, errors = self.v.validate(spec)
        assert valid, errors

    def test_label_map_valid(self):
        spec = make_label_map_spec()
        valid, errors = self.v.validate(spec)
        assert valid, errors

    def test_too_few_entities(self):
        spec = make_drag_sort_spec()
        spec.entities = spec.entities[:2]
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("entities" in e for e in errors)

    def test_empty_levels(self):
        spec = make_drag_sort_spec()
        spec.levels = []
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("levels" in e for e in errors)

    def test_drag_sort_missing_category(self):
        spec = make_drag_sort_spec()
        spec.categories = None
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("categories" in e for e in errors)

    def test_drag_sort_entity_missing_field(self):
        spec = make_drag_sort_spec()
        spec.entities[0] = {"id": "e1", "label": "x"}  # missing 'category'
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("category" in e for e in errors)

    def test_match_pairs_entity_missing_term(self):
        spec = make_match_pairs_spec()
        spec.entities[0] = {"id": "e1", "definition": "x"}  # missing 'term'
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("term" in e for e in errors)

    def test_simulation_entity_missing_min(self):
        spec = make_simulation_spec()
        spec.entities[0] = {"id": "p1", "param_name": "light", "max": 100}  # missing 'min'
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("min" in e for e in errors)

    def test_label_map_entity_missing_xy(self):
        spec = make_label_map_spec()
        spec.entities[0] = {"id": "l1", "name": "核"}  # missing x, y
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("x" in e for e in errors)

    def test_timeline_order_valid(self):
        spec = make_timeline_order_spec()
        valid, errors = self.v.validate(spec)
        assert valid, errors

    def test_timeline_order_too_few_items(self):
        spec = make_timeline_order_spec()
        spec.ordered_items = spec.ordered_items[:2]
        valid, errors = self.v.validate(spec)
        assert not valid

    def test_timeline_order_missing_label(self):
        spec = make_timeline_order_spec()
        spec.ordered_items[0] = {"id": "t1"}  # missing 'label'
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("label" in e for e in errors)

    def test_boss_quiz_valid(self):
        spec = make_boss_quiz_spec()
        valid, errors = self.v.validate(spec)
        assert valid, errors

    def test_boss_quiz_too_few_questions(self):
        spec = make_boss_quiz_spec()
        spec.questions = spec.questions[:2]
        valid, errors = self.v.validate(spec)
        assert not valid

    def test_boss_quiz_missing_correct(self):
        spec = make_boss_quiz_spec()
        spec.questions[0] = {"id": "q1", "question": "?", "options": ["A", "B"]}  # missing 'correct'
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("correct" in e for e in errors)


# ---------------------------------------------------------------------------
# GameCompiler tests
# ---------------------------------------------------------------------------

class TestGameCompiler:
    def setup_method(self):
        self.compiler = GameCompiler()

    def test_drag_sort_compiles(self):
        spec = make_drag_sort_spec()
        html = self.compiler.compile(spec)
        assert "<!DOCTYPE html>" in html
        assert "const SPEC =" in html
        assert '"mechanic": "drag_sort"' in html
        assert "drag_sort" not in html.split("const SPEC =")[0].split("__GAME_SPEC__")[-1:]  # placeholder replaced
        assert "__GAME_SPEC__" not in html

    def test_match_pairs_compiles(self):
        spec = make_match_pairs_spec()
        html = self.compiler.compile(spec)
        assert "const SPEC =" in html
        assert '"mechanic": "match_pairs"' in html
        assert "__GAME_SPEC__" not in html

    def test_simulation_compiles(self):
        spec = make_simulation_spec()
        html = self.compiler.compile(spec)
        assert "const SPEC =" in html
        assert '"mechanic": "simulation"' in html
        assert "__GAME_SPEC__" not in html

    def test_label_map_compiles(self):
        spec = make_label_map_spec()
        html = self.compiler.compile(spec)
        assert "const SPEC =" in html
        assert '"mechanic": "label_map"' in html
        assert "__GAME_SPEC__" not in html

    def test_compiled_html_has_gsap(self):
        spec = make_drag_sort_spec()
        html = self.compiler.compile(spec)
        assert "gsap" in html.lower()

    def test_compiled_html_has_particle_canvas(self):
        spec = make_drag_sort_spec()
        html = self.compiler.compile(spec)
        assert "particle-canvas" in html

    def test_timeline_order_compiles(self):
        spec = make_timeline_order_spec()
        html = self.compiler.compile(spec)
        assert "const SPEC =" in html
        assert '"mechanic": "timeline_order"' in html
        assert "__GAME_SPEC__" not in html

    def test_boss_quiz_compiles(self):
        spec = make_boss_quiz_spec()
        html = self.compiler.compile(spec)
        assert "const SPEC =" in html
        assert '"mechanic": "boss_quiz"' in html
        assert "__GAME_SPEC__" not in html

    def test_spec_json_injected_correctly(self):
        spec = make_drag_sort_spec()
        html = self.compiler.compile(spec)
        # Extract the JSON from the compiled HTML
        marker = "const SPEC = "
        idx = html.index(marker)
        json_start = idx + len(marker)
        # Find the end of the JSON (next semicolon on same logical line)
        json_part = html[json_start:json_start+3000]
        # Should be parseable JSON up to the semicolon
        semicolon_idx = json_part.index(";")
        parsed = json.loads(json_part[:semicolon_idx])
        assert parsed["mechanic"] == "drag_sort"
        assert parsed["topic"] == "动物分类"

    def test_unknown_mechanic_raises(self):
        spec = make_drag_sort_spec()
        spec.mechanic = "unknown_mechanic"  # type: ignore
        with pytest.raises(FileNotFoundError):
            self.compiler.compile(spec)


# ---------------------------------------------------------------------------
# GameSpecPlannerAgent tests (mocked LLM)
# ---------------------------------------------------------------------------

class TestGameSpecPlannerAgent:
    def _make_llm_with_response(self, json_str: str):
        """Create a mock LLM that returns json_str as the last AIMessage."""
        from langchain_core.messages import AIMessage

        mock_llm = MagicMock()
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content=json_str)]
        })
        return mock_llm, mock_agent

    @pytest.mark.asyncio
    async def test_plan_drag_sort(self):
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        spec_data = make_drag_sort_spec().model_dump()
        spec_json = json.dumps(spec_data, ensure_ascii=False)

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=spec_json)]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            result = await planner.plan("动物分类", "学习动物分类方法", 4)

        assert result is not None
        assert result.mechanic == "drag_sort"
        assert len(result.entities) == 4

    @pytest.mark.asyncio
    async def test_plan_match_pairs(self):
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        spec_data = make_match_pairs_spec().model_dump()
        spec_json = json.dumps(spec_data, ensure_ascii=False)

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=spec_json)]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            result = await planner.plan("Python 数据类型", "了解 Python 基本类型", 3)

        assert result is not None
        assert result.mechanic == "match_pairs"

    @pytest.mark.asyncio
    async def test_plan_returns_none_on_invalid_json(self):
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="not valid json")]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            result = await planner.plan("测试", "测试内容", 5)

        assert result is None

    @pytest.mark.asyncio
    async def test_plan_returns_none_on_validation_failure(self):
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        # Valid JSON but fails validation (too few entities)
        bad_spec = {
            "mechanic": "drag_sort",
            "topic": "t",
            "theme": "t",
            "difficulty": 4,
            "entities": [{"id": "e1", "label": "x", "category": "c1"}],  # only 1
            "categories": [{"id": "c1", "label": "A"}],
            "levels": [{"prompt": "test"}],
        }

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=json.dumps(bad_spec))]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            result = await planner.plan("测试", "测试内容", 4)

        assert result is None

    @pytest.mark.asyncio
    async def test_plan_with_lab_strategy(self):
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        spec_data = make_simulation_spec().model_dump()
        spec_json = json.dumps(spec_data, ensure_ascii=False)

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=spec_json)]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            result = await planner.plan(
                "光合作用", "了解光合作用过程", 6,
                lab_strategy={"game_mechanic": "simulation", "game_concept": "模拟光合实验"},
            )

        assert result is not None
        assert result.mechanic == "simulation"

    @pytest.mark.asyncio
    async def test_plan_strips_markdown_fences(self):
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        spec_data = make_label_map_spec().model_dump()
        fenced = f"```json\n{json.dumps(spec_data)}\n```"

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=fenced)]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            result = await planner.plan("细胞结构", "了解细胞各部分", 5)

        assert result is not None
        assert result.mechanic == "label_map"


# ---------------------------------------------------------------------------
# Integration: planner + compiler pipeline
# ---------------------------------------------------------------------------

class TestGamePipeline:
    @pytest.mark.asyncio
    async def test_full_pipeline_drag_sort(self):
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        spec_data = make_drag_sort_spec().model_dump()
        spec_json = json.dumps(spec_data, ensure_ascii=False)

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=spec_json)]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            spec = await planner.plan("动物分类", "学习动物分类", 4)

        assert spec is not None
        html = GameCompiler().compile(spec)
        assert "const SPEC =" in html
        assert "__GAME_SPEC__" not in html
        assert '"mechanic": "drag_sort"' in html

    @pytest.mark.asyncio
    async def test_full_pipeline_all_mechanics(self):
        """Compiler works for all 6 mechanics without error."""
        specs = [
            make_drag_sort_spec(),
            make_match_pairs_spec(),
            make_simulation_spec(),
            make_label_map_spec(),
            make_timeline_order_spec(),
            make_boss_quiz_spec(),
        ]
        compiler = GameCompiler()
        for spec in specs:
            html = compiler.compile(spec)
            assert "const SPEC =" in html, f"Missing GAME_SPEC for mechanic={spec.mechanic}"
            assert "__GAME_SPEC__" not in html, f"Placeholder not replaced for mechanic={spec.mechanic}"
