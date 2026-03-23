"""Tests for GameAgent pipeline: spec, validator, compiler, planner, object_registry."""

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

    def test_label_map_with_object_spec_empty_entities_valid(self):
        """label_map + object_spec mode: entities=[] is valid (Registry provides visuals)."""
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        spec = GameSpec(
            mechanic="label_map",
            topic="火箭结构",
            theme="探索火箭",
            difficulty=4,
            entities=[],
            levels=[GameLevel(prompt="点击探索")],
            object_spec=ObjectSpec(
                object_key="rocket.basic",
                label_part_ids=["nose_cone", "body", "engine_nozzle"],
            ),
        )
        valid, errors = self.v.validate(spec)
        assert valid, errors

    def test_label_map_with_object_spec_non_empty_entities_invalid(self):
        """label_map + object_spec mode: entities must be empty."""
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        spec = GameSpec(
            mechanic="label_map",
            topic="火箭结构",
            theme="探索火箭",
            difficulty=4,
            entities=[{"id": "l1", "name": "x", "x": 10, "y": 20}],
            levels=[GameLevel(prompt="点击探索")],
            object_spec=ObjectSpec(object_key="rocket.basic"),
        )
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("entities" in e for e in errors)

    def test_label_map_no_object_spec_requires_entities(self):
        """label_map without object_spec: must have >= 3 entities."""
        spec = make_label_map_spec()
        spec.entities = spec.entities[:2]
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("entities" in e for e in errors)

    def test_label_map_unknown_object_key_invalid(self):
        """label_map with object_key not in Registry must be rejected."""
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        spec = GameSpec(
            mechanic="label_map",
            topic="认识三角形",
            theme="三角形探索",
            difficulty=3,
            entities=[],
            levels=[GameLevel(prompt="点击探索")],
            object_spec=ObjectSpec(
                object_key="triangle.basic",  # not in Registry
                label_part_ids=["vertex_a", "side_ab"],
            ),
        )
        valid, errors = self.v.validate(spec)
        assert not valid
        assert any("triangle.basic" in e for e in errors)


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

    def test_compiled_html_has_no_cdn_links(self):
        """GSAP and Google Fonts must be inlined/removed, not loaded from CDN."""
        for mechanic, make_fn in [
            ("drag_sort", make_drag_sort_spec),
            ("boss_quiz", make_boss_quiz_spec),
        ]:
            spec = make_fn()
            html = self.compiler.compile(spec)
            assert "cdnjs.cloudflare.com" not in html, f"{mechanic}: cdnjs link still present"
            assert "fonts.googleapis.com" not in html, f"{mechanic}: Google Fonts link still present"
            assert "gsap.min.js" not in html, f"{mechanic}: external gsap.min.js ref still present"

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


# ---------------------------------------------------------------------------
# ObjectRegistry tests (B+ architecture)
# ---------------------------------------------------------------------------

