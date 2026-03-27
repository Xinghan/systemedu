"""Node tests: IntegrationAgent."""


class TestIntegrationNode:
    def test_integrate_keeps_placeholders_and_metadata(self):
        from systemedu.agents.builtin.integration_agent import IntegrationAgent

        plan = "段落A[[IDEA:i1]]段落B[[IDEA:i2]]"
        ideas = [
            {
                "idea_id": "i1",
                "mode": "animation",
                "style_key": "edu_soft_tech",
                "mode_reason": "动态过程",
                "topic": "力传递",
                "context_summary": "上下文",
                "detail_plan": {"generation_backend": "manim"},
                "result": "<html><svg></svg></html>",
            },
            {
                "idea_id": "i2",
                "mode": "story",
                "style_key": "storybook_vivid",
                "mode_reason": "类比引入",
                "topic": "惯性",
                "context_summary": "上下文",
                "result": [{"text": "故事", "image_url": "/a.png"}],
            },
        ]
        out = IntegrationAgent().integrate(plan, ideas)
        assert "[[IDEA:i1]]" in out["plan_markdown"]
        assert out["ideas"][0]["style_key"] == "edu_soft_tech"
        assert out["ideas"][1]["mode_reason"] == "类比引入"
        assert out["ideas"][0]["generation_backend"] == "manim"
        assert out["rendered_sections"]["i1"]["status"] == "ready"
        assert out["rendered_sections"]["i1"]["generation_backend"] == "manim"
        assert out["rendered_sections"]["i2"]["status"] == "ready"
