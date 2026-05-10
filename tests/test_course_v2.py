"""Tests for the v2 multi-agent course generation pipeline."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage


def _make_llm(response_text: str):
    llm = MagicMock()
    llm.invoke = MagicMock(return_value=AIMessage(content=response_text))
    return llm


# ===== CoursePlannerAgent.plan_detailed =====

class TestCoursePlannerAgentDetailed:

    @pytest.mark.asyncio
    async def test_plan_detailed_returns_markdown(self):
        from systemedu.core.agents.builtin.course_planner import CoursePlannerAgent

        llm = _make_llm("## 学习目标\n\n1. 理解力的概念\n\n## 正文\n\n力是物体间的相互作用。")
        agent = CoursePlannerAgent(llm)
        result = await agent.plan_detailed("力", "关于力的基本概念", 3, "物理基础")
        assert isinstance(result, str)
        assert len(result) > 10

    @pytest.mark.asyncio
    async def test_plan_detailed_empty_on_failure(self):
        from systemedu.core.agents.builtin.course_planner import CoursePlannerAgent

        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=RuntimeError("LLM error"))
        agent = CoursePlannerAgent(llm)
        result = await agent.plan_detailed("力", "力的概念", 3)
        assert result == ""

    @pytest.mark.asyncio
    async def test_plan_detailed_empty_response(self):
        from systemedu.core.agents.builtin.course_planner import CoursePlannerAgent

        llm = _make_llm("")
        agent = CoursePlannerAgent(llm)
        result = await agent.plan_detailed("力", "力的概念", 3)
        assert result == ""


# ===== CourseIdeaAgent =====

class TestCourseIdeaAgent:

    def _make_idea_response(self):
        plan = (
            "## 学习目标\n\n理解力的概念\n\n"
            "## 正文\n\n力是物体间的相互作用。[[IDEA:idea-001]]\n\n"
            "游戏让学生练习力的合成。[[IDEA:idea-002]]\n\n"
            "故事引入牛顿第一定律。[[IDEA:idea-003]]"
        )
        ideas = [
            {
                "idea_id": "idea-001",
                "mode": "animation",
                "topic": "力的传递",
                "context_summary": "力是物体间的相互作用的动态演示",
            },
            {
                "idea_id": "idea-002",
                "mode": "game",
                "topic": "力的合成",
                "context_summary": "学生练习合力的计算",
            },
            {
                "idea_id": "idea-003",
                "mode": "story",
                "topic": "牛顿第一定律",
                "context_summary": "苹果落地的故事引入",
            },
        ]
        return f"{plan}\n---SEPARATOR---\n{json.dumps(ideas, ensure_ascii=False)}"

    @pytest.mark.asyncio
    async def test_identify_returns_plan_and_ideas(self):
        from systemedu.core.agents.builtin.course_idea_agent import CourseIdeaAgent

        llm = _make_llm(self._make_idea_response())
        agent = CourseIdeaAgent(llm)
        plan_text, ideas = await agent.identify("## 正文\n\n力的内容", "力")
        assert "[[IDEA:" in plan_text
        assert len(ideas) == 3
        assert ideas[0]["mode"] == "animation"
        assert ideas[1]["mode"] == "game"
        assert ideas[2]["mode"] == "story"
        for idea in ideas:
            assert idea["detail_plan"] is None
            assert idea["result"] is None

    @pytest.mark.asyncio
    async def test_identify_fallback_on_no_separator(self):
        from systemedu.core.agents.builtin.course_idea_agent import CourseIdeaAgent

        llm = _make_llm("no separator here")
        agent = CourseIdeaAgent(llm)
        original = "## 学习目标\n内容"
        plan_text, ideas = await agent.identify(original, "力")
        assert plan_text == original
        assert ideas == []

    @pytest.mark.asyncio
    async def test_identify_filters_invalid_mode(self):
        from systemedu.core.agents.builtin.course_idea_agent import CourseIdeaAgent

        plan = "内容[[IDEA:abc]]"
        bad_ideas = [{"idea_id": "abc", "mode": "invalid", "topic": "x", "context_summary": "y"}]
        llm = _make_llm(f"{plan}\n---SEPARATOR---\n{json.dumps(bad_ideas)}")
        agent = CourseIdeaAgent(llm)
        plan_text, ideas = await agent.identify("内容", "力")
        assert ideas == []

    @pytest.mark.asyncio
    async def test_identify_handles_prefix_text_before_json(self):
        """Regression: LLM sometimes outputs description text before the JSON array after SEPARATOR."""
        from systemedu.core.agents.builtin.course_idea_agent import CourseIdeaAgent

        plan = "内容[[IDEA:idea-x]]"
        ideas = [{"idea_id": "idea-x", "mode": "animation", "topic": "测试", "context_summary": "上下文"}]
        # Simulate LLM adding "第二部分：JSON 数组..." prefix before the actual JSON
        sep_part = f"\n第二部分：JSON 数组，每个元素格式：\n\n{json.dumps(ideas, ensure_ascii=False)}"
        llm = _make_llm(f"{plan}\n---SEPARATOR---\n{sep_part}")
        agent = CourseIdeaAgent(llm)
        plan_text, result = await agent.identify("原始内容", "力")
        assert len(result) == 1
        assert result[0]["mode"] == "animation"


# ===== CourseIdeaDetailAgent =====

class TestCourseIdeaDetailAgent:

    @pytest.mark.asyncio
    async def test_elaborate_animation(self):
        from systemedu.core.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        detail = {
            "title": "力传递动画",
            "frame_count": 4,
            "frames": [
                {"frame_index": 0, "description": "初始状态", "visual_elements": ["物体A", "物体B"]},
                {"frame_index": 1, "description": "力的传递", "visual_elements": ["箭头"]},
            ],
            "style_hint": "科技感",
            "animation_type": "物理过程",
        }
        llm = _make_llm(json.dumps(detail, ensure_ascii=False))
        agent = CourseIdeaDetailAgent(llm)
        idea = {"idea_id": "i1", "mode": "animation", "topic": "力传递", "context_summary": "力是相互作用"}
        result = await agent.elaborate(idea)
        assert result["detail_plan"] is not None
        assert result["detail_plan"]["frame_count"] == 4

    @pytest.mark.asyncio
    async def test_elaborate_game(self):
        from systemedu.core.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        detail = {
            "game_mechanic": "drag_sort",
            "game_concept": "合力方向判断",
            "game_title": "力的合成游戏",
            "interaction_flow": ["步骤1", "步骤2"],
            "win_condition": "正确完成",
            "difficulty_hint": "medium",
            "example_data": {"description": "示例", "items": ["A", "B"]},
        }
        llm = _make_llm(json.dumps(detail, ensure_ascii=False))
        agent = CourseIdeaDetailAgent(llm)
        idea = {"idea_id": "i2", "mode": "game", "topic": "力的合成", "context_summary": "合力练习"}
        result = await agent.elaborate(idea)
        assert result["detail_plan"]["game_mechanic"] == "drag_sort"

    @pytest.mark.asyncio
    async def test_elaborate_story(self):
        from systemedu.core.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        detail = {
            "title": "苹果的故事",
            "paragraphs": [
                {"text": "牛顿坐在苹果树下...", "image_prompt": "Newton sitting under apple tree"},
                {"text": "突然一个苹果落下...", "image_prompt": "apple falling from tree"},
            ],
        }
        llm = _make_llm(json.dumps(detail, ensure_ascii=False))
        agent = CourseIdeaDetailAgent(llm)
        idea = {"idea_id": "i3", "mode": "story", "topic": "牛顿第一定律", "context_summary": "故事引入"}
        result = await agent.elaborate(idea)
        assert len(result["detail_plan"]["paragraphs"]) == 2

    @pytest.mark.asyncio
    async def test_elaborate_unknown_mode(self):
        from systemedu.core.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        llm = _make_llm("{}")
        agent = CourseIdeaDetailAgent(llm)
        idea = {"idea_id": "i4", "mode": "unknown", "topic": "x", "context_summary": "y"}
        result = await agent.elaborate(idea)
        # Unknown mode: detail_plan not set (key absent or None)
        assert result.get("detail_plan") is None

    @pytest.mark.asyncio
    async def test_elaborate_applies_simplification_for_overly_complex_animation(self):
        from systemedu.core.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        complex_detail = {
            "title": "复杂动画",
            "frame_count": 8,
            "frames": [
                {
                    "frame_index": i,
                    "description": f"步骤{i}",
                    "visual_elements": ["A", "B", "C", "D", "E"],
                    "narration": "说明",
                }
                for i in range(8)
            ],
            "beats": [
                {"t": 0.1 * i, "action": "main_action", "focus": f"f{i}"}
                for i in range(8)
            ],
            "layout": {"focal_object": "核心", "secondary_object": "辅助", "safe_area_fill": 0.3},
            "style_hint": "科技感",
            "animation_type": "流程演示",
        }

        llm = _make_llm(json.dumps(complex_detail, ensure_ascii=False))
        agent = CourseIdeaDetailAgent(llm)
        idea = {"idea_id": "ix", "mode": "animation", "topic": "复杂知识点", "context_summary": "上下文"}
        result = await agent.elaborate(idea)
        dp = result["detail_plan"]
        assert dp["frame_count"] <= 6
        assert len(dp["frames"]) <= 5
        assert all(len(f.get("visual_elements", [])) <= 3 for f in dp["frames"])
        assert isinstance(dp.get("persuasion"), dict)


# ===== AnimationGenAgent =====

_MOCK_ANIM_SPEC = json.dumps({
    "style_key": "edu_soft_tech",
    "frame_duration": 3.0,
    "frames": [
        {
            "caption": "力的传递",
            "narration": "展示力",
            "elements": [
                {"type": "rect", "x": 40, "y": 30, "w": 520, "h": 290, "fill": "#eff6ff", "rx": 16},
                {"type": "circle", "cx": 300, "cy": 170, "r": 80, "fill": "#1d4ed8", "opacity": 0.3,
                 "enter": {"duration": 0.5, "easing": "spring", "from_scale": 0.3}},
                {"type": "text", "x": 300, "y": 175, "text": "力的传递", "font_size": 20, "bold": True, "color": "#1e3a8a",
                 "enter": {"duration": 0.4, "delay": 0.2, "easing": "easeOut", "from_y": 15}},
            ],
        },
        {
            "caption": "结论",
            "narration": "作用与反作用",
            "elements": [
                {"type": "rect", "x": 40, "y": 30, "w": 520, "h": 290, "fill": "#f0fdfa", "rx": 16},
                {"type": "label_bubble", "x": 300, "y": 200, "text": "作用力=反作用力", "font_size": 14, "bg": "#0891b2",
                 "enter": {"duration": 0.4, "easing": "spring", "from_scale": 0.2}},
            ],
        },
    ],
})


# ===== IntegrationAgent =====

class TestIntegrationAgent:

    def test_integrate_basic(self):
        from systemedu.core.agents.builtin.integration_agent import IntegrationAgent

        plan = "学习内容\n[[IDEA:id-1]]\n更多内容\n[[IDEA:id-2]]"
        ideas = [
            {
                "idea_id": "id-1",
                "mode": "animation",
                "topic": "力传递",
                "context_summary": "力",
                "detail_plan": {"title": "动画", "generation_backend": "manim"},
                "result": "<html><body><svg>...</svg><style>@keyframes x{}</style></body></html>",
            },
            {
                "idea_id": "id-2",
                "mode": "story",
                "topic": "牛顿故事",
                "context_summary": "故事",
                "detail_plan": {"title": "故事"},
                "result": [{"text": "文本", "image_url": "http://example.com/img.png"}],
            },
        ]
        agent = IntegrationAgent()
        result = agent.integrate(plan, ideas)

        assert "plan_markdown" in result
        assert "[[IDEA:id-1]]" in result["plan_markdown"]
        assert "[[IDEA:id-2]]" in result["plan_markdown"]
        assert len(result["ideas"]) == 2
        assert "rendered_sections" in result
        assert result["ideas"][0]["generation_backend"] == "manim"
        assert result["rendered_sections"]["id-1"]["mode"] == "animation"
        assert result["rendered_sections"]["id-1"]["generation_backend"] == "manim"
        assert result["rendered_sections"]["id-2"]["mode"] == "story"
        assert result["rendered_sections"]["id-2"]["story_paragraphs"] is not None

    def test_integrate_empty_ideas(self):
        from systemedu.core.agents.builtin.integration_agent import IntegrationAgent

        plan = "学习内容"
        agent = IntegrationAgent()
        result = agent.integrate(plan, [])
        assert result["plan_markdown"] == plan
        assert result["ideas"] == []
        assert result["rendered_sections"] == {}

    def test_integrate_failed_result(self):
        from systemedu.core.agents.builtin.integration_agent import IntegrationAgent

        plan = "内容[[IDEA:id-x]]"
        ideas = [
            {
                "idea_id": "id-x",
                "mode": "game",
                "topic": "游戏",
                "context_summary": "游戏内容",
                "detail_plan": {},
                "result": None,
            }
        ]
        agent = IntegrationAgent()
        result = agent.integrate(plan, ideas)
        assert result["rendered_sections"]["id-x"]["status"] == "failed"


# ===== DB: course_content column =====

class TestDbCourseContent:

    def test_lesson_content_has_course_content_column(self, tmp_path, monkeypatch):
        db_file = tmp_path / "systemedu.db"
        monkeypatch.setenv("SYSTEMEDU_HOME", str(tmp_path))
        monkeypatch.setattr("systemedu.core.config.DB_FILE", db_file)
        monkeypatch.setattr("systemedu.core.storage.db.DB_FILE", db_file)
        from systemedu.core.storage import db as _db
        _db.reset_db()
        try:
            engine = _db.get_engine()
            import sqlalchemy as sa
            inspector = sa.inspect(engine)
            columns = {c["name"] for c in inspector.get_columns("lesson_content")}
            assert "course_content" in columns
        finally:
            _db.reset_db()

    def test_course_content_to_dict(self, tmp_path, monkeypatch):
        import uuid as _uuid
        db_file = tmp_path / "systemedu.db"
        monkeypatch.setenv("SYSTEMEDU_HOME", str(tmp_path))
        monkeypatch.setattr("systemedu.core.config.DB_FILE", db_file)
        monkeypatch.setattr("systemedu.core.storage.db.DB_FILE", db_file)
        from systemedu.core.storage import db as _db
        _db.reset_db()

        session = _db.get_session()
        unique_project = f"test_v2_{_uuid.uuid4().hex[:8]}"
        try:
            lesson = _db.LessonContent(
                project_name=unique_project,
                knode_id=9999,
                status="ready",
                course_content=json.dumps({
                    "plan_markdown": "## 目标\n内容",
                    "ideas": [],
                    "rendered_sections": {},
                }, ensure_ascii=False),
            )
            session.add(lesson)
            session.commit()

            from systemedu.core.education.lesson_generator import _course_content_to_dict
            data = _course_content_to_dict(lesson)
            assert data["status"] == "ready"
            assert data["course_content"]["plan_markdown"] == "## 目标\n内容"
        finally:
            session.close()
            _db.reset_db()


# ===== CourseSegmentAgent =====

class TestCourseSegmentAgent:

    @pytest.mark.asyncio
    async def test_segment_fallback_on_invalid_json(self):
        from systemedu.core.agents.builtin.course_segment_agent import CourseSegmentAgent

        llm = _make_llm("这不是 JSON")
        agent = CourseSegmentAgent(llm)
        plan = "## 学习目标\n\n理解基本概念。"
        sections = await agent.segment(plan_markdown=plan, node_title="测试节点")

        assert len(sections) == 1
        assert sections[0]["body_markdown"] == plan
        assert sections[0]["audio_url"] == ""

    @pytest.mark.asyncio
    async def test_segment_preserves_idea_placeholders(self):
        from systemedu.core.agents.builtin.course_segment_agent import CourseSegmentAgent

        plan_with_idea = "## 第一段\n\n内容[[IDEA:abc123]]\n\n继续内容。"
        response_json = json.dumps([
            {
                "section_id": "",
                "heading": "第一段",
                "body_markdown": plan_with_idea,
                "audio_script": "讲解第一段内容。",
            },
        ])
        llm = _make_llm(response_json)
        agent = CourseSegmentAgent(llm)
        sections = await agent.segment(plan_markdown=plan_with_idea, node_title="测试")

        assert "[[IDEA:abc123]]" in sections[0]["body_markdown"]


# ===== KaTeX injection =====

class TestKaTeXInjection:

    def test_inject_katex_when_latex_detected(self):
        from systemedu.core.agents.builtin.media_art_direction import inject_katex_if_needed

        html = "<html><head></head><body><p>公式 \\(E = mc^2\\)</p></body></html>"
        result = inject_katex_if_needed(html)
        assert "katex" in result.lower()
        assert "auto-render" in result

    def test_no_inject_when_no_latex(self):
        from systemedu.core.agents.builtin.media_art_direction import inject_katex_if_needed

        html = "<html><head></head><body><p>普通文本，没有公式</p></body></html>"
        result = inject_katex_if_needed(html)
        assert result == html

    def test_no_double_inject(self):
        from systemedu.core.agents.builtin.media_art_direction import inject_katex_if_needed

        html = "<html><head><script src='katex.min.js'></script></head><body>\\(x^2\\)</body></html>"
        result = inject_katex_if_needed(html)
        assert result.lower().count("katex") == 1

    def test_inject_various_latex_markers(self):
        from systemedu.core.agents.builtin.media_art_direction import inject_katex_if_needed

        markers = [
            r"\(x\)",
            r"\[x\]",
            "$$x$$",
            r"\begin{equation}",
            r"\frac{a}{b}",
            r"\int_0^1",
            r"\sum_{i=1}^n",
            r"\sqrt{x}",
        ]
        for marker in markers:
            html = f"<html><head></head><body>{marker}</body></html>"
            result = inject_katex_if_needed(html)
            assert "katex" in result.lower(), f"KaTeX not injected for marker: {marker!r}"

    def test_inject_before_head_close(self):
        from systemedu.core.agents.builtin.media_art_direction import inject_katex_if_needed

        html = "<html><head><title>Test</title></head><body>\\(a+b\\)</body></html>"
        result = inject_katex_if_needed(html)
        head_end = result.index("</head>")
        katex_pos = result.lower().index("katex")
        assert katex_pos < head_end

    def test_inject_fallback_no_head_tag(self):
        from systemedu.core.agents.builtin.media_art_direction import inject_katex_if_needed

        html = "<body>\\(x^2\\)</body>"
        result = inject_katex_if_needed(html)
        assert "katex" in result.lower()

    def test_animation_spec_prompt_contains_formula_type(self):
        # AnimationGenAgent 现在使用 AnimationSpec DSL，LLM 输出 JSON spec
        # formula 类型元素支持 LaTeX（由 compile_animation_spec 自动注入 KaTeX）
        from systemedu.core.agents.builtin.animation_spec import ANIMATION_SPEC_PROMPT
        assert "formula" in ANIMATION_SPEC_PROMPT

    def test_katex_prompt_hint_content(self):
        from systemedu.core.agents.builtin.media_art_direction import KATEX_PROMPT_HINT

        assert r"\frac" in KATEX_PROMPT_HINT
        assert r"\int" in KATEX_PROMPT_HINT
        assert "KaTeX" in KATEX_PROMPT_HINT


# ===== P1: Game mechanic selection =====

class TestGameMechanicSelection:

    def test_game_detail_prompt_no_longer_forces_simulation(self):
        from systemedu.core.agents.builtin.course_idea_detail_planner_agent import GAME_DETAIL_PROMPT
        # Prompt must NOT hard-code simulation as the only option
        assert 'game_mechanic 必须是 "simulation"' not in GAME_DETAIL_PROMPT
        assert '"simulation"' not in GAME_DETAIL_PROMPT or "drag_sort" in GAME_DETAIL_PROMPT

    def test_game_detail_prompt_lists_all_mechanics(self):
        from systemedu.core.agents.builtin.course_idea_detail_planner_agent import GAME_DETAIL_PROMPT
        for mechanic in ["simulation", "drag_sort", "match_pairs", "timeline_order", "boss_quiz"]:
            assert mechanic in GAME_DETAIL_PROMPT

    def test_game_detail_prompt_has_mechanic_reason(self):
        from systemedu.core.agents.builtin.course_idea_detail_planner_agent import GAME_DETAIL_PROMPT
        assert "mechanic_reason" in GAME_DETAIL_PROMPT



# ===== P2: ScientificModelAgent =====

class TestScientificModelAgent:

    def test_should_run_science_categories(self):
        from systemedu.core.agents.builtin.scientific_model_agent import ScientificModelAgent

        assert ScientificModelAgent.should_run("physics", "牛顿第二定律", "") is True
        assert ScientificModelAgent.should_run("chemistry", "化学反应", "") is True
        assert ScientificModelAgent.should_run("math", "积分", "") is True
        assert ScientificModelAgent.should_run("biology", "细胞", "") is True

    def test_should_run_keyword_detection(self):
        from systemedu.core.agents.builtin.scientific_model_agent import ScientificModelAgent

        assert ScientificModelAgent.should_run("other", "力与运动", "牛顿定律描述了力") is True
        assert ScientificModelAgent.should_run("other", "化学反应速率", "") is True
        assert ScientificModelAgent.should_run("other", "积分与面积", "") is True

    def test_should_not_run_unrelated(self):
        from systemedu.core.agents.builtin.scientific_model_agent import ScientificModelAgent

        assert ScientificModelAgent.should_run("music", "音乐节拍", "学习音乐节奏") is False
        assert ScientificModelAgent.should_run("other", "项目管理", "学习如何管理项目时间") is False

    @pytest.mark.asyncio
    async def test_extract_returns_model(self):
        from systemedu.core.agents.builtin.scientific_model_agent import ScientificModelAgent
        import json

        model_data = {
            "core_formulas": ["\\(F = ma\\)", "\\(W = Fd\\)"],
            "key_mechanisms": ["力使物体产生加速度"],
            "visual_constraints": ["力的方向必须与加速度方向一致"],
            "common_misconceptions": ["不要暗示速度大则质量大"],
            "forbidden_errors": ["质量随速度变化（经典力学范畴禁止）"],
            "suggested_variables": [{"name": "力", "symbol": "F", "unit": "N", "range_hint": "0-100 N"}],
        }
        llm = _make_llm(json.dumps(model_data))
        agent = ScientificModelAgent(llm)
        result = await agent.extract("牛顿第二定律", "F=ma 的关系", mode="animation")

        assert result is not None
        assert "core_formulas" in result
        assert len(result["core_formulas"]) == 2

    @pytest.mark.asyncio
    async def test_extract_returns_none_on_failure(self):
        from systemedu.core.agents.builtin.scientific_model_agent import ScientificModelAgent
        from unittest.mock import MagicMock
        from langchain_core.messages import AIMessage

        llm = MagicMock()
        llm.invoke = MagicMock(return_value=AIMessage(content="not valid json {{{"))
        agent = ScientificModelAgent(llm)
        result = await agent.extract("test", "test")
        assert result is None

    def test_build_prompt_block_contains_key_fields(self):
        from systemedu.core.agents.builtin.scientific_model_agent import ScientificModelAgent

        model = {
            "core_formulas": ["\\(F = ma\\)"],
            "key_mechanisms": ["力使物体加速"],
            "visual_constraints": ["方向一致"],
            "common_misconceptions": ["速度大质量大"],
            "forbidden_errors": ["因果颠倒"],
        }
        block = ScientificModelAgent.build_prompt_block(model)
        assert "F = ma" in block
        assert "力使物体加速" in block
        assert "速度大质量大" in block
        assert "科学准确性约束" in block

    def test_build_prompt_block_empty_returns_empty(self):
        from systemedu.core.agents.builtin.scientific_model_agent import ScientificModelAgent

        assert ScientificModelAgent.build_prompt_block({}) == ""
        assert ScientificModelAgent.build_prompt_block(None) == ""


# ===== P3: Animation quality scoring — pedagogical dimension =====

class TestAnimationQualityScoring:

    def _make_full_html(self) -> str:
        """Full-featured animation HTML that should pass both dimensions."""
        return """<!DOCTYPE html><html><head>
        <style>
          :root { --bg: #fff; --primary: #1d4ed8; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
          #frame-caption { font-size: 11px; }
          .settle { ease-in-out; }
          .anticipation { ease-in; }
        </style>
        </head><body>
        <svg width="600" height="420" viewBox="0 0 600 420">
          <defs>
            <linearGradient id="g1"><stop offset="0%" stop-color="#fff"/></linearGradient>
            <radialGradient id="g2"><stop offset="0%" stop-color="#00f"/></radialGradient>
          </defs>
          <rect x="0" y="0" width="600" height="420" fill="#eee"/>
          <rect x="50" y="50" width="300" height="200" fill="url(#g1)" opacity="0.8"/>
          <text id="frame-caption" x="24" y="388">第1帧：知识点说明</text>
          <text x="300" y="100">力的作用</text>
          <text class="label" x="200" y="200">知识焦点</text>
        </svg>
        <script>
          const FRAMES = [{"idx":1,"description":"牛顿定律","elements":["力","加速度"],"narration":"力使物体产生加速度"}];
          window.parent.postMessage({type: 'STEP_COMPLETE'}, '*');
        </script>
        </body></html>"""

    def test_score_has_tech_and_ped_keys(self):
        from systemedu.core.agents.builtin.media_art_direction import evaluate_animation_html_quality

        report = evaluate_animation_html_quality(self._make_full_html())
        assert "tech_score" in report
        assert "ped_score" in report
        assert "score" in report
        assert "pass" in report
        assert "issues" in report

    def test_full_html_passes(self):
        from systemedu.core.agents.builtin.media_art_direction import evaluate_animation_html_quality

        report = evaluate_animation_html_quality(self._make_full_html())
        assert report["pass"] is True, f"Expected pass but score={report['score']}, issues={report['issues']}"

    def test_minimal_html_fails(self):
        from systemedu.core.agents.builtin.media_art_direction import evaluate_animation_html_quality

        html = "<html><body><p>hello</p></body></html>"
        report = evaluate_animation_html_quality(html)
        assert report["pass"] is False
        assert report["score"] < 72

    def test_pedagogical_issues_reported(self):
        from systemedu.core.agents.builtin.media_art_direction import evaluate_animation_html_quality

        # Good technical structure but no teaching rhythm or captions
        html = """<html><head><style>
          @keyframes x { from{opacity:0} to{opacity:1} }
          :root { --c: #fff; }
        </style></head><body>
        <svg width="600" height="420">
          <defs><linearGradient id="g"></linearGradient></defs>
          <rect x="0" y="0" width="500" height="300"/>
        </svg>
        <script>window.parent.postMessage({type:'STEP_COMPLETE'},'*')</script>
        </body></html>"""
        report = evaluate_animation_html_quality(html)
        pedagogical_issues = [i for i in report["issues"] if any(
            kw in i for kw in ("节奏", "证据", "焦点", "递进", "标注")
        )]
        assert len(pedagogical_issues) >= 1, f"No pedagogical issues found: {report['issues']}"

    def test_tech_score_capped_at_60(self):
        from systemedu.core.agents.builtin.media_art_direction import evaluate_animation_html_quality

        report = evaluate_animation_html_quality(self._make_full_html())
        assert report["tech_score"] <= 60

    def test_format_feedback_shows_both_scores(self):
        from systemedu.core.agents.builtin.media_art_direction import (
            evaluate_animation_html_quality,
            format_animation_quality_feedback,
        )

        html = "<html><body><svg><rect width='100' height='100'/></svg></body></html>"
        report = evaluate_animation_html_quality(html)
        feedback = format_animation_quality_feedback(report)
        assert "技术分" in feedback
        assert "教学分" in feedback


# ===== ExerciseGenAgent =====

class TestExerciseGenAgent:

    def _make_exercise_response(self):
        exercises = [
            {
                "type": "choice",
                "question": "牛顿第一定律描述的是什么？",
                "options": ["A. 惯性定律", "B. 加速度定律", "C. 作用反作用定律", "D. 万有引力定律"],
                "correct": 0,
                "explanation": "牛顿第一定律描述了物体的惯性：没有外力时，物体保持静止或匀速直线运动。",
            },
            {
                "type": "choice",
                "question": "以下哪个情况符合牛顿第一定律？",
                "options": ["A. 踢球后球继续滚动", "B. 汽车刹车后停止", "C. 真空中运动的飞船匀速直线行驶", "D. 苹果落地"],
                "correct": 2,
                "explanation": "真空中没有阻力，飞船会按惯性保持匀速直线运动。",
            },
        ]
        return json.dumps(exercises, ensure_ascii=False)

    @pytest.mark.asyncio
    async def test_generate_returns_choice_exercises(self):
        from systemedu.core.agents.builtin.exercise_gen_agent import ExerciseGenAgent

        llm = _make_llm(self._make_exercise_response())
        agent = ExerciseGenAgent(llm)
        exercises = await agent.generate(
            node_title="牛顿第一定律",
            node_summary="物体在没有外力时保持静止或匀速直线运动",
            topic="惯性定律理解",
            context_summary="我们刚刚学习了牛顿第一定律",
        )
        assert isinstance(exercises, list)
        assert len(exercises) == 2
        for ex in exercises:
            assert ex["type"] == "choice"
            assert "question" in ex
            assert len(ex["options"]) == 4
            assert isinstance(ex["correct"], int)
            assert "explanation" in ex

    @pytest.mark.asyncio
    async def test_generate_fallback_on_invalid_json(self):
        from systemedu.core.agents.builtin.exercise_gen_agent import ExerciseGenAgent

        llm = _make_llm("这不是有效的JSON")
        agent = ExerciseGenAgent(llm)
        exercises = await agent.generate(
            node_title="测试节点",
            node_summary="",
            topic="测试主题",
            context_summary="",
        )
        assert isinstance(exercises, list)
        assert len(exercises) == 1
        assert exercises[0]["type"] == "short_answer"  # fallback

    @pytest.mark.asyncio
    async def test_generate_filters_invalid_types(self):
        from systemedu.core.agents.builtin.exercise_gen_agent import ExerciseGenAgent

        bad = json.dumps([
            {"type": "unknown", "question": "坏题目"},
            {"type": "choice", "question": "好题目", "options": ["A. 一", "B. 二", "C. 三", "D. 四"], "correct": 0, "explanation": "解析"},
        ])
        llm = _make_llm(bad)
        agent = ExerciseGenAgent(llm)
        exercises = await agent.generate("title", "", "topic", "ctx")
        assert len(exercises) == 1
        assert exercises[0]["type"] == "choice"

    @pytest.mark.asyncio
    async def test_elaborate_exercise_mode_passthrough(self):
        """CourseIdeaDetailAgent should passthrough exercise mode without calling LLM planner."""
        from systemedu.core.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        llm = _make_llm("{}")
        agent = CourseIdeaDetailAgent(llm)
        idea = {"idea_id": "ex-1", "mode": "exercise", "topic": "重力的理解", "context_summary": "重力是万有引力在地球上的表现"}
        result = await agent.elaborate(idea)
        dp = result.get("detail_plan")
        assert dp is not None
        assert dp["mode"] == "exercise"
        assert dp["exercise_count"] == 2
        assert "context_summary" in dp

    def test_integration_agent_handles_exercise_mode(self):
        from systemedu.core.agents.builtin.integration_agent import IntegrationAgent

        exercises = [
            {"type": "choice", "question": "问题", "options": ["A. 一", "B. 二", "C. 三", "D. 四"], "correct": 0, "explanation": "解析"},
        ]
        ideas = [
            {
                "idea_id": "ex-abc",
                "mode": "exercise",
                "topic": "练习",
                "context_summary": "上下文",
                "detail_plan": {"mode": "exercise", "topic": "练习", "context_summary": "上下文", "exercise_count": 2},
                "result": exercises,
            }
        ]
        plan = "## 内容\n\n学习内容[[IDEA:ex-abc]]"
        agent = IntegrationAgent()
        result = agent.integrate(plan, ideas)
        section = result["rendered_sections"]["ex-abc"]
        assert section["mode"] == "exercise"
        assert section["status"] == "ready"
        assert section["exercises"] == exercises
        assert section["html"] is None


# ===== PatternRouterAgent =====

class TestPatternRouterAgent:

    def _make_async_llm(self, response_text: str):
        llm = MagicMock()
        llm.ainvoke = AsyncMock(return_value=AIMessage(content=response_text))
        return llm

    @pytest.mark.asyncio
    async def test_matched_relative_motion(self):
        from systemedu.core.agents.builtin.pattern_router_agent import PatternRouterAgent

        match_resp = json.dumps({
            "matched": True,
            "pattern_id": "relative_motion",
            "reason": "典型相遇问题",
            "params": {
                "title": "甲乙相向而行",
                "total_distance": 300,
                "speed_a": 60,
                "speed_b": 40,
                "label_a": "甲",
                "label_b": "乙",
                "unit": "km/h",
                "distance_unit": "km",
                "mode": "toward",
                "color_a": "#3b82f6",
                "color_b": "#ef4444",
            },
        })
        llm = self._make_async_llm(match_resp)
        agent = PatternRouterAgent(llm)
        result = await agent.route(
            node_title="相遇问题",
            node_summary="甲乙两人相向行走",
            topic="速度与时间的关系",
        )
        assert result["matched"] is True
        assert result["pattern_id"] == "relative_motion"
        assert result["html"] != ""
        # HTML should be rendered with title substituted
        assert "甲乙相向而行" in result["html"]

    @pytest.mark.asyncio
    async def test_no_match_returns_empty_html(self):
        from systemedu.core.agents.builtin.pattern_router_agent import PatternRouterAgent

        no_match_resp = json.dumps({
            "matched": False,
            "pattern_id": None,
            "reason": "知识点不适合任何预制模板",
            "params": {},
        })
        llm = self._make_async_llm(no_match_resp)
        agent = PatternRouterAgent(llm)
        result = await agent.route(
            node_title="微积分概念",
            node_summary="极限与导数",
            topic="导数的几何意义",
        )
        assert result["matched"] is False
        assert result["html"] == ""

    @pytest.mark.asyncio
    async def test_wave_oscillation_spring_mode(self):
        from systemedu.core.agents.builtin.pattern_router_agent import PatternRouterAgent

        match_resp = json.dumps({
            "matched": True,
            "pattern_id": "wave_oscillation",
            "reason": "弹簧振动场景",
            "params": {
                "title": "弹簧简谐运动",
                "mode": "spring",
                "amplitude": 80,
                "period": 2.0,
                "label_mass": "m",
                "label_k": "k=5N/m",
                "show_energy": True,
                "color_main": "#6366f1",
            },
        })
        llm = self._make_async_llm(match_resp)
        agent = PatternRouterAgent(llm)
        result = await agent.route(
            node_title="弹簧振动",
            node_summary="弹簧做简谐运动",
            topic="弹性势能与动能转换",
        )
        assert result["matched"] is True
        assert result["pattern_id"] == "wave_oscillation"
        assert result["html"] != ""
        assert "弹簧简谐运动" in result["html"]

    @pytest.mark.asyncio
    async def test_render_pattern_direct(self):
        """Test render_pattern function directly without LLM."""
        from systemedu.core.agents.builtin.animation_patterns.registry import render_pattern

        html = render_pattern("relative_motion", {
            "title": "测试标题",
            "total_distance": 200,
            "speed_a": 50,
            "speed_b": 30,
            "label_a": "甲",
            "label_b": "乙",
            "unit": "m/s",
            "distance_unit": "m",
            "mode": "toward",
            "color_a": "#3b82f6",
            "color_b": "#ef4444",
        })
        assert html != ""
        assert "测试标题" in html
        assert "<!DOCTYPE html>" in html

    def test_render_pattern_unknown_id(self):
        from systemedu.core.agents.builtin.animation_patterns.registry import render_pattern

        html = render_pattern("nonexistent_pattern", {})
        assert html == ""

    @pytest.mark.asyncio
    async def test_json_parse_from_markdown_fence(self):
        """PatternRouterAgent should handle LLM wrapping JSON in code fence."""
        from systemedu.core.agents.builtin.pattern_router_agent import PatternRouterAgent

        fenced_resp = '```json\n' + json.dumps({
            "matched": True,
            "pattern_id": "projectile",
            "reason": "抛体运动",
            "params": {
                "title": "斜抛运动",
                "mode": "angle",
                "launch_angle": 45,
                "v0": 20,
                "gravity": 10,
                "label_object": "炮弹",
                "show_components": True,
                "color_trail": "#f59e0b",
                "color_object": "#ef4444",
            },
        }) + '\n```'
        llm = self._make_async_llm(fenced_resp)
        agent = PatternRouterAgent(llm)
        result = await agent.route("抛体运动", "斜抛运动", "抛体")
        assert result["matched"] is True
        assert result["html"] != ""