class TestObjectRegistry:
    def test_supported_keys(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        keys = ObjectRegistry.supported_keys()
        assert "rocket.basic" in keys
        assert "human_body.external" in keys
        assert "cell.animal" in keys
        assert "atom.bohr" in keys
        assert "plant.basic" in keys
        assert "earth.basic" in keys

    def test_rocket_build_returns_render_spec(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("rocket.basic", view="side")
        assert rs.object_key == "rocket.basic"
        # High-fidelity objects use body_svg; legacy objects use shapes
        assert len(rs.shapes) > 0 or bool(rs.body_svg)
        assert len(rs.anchors) > 0
        assert len(rs.rendered_parts) > 0

    def test_rocket_must_have_all_rendered(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("rocket.basic", view="side")
        meta = ObjectRegistry.get_meta("rocket.basic")
        for part in meta["must_have"]:
            assert part in rs.rendered_parts, f"must_have part '{part}' not rendered"

    def test_cell_build(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("cell.animal")
        assert "nucleus" in rs.rendered_parts
        assert "cell_membrane" in rs.rendered_parts

    def test_atom_build(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("atom.bohr")
        assert "nucleus" in rs.rendered_parts
        assert "electron_shell_1" in rs.rendered_parts

    def test_plant_build(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("plant.basic")
        assert "stem" in rs.rendered_parts
        assert "root" in rs.rendered_parts

    def test_earth_build(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("earth.basic")
        assert "inner_core" in rs.rendered_parts
        assert "mantle" in rs.rendered_parts

    def test_unknown_key_raises(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        with pytest.raises(KeyError):
            ObjectRegistry.build("alien_spaceship")

    def test_render_spec_viewbox(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("rocket.basic")
        # viewbox starts with "0 0 " and has positive dimensions
        parts = rs.viewbox.split()
        assert len(parts) == 4
        assert parts[0] == "0" and parts[1] == "0"
        assert int(parts[2]) > 0 and int(parts[3]) > 0

    def test_shapes_have_valid_types(self):
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("rocket.basic")
        valid_types = {"rect", "ellipse", "polygon", "path", "line"}
        for s in rs.shapes:
            assert s.type in valid_types


# ---------------------------------------------------------------------------
# ObjectValidator tests (B+ architecture - two-phase)
# ---------------------------------------------------------------------------

class TestObjectValidator:
    def test_render_completeness_valid(self):
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        from systemedu.agents.builtin.gameagent.object_validator import ObjectValidator
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("rocket.basic")
        meta = ObjectRegistry.get_meta("rocket.basic")
        obj_spec = ObjectSpec(
            object_key="rocket.basic", view="side",
            label_part_ids=["nose_cone", "body", "engine_nozzle"],
        )
        v = ObjectValidator(meta)
        ok, errs = v.validate_render(rs)
        assert ok, errs

    def test_label_legality_valid(self):
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        from systemedu.agents.builtin.gameagent.object_validator import ObjectValidator
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("rocket.basic")
        meta = ObjectRegistry.get_meta("rocket.basic")
        obj_spec = ObjectSpec(
            object_key="rocket.basic", view="side",
            label_part_ids=["nose_cone", "body", "engine_nozzle"],
        )
        v = ObjectValidator(meta)
        ok, errs = v.validate_labels(obj_spec, rs)
        assert ok, errs

    def test_label_legality_unknown_part(self):
        """Requesting a label for a non-existent part fails legality check."""
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        from systemedu.agents.builtin.gameagent.object_validator import ObjectValidator
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("rocket.basic")
        meta = ObjectRegistry.get_meta("rocket.basic")
        obj_spec = ObjectSpec(
            object_key="rocket.basic", view="side",
            label_part_ids=["nose_cone", "nonexistent_part"],
        )
        v = ObjectValidator(meta)
        ok, errs = v.validate_labels(obj_spec, rs)
        assert not ok
        assert any("nonexistent_part" in e for e in errs)

    def test_must_have_vs_label_separation(self):
        """must_have parts (left_fin/right_fin) need not be in label_part_ids."""
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        from systemedu.agents.builtin.gameagent.object_validator import ObjectValidator
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
        rs = ObjectRegistry.build("rocket.basic")
        meta = ObjectRegistry.get_meta("rocket.basic")
        # Only label nose_cone - fins are must_have but not labeled
        obj_spec = ObjectSpec(
            object_key="rocket.basic", view="side",
            label_part_ids=["nose_cone"],
        )
        v = ObjectValidator(meta)
        ok, errs = v.validate(obj_spec, rs)
        # Render check should pass (fins ARE rendered), label check should pass too
        assert ok, errs


# ---------------------------------------------------------------------------
# Compiler with object_spec (B+ architecture)
# ---------------------------------------------------------------------------

class TestCompilerWithObjectSpec:
    def _make_label_map_with_object_spec(self) -> GameSpec:
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        return GameSpec(
            mechanic="label_map",
            topic="认识火箭系统",
            theme="探索火箭结构",
            difficulty=4,
            entities=[],
            levels=[GameLevel(prompt="点击闪烁的圆点，探索各个部分")],
            object_spec=ObjectSpec(
                object_key="rocket.basic",
                view="side",
                label_part_ids=["nose_cone", "body", "engine_nozzle", "left_fin"],
                highlight_part_ids=["engine_nozzle"],
            ),
        )

    def test_label_map_with_object_spec_compiles(self):
        spec = self._make_label_map_with_object_spec()
        html = GameCompiler().compile(spec)
        assert "const SPEC =" in html
        assert "const RENDER_SPEC =" in html
        assert "__GAME_SPEC__" not in html
        assert "__RENDER_SPEC__" not in html

    def test_label_map_render_spec_has_shapes(self):
        spec = self._make_label_map_with_object_spec()
        html = GameCompiler().compile(spec)
        assert '"rendered_parts"' in html
        assert '"shapes"' in html

    def test_label_map_labels_from_registry_not_llm(self):
        """Labels come from Registry (in Chinese from META), not from LLM free text."""
        spec = self._make_label_map_with_object_spec()
        html = GameCompiler().compile(spec)
        # Registry labels for rocket parts
        assert "鼻锥" in html           # nose_cone label from META
        assert "发动机喷口" in html      # engine_nozzle label from META

    def test_label_map_descriptions_from_registry(self):
        spec = self._make_label_map_with_object_spec()
        html = GameCompiler().compile(spec)
        # desc_brief from META
        assert "空气阻力" in html        # nose_cone desc mentions aerodynamics
        assert "推力" in html            # engine_nozzle desc mentions thrust

    def test_label_map_fallback_object_key_still_compiles(self):
        """Fallback: unknown variant → family fallback → HTML still generated."""
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        spec = GameSpec(
            mechanic="label_map",
            topic="认识火箭",
            theme="探索火箭结构",
            difficulty=3,
            entities=[],
            levels=[GameLevel(prompt="点击探索")],
            object_spec=ObjectSpec(
                object_key="rocket.cutaway",   # not in registry
                label_part_ids=["nose_cone", "body"],
            ),
        )
        html = GameCompiler().compile(spec)
        # Fallback to rocket.basic → RENDER_SPEC injected
        assert "const RENDER_SPEC =" in html
        assert "__RENDER_SPEC__" not in html

    def test_label_map_unknown_family_renders_null_spec(self):
        """No fallback: unknown family → RENDER_SPEC = null, HTML still valid."""
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        spec = GameSpec(
            mechanic="label_map",
            topic="外星飞船",
            theme="探索飞船",
            difficulty=3,
            entities=[],
            levels=[GameLevel(prompt="点击探索")],
            object_spec=ObjectSpec(object_key="alien.spaceship"),
        )
        html = GameCompiler().compile(spec)
        assert "const RENDER_SPEC = null" in html

    def test_fallback_enqueues_miss_request(self, tmp_path):
        """When a fallback is used, a MissingObjectRequest is written to MissQueue."""
        import json
        from unittest.mock import patch
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        from systemedu.agents.builtin.gameagent.miss_queue import MissQueue

        queue_path = tmp_path / "test_miss.jsonl"
        spec = GameSpec(
            mechanic="label_map",
            topic="火箭解剖",
            theme="探索火箭剖面",
            difficulty=3,
            entities=[],
            levels=[GameLevel(prompt="点击探索")],
            object_spec=ObjectSpec(object_key="rocket.cutaway"),
        )
        with patch(
            "systemedu.agents.builtin.gameagent.miss_queue.MissQueue",
            return_value=MissQueue(queue_path),
        ):
            GameCompiler().compile(spec)

        assert queue_path.exists()
        data = json.loads(queue_path.read_text().strip())
        assert data["object_key"] == "rocket.cutaway"
        assert data["fallback_used"] == "rocket.basic"

    def test_exact_hit_does_not_enqueue(self, tmp_path):
        """Exact hit produces no MissingObjectRequest."""
        from systemedu.agents.builtin.gameagent.object_spec import ObjectSpec
        from systemedu.agents.builtin.gameagent.miss_queue import MissQueue

        queue_path = tmp_path / "test_miss.jsonl"
        # Use a real queue at tmp_path to verify nothing is written
        spec = self._make_label_map_with_object_spec()  # rocket.basic (exact)
        # Temporarily redirect default queue to tmp_path
        import systemedu.agents.builtin.gameagent.miss_queue as mq_module
        original = mq_module._DEFAULT_QUEUE_PATH
        mq_module._DEFAULT_QUEUE_PATH = queue_path
        try:
            GameCompiler().compile(spec)
        finally:
            mq_module._DEFAULT_QUEUE_PATH = original

        assert not queue_path.exists() or queue_path.read_text().strip() == ""


# ---------------------------------------------------------------------------
# SimulationSceneJS model tests
# ---------------------------------------------------------------------------

class TestSimulationSceneJS:
    def test_model_fields_exist(self):
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS
        s = SimulationSceneJS(
            static_svg="<rect x='0' y='0' width='100' height='100'/>",
            dynamic_fn="return '<circle cx=\"50\" cy=\"50\" r=\"10\"/>';",
        )
        assert s.static_svg != ""
        assert s.dynamic_fn != ""

    def test_model_defaults_empty(self):
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS
        s = SimulationSceneJS()
        assert s.static_svg == ""
        assert s.dynamic_fn == ""

    def test_scene_js_round_trip(self):
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS
        s = SimulationSceneJS(
            static_svg="<line x1='0' y1='0' x2='100' y2='100'/>",
            dynamic_fn="const r = progress * 50; return `<circle r='${r}'/>`;",
        )
        data = s.model_dump()
        s2 = SimulationSceneJS(**data)
        assert s2.static_svg == s.static_svg
        assert s2.dynamic_fn == s.dynamic_fn

    def test_game_spec_accepts_scene_js(self):
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS
        spec = make_simulation_spec(
            scene_js=SimulationSceneJS(
                static_svg="<rect x='0' y='0' width='560' height='420'/>",
                dynamic_fn="return '<circle cx=\"280\" cy=\"210\" r=\"50\"/>';",
            )
        )
        assert spec.scene_js is not None
        assert spec.scene_js.static_svg != ""

    def test_game_spec_scene_js_none_by_default(self):
        spec = make_simulation_spec()
        assert spec.scene_js is None

    def test_scene_js_serialized_in_model_dump(self):
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS
        spec = make_simulation_spec(
            scene_js=SimulationSceneJS(static_svg="<g/>", dynamic_fn="return '';")
        )
        data = spec.model_dump()
        assert "scene_js" in data
        assert data["scene_js"]["static_svg"] == "<g/>"


# ---------------------------------------------------------------------------
# Compiler: simulation with scene_js
# ---------------------------------------------------------------------------

class TestCompilerWithSceneJS:
    def _make_simulation_with_scene_js(self) -> GameSpec:
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS
        return make_simulation_spec(
            scene_js=SimulationSceneJS(
                static_svg="<rect x='60' y='20' width='460' height='360' fill='none' stroke='#ccc'/>",
                dynamic_fn=(
                    "const a = p.light || 20;"
                    " const b = p.co2 || 30;"
                    " const h = (a + b) * progress * 2;"
                    " return `<rect x='200' y='${420 - h}' width='80' height='${h}' fill='green'/>`;"
                ),
            )
        )

    def test_simulation_with_scene_js_compiles(self):
        spec = self._make_simulation_with_scene_js()
        html = GameCompiler().compile(spec)
        assert "const SPEC =" in html
        assert '"mechanic": "simulation"' in html
        assert "__GAME_SPEC__" not in html

    def test_scene_js_content_in_compiled_html(self):
        """scene_js fields should appear inside SPEC JSON in the compiled HTML."""
        spec = self._make_simulation_with_scene_js()
        html = GameCompiler().compile(spec)
        assert "scene_js" in html
        assert "static_svg" in html
        assert "dynamic_fn" in html

    def test_script_tag_escaping(self):
        """</script> inside dynamic_fn must be escaped to prevent HTML breakage."""
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS
        spec = make_simulation_spec(
            scene_js=SimulationSceneJS(
                static_svg="<g/>",
                dynamic_fn="return '</script><script>alert(1)</script>';",
            )
        )
        html = GameCompiler().compile(spec)
        # The raw </script> must NOT appear verbatim (would close the <script> block early)
        # The compiler should have escaped it
        import re
        # Find SPEC JSON block
        m = re.search(r"const SPEC = (.+?);", html, re.DOTALL)
        assert m is not None
        spec_text = m.group(1)
        assert "</script>" not in spec_text

    def test_simulation_without_scene_js_still_compiles(self):
        """scene_js=None: falls back to detectScene() in template, HTML still valid."""
        spec = make_simulation_spec()  # no scene_js
        html = GameCompiler().compile(spec)
        assert "const SPEC =" in html
        assert '"mechanic": "simulation"' in html
        assert '"scene_js": null' in html

    def test_static_svg_appears_in_spec_json(self):
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS
        unique_marker = "UNIQUE_STATIC_SVG_MARKER_12345"
        spec = make_simulation_spec(
            scene_js=SimulationSceneJS(
                static_svg=f"<rect id='{unique_marker}'/>",
                dynamic_fn="return '';",
            )
        )
        html = GameCompiler().compile(spec)
        assert unique_marker in html


# ---------------------------------------------------------------------------
# Planner: simulation spec with scene_js (mocked LLM)
# ---------------------------------------------------------------------------

class TestPlannerSimulationSceneJS:
    @pytest.mark.asyncio
    async def test_plan_simulation_with_scene_js(self):
        """Planner correctly parses LLM output that includes scene_js."""
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent
        from systemedu.agents.builtin.gameagent.spec import SimulationSceneJS

        spec_data = make_simulation_spec(
            scene_js=SimulationSceneJS(
                static_svg="<line x1='60' y1='380' x2='520' y2='380'/>",
                dynamic_fn=(
                    "const rate = (p.light + p.co2 + p.water) / 3 * progress;"
                    " return `<circle cx='${60 + rate * 4}' cy='210' r='20' fill='lime'/>`;"
                ),
            )
        ).model_dump()
        spec_json = json.dumps(spec_data, ensure_ascii=False)

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=spec_json)]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            result = await planner.plan("光合作用", "了解光合作用过程", 6,
                                        lab_strategy={"game_mechanic": "simulation"})

        assert result is not None
        assert result.mechanic == "simulation"
        assert result.scene_js is not None
        assert result.scene_js.static_svg != ""
        assert result.scene_js.dynamic_fn != ""

    @pytest.mark.asyncio
    async def test_plan_simulation_without_scene_js_still_valid(self):
        """Planner accepts simulation spec without scene_js (field is optional)."""
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        spec_data = make_simulation_spec().model_dump()
        spec_json = json.dumps(spec_data, ensure_ascii=False)

        from langchain_core.messages import AIMessage
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=spec_json)]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            planner = GameSpecPlannerAgent(llm=MagicMock())
            result = await planner.plan("光合作用", "了解光合作用过程", 6)

        assert result is not None
        assert result.mechanic == "simulation"
        assert result.scene_js is None


# ---------------------------------------------------------------------------
# P0: ScientificModeler tests
# ---------------------------------------------------------------------------

class TestScientificModeler:
    def test_scientific_model_fields(self):
        from systemedu.agents.builtin.gameagent.scientific_modeler import ScientificModel
        m = ScientificModel(
            core_formulas=["F=ma"],
            mechanism=["力使物体产生加速度"],
            constraints=["质量m>0"],
            forbidden_errors=["负质量"],
        )
        assert m.core_formulas == ["F=ma"]
        assert m.mechanism == ["力使物体产生加速度"]
        assert m.constraints == ["质量m>0"]
        assert m.forbidden_errors == ["负质量"]

    def test_scientific_model_defaults(self):
        from systemedu.agents.builtin.gameagent.scientific_modeler import ScientificModel
        m = ScientificModel()
        assert m.core_formulas == []
        assert m.mechanism == []
        assert m.constraints == []
        assert m.forbidden_errors == []

    def test_to_prompt_section_with_content(self):
        from systemedu.agents.builtin.gameagent.scientific_modeler import ScientificModel
        m = ScientificModel(
            core_formulas=["F=ma"],
            mechanism=["力使物体加速"],
            constraints=["质量m>0"],
            forbidden_errors=["负质量"],
        )
        section = m.to_prompt_section()
        assert "科学建模约束" in section
        assert "F=ma" in section
        assert "力使物体加速" in section
        assert "质量m>0" in section
        assert "负质量" in section

    def test_to_prompt_section_empty(self):
        from systemedu.agents.builtin.gameagent.scientific_modeler import ScientificModel
        m = ScientificModel()
        section = m.to_prompt_section()
        assert "科学建模约束" in section  # header always present

    @pytest.mark.asyncio
    async def test_modeler_returns_model_on_valid_response(self):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.scientific_modeler import ScientificModeler, ScientificModel

        model_data = {
            "core_formulas": ["F=ma", "a=F/m"],
            "mechanism": ["施加力使物体加速"],
            "constraints": ["质量m必须大于0"],
            "forbidden_errors": ["负质量"],
        }
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content=json.dumps(model_data))]
        })

        with patch("deepagents.create_deep_agent", return_value=mock_agent):
            modeler = ScientificModeler(llm=MagicMock())
            result = await modeler.model("牛顿第二定律", "F=ma，力与加速度的关系")

        assert result is not None
        assert isinstance(result, ScientificModel)
        assert "F=ma" in result.core_formulas

    @pytest.mark.asyncio
    async def test_modeler_returns_none_on_invalid_response(self):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.scientific_modeler import ScientificModeler

        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={
            "messages": [AIMessage(content="not valid json")]
        })

        with patch("deepagents.create_deep_agent", return_value=mock_agent):
            modeler = ScientificModeler(llm=MagicMock())
            result = await modeler.model("测试", "测试内容")

        assert result is None  # graceful failure

    @pytest.mark.asyncio
    async def test_modeler_strips_markdown_fences(self):
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.scientific_modeler import ScientificModeler

        model_data = {"core_formulas": ["E=mc²"], "mechanism": [], "constraints": [], "forbidden_errors": []}
        fenced = f"```json\n{json.dumps(model_data)}\n```"

        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=fenced)]})

        with patch("deepagents.create_deep_agent", return_value=mock_agent):
            modeler = ScientificModeler(llm=MagicMock())
            result = await modeler.model("质能方程", "E=mc²")

        assert result is not None
        assert "E=mc²" in result.core_formulas


