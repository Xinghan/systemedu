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
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        llm = _make_llm("## 学习目标\n\n1. 理解力的概念\n\n## 正文\n\n力是物体间的相互作用。")
        agent = CoursePlannerAgent(llm)
        result = await agent.plan_detailed("力", "关于力的基本概念", 3, "物理基础")
        assert isinstance(result, str)
        assert len(result) > 10

    @pytest.mark.asyncio
    async def test_plan_detailed_empty_on_failure(self):
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

        llm = MagicMock()
        llm.invoke = MagicMock(side_effect=RuntimeError("LLM error"))
        agent = CoursePlannerAgent(llm)
        result = await agent.plan_detailed("力", "力的概念", 3)
        assert result == ""

    @pytest.mark.asyncio
    async def test_plan_detailed_empty_response(self):
        from systemedu.agents.builtin.course_planner import CoursePlannerAgent

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
        from systemedu.agents.builtin.course_idea_agent import CourseIdeaAgent

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
        from systemedu.agents.builtin.course_idea_agent import CourseIdeaAgent

        llm = _make_llm("no separator here")
        agent = CourseIdeaAgent(llm)
        original = "## 学习目标\n内容"
        plan_text, ideas = await agent.identify(original, "力")
        assert plan_text == original
        assert ideas == []

    @pytest.mark.asyncio
    async def test_identify_filters_invalid_mode(self):
        from systemedu.agents.builtin.course_idea_agent import CourseIdeaAgent

        plan = "内容[[IDEA:abc]]"
        bad_ideas = [{"idea_id": "abc", "mode": "invalid", "topic": "x", "context_summary": "y"}]
        llm = _make_llm(f"{plan}\n---SEPARATOR---\n{json.dumps(bad_ideas)}")
        agent = CourseIdeaAgent(llm)
        plan_text, ideas = await agent.identify("内容", "力")
        assert ideas == []

    @pytest.mark.asyncio
    async def test_identify_handles_prefix_text_before_json(self):
        """Regression: LLM sometimes outputs description text before the JSON array after SEPARATOR."""
        from systemedu.agents.builtin.course_idea_agent import CourseIdeaAgent

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
        from systemedu.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

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
        from systemedu.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

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
        from systemedu.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

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
        from systemedu.agents.builtin.course_idea_detail_agent import CourseIdeaDetailAgent

        llm = _make_llm("{}")
        agent = CourseIdeaDetailAgent(llm)
        idea = {"idea_id": "i4", "mode": "unknown", "topic": "x", "context_summary": "y"}
        result = await agent.elaborate(idea)
        # Unknown mode: detail_plan not set (key absent or None)
        assert result.get("detail_plan") is None


# ===== AnimationGenAgent =====

class TestAnimationGenAgent:

    @pytest.mark.asyncio
    async def test_generate_returns_html(self):
        from systemedu.agents.builtin.animation_gen_agent import AnimationGenAgent

        html_output = """<!DOCTYPE html><html><head><style>
        @keyframes move { from { opacity: 0; } to { opacity: 1; } }
        .box { animation: move 2s; }
        </style></head><body>
        <svg viewBox="0 0 600 400"><rect class="box" x="10" y="10" width="100" height="50"/></svg>
        </body></html>"""

        llm = _make_llm(html_output)
        agent = AnimationGenAgent(llm)
        detail = {
            "title": "力传递动画",
            "frame_count": 2,
            "frames": [{"frame_index": 0, "description": "状态1", "visual_elements": ["A"]}],
            "style_hint": "科技感",
            "animation_type": "物理过程",
        }
        result = await agent.generate(detail, "力")
        assert "<svg" in result
        assert "animation" in result.lower()

    @pytest.mark.asyncio
    async def test_generate_empty_on_missing_svg(self):
        from systemedu.agents.builtin.animation_gen_agent import AnimationGenAgent

        llm = _make_llm("<html><body>no svg here</body></html>")
        agent = AnimationGenAgent(llm)
        detail = {
            "title": "t",
            "frame_count": 1,
            "frames": [{"frame_index": 0, "description": "d", "visual_elements": []}],
            "style_hint": "科技感",
            "animation_type": "物理过程",
        }
        result = await agent.generate(detail, "力")
        assert result == ""

    @pytest.mark.asyncio
    async def test_generate_empty_frames(self):
        from systemedu.agents.builtin.animation_gen_agent import AnimationGenAgent

        llm = _make_llm("<html></html>")
        agent = AnimationGenAgent(llm)
        result = await agent.generate({"frames": []}, "力")
        assert result == ""


