"""Node tests: CourseIdeaDetailSimplifierAgent."""


class TestCourseIdeaDetailSimplifierNode:
    def test_simplify_animation_caps_complexity(self):
        from systemedu.core.agents.builtin.course_idea_detail_simplifier_agent import (
            CourseIdeaDetailSimplifierAgent,
        )

        raw = {
            "frame_count": 10,
            "frames": [
                {"frame_index": i, "description": f"d{i}", "visual_elements": ["a", "b", "c", "d", "e"]}
                for i in range(10)
            ],
            "beats": [{"t": i * 0.1, "action": "main_action"} for i in range(10)],
        }
        out = CourseIdeaDetailSimplifierAgent().simplify("animation", raw)
        assert out["frame_count"] <= 6
        assert len(out["frames"]) <= 5
        assert all(len(f["visual_elements"]) <= 3 for f in out["frames"])
        assert isinstance(out["persuasion"], dict)

    def test_fallback_story_has_minimum_fields(self):
        from systemedu.core.agents.builtin.course_idea_detail_simplifier_agent import (
            CourseIdeaDetailSimplifierAgent,
        )

        out = CourseIdeaDetailSimplifierAgent().fallback("story", {"topic": "惯性", "style_key": "storybook_vivid"})
        assert out["style_key"] == "storybook_vivid"
        assert len(out["paragraphs"]) >= 3
        assert isinstance(out["persuasion"], dict)