# ---------------------------------------------------------------------------
# P0: ScientificModeler integration with planner
# ---------------------------------------------------------------------------

class TestPlannerWithScientificModel:
    @pytest.mark.asyncio
    async def test_planner_stores_scientific_model_in_spec(self):
        """When ScientificModeler succeeds, spec.scientific_model is populated."""
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent
        from systemedu.agents.builtin.gameagent.scientific_modeler import ScientificModel

        spec_data = make_simulation_spec().model_dump()
        spec_json = json.dumps(spec_data, ensure_ascii=False)

        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=spec_json)]})

        mock_model = ScientificModel(
            core_formulas=["F=ma"],
            mechanism=["力使物体加速"],
            constraints=["m>0"],
            forbidden_errors=["负质量"],
        )

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            with patch("systemedu.agents.builtin.gameagent.scientific_modeler.ScientificModeler") as MockModeler:
                MockModeler.return_value.model = AsyncMock(return_value=mock_model)
                planner = GameSpecPlannerAgent(llm=MagicMock())
                result = await planner.plan("牛顿第二定律", "F=ma", 5)

        assert result is not None
        assert result.scientific_model is not None
        assert result.scientific_model["core_formulas"] == ["F=ma"]

    @pytest.mark.asyncio
    async def test_planner_continues_without_scientific_model(self):
        """ScientificModeler failure does not block planner (graceful skip)."""
        from langchain_core.messages import AIMessage
        from systemedu.agents.builtin.gameagent.planner import GameSpecPlannerAgent

        spec_data = make_drag_sort_spec().model_dump()
        spec_json = json.dumps(spec_data, ensure_ascii=False)

        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content=spec_json)]})

        with patch("systemedu.agents.builtin.gameagent.planner.create_deep_agent", return_value=mock_agent):
            with patch("systemedu.agents.builtin.gameagent.scientific_modeler.ScientificModeler") as MockModeler:
                MockModeler.return_value.model = AsyncMock(return_value=None)  # failure
                planner = GameSpecPlannerAgent(llm=MagicMock())
                result = await planner.plan("动物分类", "测试", 4)

        assert result is not None  # planner not blocked
        assert result.mechanic == "drag_sort"