# ===== IntegrationAgent =====

class TestIntegrationAgent:

    def test_integrate_basic(self):
        from systemedu.agents.builtin.integration_agent import IntegrationAgent

        plan = "学习内容\n[[IDEA:id-1]]\n更多内容\n[[IDEA:id-2]]"
        ideas = [
            {
                "idea_id": "id-1",
                "mode": "animation",
                "topic": "力传递",
                "context_summary": "力",
                "detail_plan": {"title": "动画"},
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
        assert result["rendered_sections"]["id-1"]["mode"] == "animation"
        assert result["rendered_sections"]["id-2"]["mode"] == "story"
        assert result["rendered_sections"]["id-2"]["story_paragraphs"] is not None

    def test_integrate_empty_ideas(self):
        from systemedu.agents.builtin.integration_agent import IntegrationAgent

        plan = "学习内容"
        agent = IntegrationAgent()
        result = agent.integrate(plan, [])
        assert result["plan_markdown"] == plan
        assert result["ideas"] == []
        assert result["rendered_sections"] == {}

    def test_integrate_failed_result(self):
        from systemedu.agents.builtin.integration_agent import IntegrationAgent

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
        monkeypatch.setenv("SYSTEMEDU_HOME", str(tmp_path))
        from systemedu.storage import db as _db
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
        monkeypatch.setenv("SYSTEMEDU_HOME", str(tmp_path))
        from systemedu.storage import db as _db
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

            from systemedu.education.lesson_generator import _course_content_to_dict
            data = _course_content_to_dict(lesson)
            assert data["status"] == "ready"
            assert data["course_content"]["plan_markdown"] == "## 目标\n内容"
        finally:
            session.close()
            _db.reset_db()


# ===== CourseSegmentAgent =====

class TestCourseSegmentAgent:

    @pytest.mark.asyncio
    async def test_segment_returns_sections(self):
        from systemedu.agents.builtin.course_segment_agent import CourseSegmentAgent

        response_json = json.dumps([
            {
                "section_id": "",
                "heading": "什么是力",
                "body_markdown": "## 什么是力\n\n力是物体间的相互作用。",
                "audio_script": "同学们好，今天我们聊聊力的概念。",
            },
            {
                "section_id": "",
                "heading": "力的类型",
                "body_markdown": "## 力的类型\n\n[[IDEA:idea-1]]\n\n重力和摩擦力是常见的力。",
                "audio_script": "力有很多种类，我们来认识几种常见的。",
            },
        ])
        llm = _make_llm(response_json)
        agent = CourseSegmentAgent(llm)
        sections = await agent.segment(
            plan_markdown="## 什么是力\n\n力是物体间的相互作用。\n\n## 力的类型\n\n重力和摩擦力是常见的力。",
            node_title="力",
        )

        assert len(sections) == 2
        for s in sections:
            assert "section_id" in s
            assert len(s["section_id"]) > 0  # UUID assigned
            assert "heading" in s
            assert "body_markdown" in s
            assert "audio_script" in s
            assert "audio_url" in s

        assert sections[0]["heading"] == "什么是力"
        assert "[[IDEA:idea-1]]" in sections[1]["body_markdown"]

    @pytest.mark.asyncio
    async def test_segment_fallback_on_invalid_json(self):
        from systemedu.agents.builtin.course_segment_agent import CourseSegmentAgent

        llm = _make_llm("这不是 JSON")
        agent = CourseSegmentAgent(llm)
        plan = "## 学习目标\n\n理解基本概念。"
        sections = await agent.segment(plan_markdown=plan, node_title="测试节点")

        assert len(sections) == 1
        assert sections[0]["body_markdown"] == plan
        assert sections[0]["audio_url"] == ""

    @pytest.mark.asyncio
    async def test_segment_preserves_idea_placeholders(self):
        from systemedu.agents.builtin.course_segment_agent import CourseSegmentAgent

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