# ---------------------------------------------------------------------------
# P1: FreeSimulationHTML model tests
# ---------------------------------------------------------------------------

class TestFreeSimulationHTML:
    def test_model_fields(self):
        from systemedu.agents.builtin.gameagent.spec import FreeSimulationHTML
        f = FreeSimulationHTML(html="<html></html>", design_idea="测试设计")
        assert f.html == "<html></html>"
        assert f.design_idea == "测试设计"

    def test_model_defaults(self):
        from systemedu.agents.builtin.gameagent.spec import FreeSimulationHTML
        f = FreeSimulationHTML()
        assert f.html == ""
        assert f.design_idea == ""

    def test_game_spec_free_simulation(self):
        from systemedu.agents.builtin.gameagent.spec import FreeSimulationHTML
        spec = GameSpec(
            mechanic="free_simulation",
            topic="欧姆定律",
            theme="电路实验室",
            difficulty=5,
            entities=[],
            levels=[GameLevel(prompt="调节电压和电阻")],
            free_html=FreeSimulationHTML(html="<!DOCTYPE html><html><body>test</body></html>" + "x" * 460),
        )
        assert spec.mechanic == "free_simulation"
        assert spec.free_html is not None
        assert len(spec.free_html.html) > 500


# ---------------------------------------------------------------------------
# P1: Validator for free_simulation
# ---------------------------------------------------------------------------

class TestValidatorFreeSimulation:
    def _make_free_sim_spec(self, html: str = "") -> GameSpec:
        from systemedu.agents.builtin.gameagent.spec import FreeSimulationHTML
        return GameSpec(
            mechanic="free_simulation",
            topic="欧姆定律",
            theme="电路实验室",
            difficulty=5,
            entities=[],
            levels=[GameLevel(prompt="调节参数")],
            free_html=FreeSimulationHTML(html=html),
        )

    def test_valid_free_simulation(self):
        long_html = "<!DOCTYPE html><html><body>" + "x" * 500 + "</body></html>"
        spec = self._make_free_sim_spec(long_html)
        validator = GameSpecValidator()
        ok, errors = validator.validate(spec)
        assert ok, errors

    def test_missing_free_html_fails(self):
        spec = GameSpec(
            mechanic="free_simulation",
            topic="测试",
            theme="测试",
            difficulty=5,
            entities=[],
            levels=[GameLevel(prompt="测试")],
            free_html=None,
        )
        validator = GameSpecValidator()
        ok, errors = validator.validate(spec)
        assert not ok
        assert any("free_html" in e for e in errors)

    def test_empty_html_fails(self):
        spec = self._make_free_sim_spec(html="")
        validator = GameSpecValidator()
        ok, errors = validator.validate(spec)
        assert not ok
        assert any("free_html" in e for e in errors)

    def test_too_short_html_fails(self):
        spec = self._make_free_sim_spec(html="<html></html>")
        validator = GameSpecValidator()
        ok, errors = validator.validate(spec)
        assert not ok
        assert any("too short" in e for e in errors)


# ---------------------------------------------------------------------------
# P1: Compiler for free_simulation
# ---------------------------------------------------------------------------

class TestCompilerFreeSimulation:
    def _make_free_sim_spec(self, html: str | None = None) -> GameSpec:
        from systemedu.agents.builtin.gameagent.spec import FreeSimulationHTML
        if html is None:
            html = "<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body>" + "x" * 500 + "</body>\n</html>"
        return GameSpec(
            mechanic="free_simulation",
            topic="欧姆定律",
            theme="电路实验室",
            difficulty=5,
            entities=[],
            levels=[GameLevel(prompt="调节参数")],
            free_html=FreeSimulationHTML(html=html),
        )

    def test_free_simulation_compiles_directly(self):
        spec = self._make_free_sim_spec()
        html = GameCompiler().compile(spec)
        assert "<!DOCTYPE html>" in html or "<html>" in html.lower()

    def test_free_simulation_returns_exact_html(self):
        """Compiler returns free_html.html verbatim (no template wrapping)."""
        unique = "UNIQUE_MARKER_FREE_SIM_42"
        html_content = f"<!DOCTYPE html><html><head></head><body>{unique}{'x' * 490}</body></html>"
        spec = self._make_free_sim_spec(html=html_content)
        result = GameCompiler().compile(spec)
        assert unique in result

    def test_free_simulation_no_template_placeholders(self):
        """free_simulation output must not contain template placeholders."""
        spec = self._make_free_sim_spec()
        html = GameCompiler().compile(spec)
        assert "__GAME_SPEC__" not in html
        assert "__RENDER_SPEC__" not in html

    def test_katex_not_injected_without_latex(self):
        """KaTeX is not injected when no LaTeX delimiters present."""
        spec = self._make_free_sim_spec()
        html = GameCompiler().compile(spec)
        assert "katex" not in html.lower()

    def test_katex_injected_with_latex_delimiters(self):
        r"""KaTeX is injected when \( ... \) is detected."""
        latex_html = (
            "<!DOCTYPE html><html><head></head><body>"
            r"\(F = ma\)"
            + "x" * 490 + "</body></html>"
        )
        spec = self._make_free_sim_spec(html=latex_html)
        result = GameCompiler().compile(spec)
        assert "katex" in result.lower()

    def test_katex_injected_with_dollar_delimiters(self):
        """KaTeX is injected when $$ ... $$ is detected."""
        latex_html = (
            "<!DOCTYPE html><html><head></head><body>"
            "$$E = mc^2$$"
            + "x" * 490 + "</body></html>"
        )
        spec = self._make_free_sim_spec(html=latex_html)
        result = GameCompiler().compile(spec)
        assert "katex" in result.lower()

    def test_free_simulation_raises_on_empty_html(self):
        from systemedu.agents.builtin.gameagent.spec import FreeSimulationHTML
        spec = GameSpec(
            mechanic="free_simulation",
            topic="测试",
            theme="测试",
            difficulty=5,
            entities=[],
            levels=[GameLevel(prompt="测试")],
            free_html=FreeSimulationHTML(html=""),
        )
        with pytest.raises(ValueError, match="no html content"):
            GameCompiler().compile(spec)


# ---------------------------------------------------------------------------
# P1: KaTeX injection helper tests
# ---------------------------------------------------------------------------

class TestKatexInjection:
    def test_no_latex_no_inject(self):
        from systemedu.agents.builtin.gameagent.compiler import _inject_katex_if_needed
        html = "<html><head></head><body>hello world</body></html>"
        result = _inject_katex_if_needed(html)
        assert result == html  # unchanged

    def test_backslash_paren_triggers_inject(self):
        from systemedu.agents.builtin.gameagent.compiler import _inject_katex_if_needed
        html = r"<html><head></head><body>\(F=ma\)</body></html>"
        result = _inject_katex_if_needed(html)
        assert "katex" in result.lower()

    def test_double_dollar_triggers_inject(self):
        from systemedu.agents.builtin.gameagent.compiler import _inject_katex_if_needed
        html = "<html><head></head><body>$$E=mc^2$$</body></html>"
        result = _inject_katex_if_needed(html)
        assert "katex" in result.lower()

    def test_inject_before_head_close(self):
        from systemedu.agents.builtin.gameagent.compiler import _inject_katex_if_needed
        html = r"<html><head><title>t</title></head><body>\(x\)</body></html>"
        result = _inject_katex_if_needed(html)
        head_close = result.index("</head>")
        katex_pos = result.lower().index("katex")
        assert katex_pos < head_close  # KaTeX injected before </head>

    def test_no_double_inject(self):
        from systemedu.agents.builtin.gameagent.compiler import _inject_katex_if_needed
        html = r'<html><head><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"></head><body>\(x\)</body></html>'
        result = _inject_katex_if_needed(html)
        # katex should appear only once in the head area (not duplicated)
        assert result.count("katex.min.css") == 1
