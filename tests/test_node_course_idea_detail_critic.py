"""Node tests: CourseIdeaDetailCriticAgent."""


class TestCourseIdeaDetailCriticNode:
    def test_review_fails_for_over_complex_animation(self):
        from systemedu.core.agents.builtin.course_idea_detail_critic_agent import (
            CourseIdeaDetailCriticAgent,
        )

        detail = {
            "frame_count": 8,
            "frames": [
                {"visual_elements": ["A", "B", "C", "D", "E"]}
                for _ in range(8)
            ],
            "beats": [{"t": i * 0.1, "action": "main_action"} for i in range(8)],
            "layout": {"safe_area_fill": 0.2},
        }
        report = CourseIdeaDetailCriticAgent().review("animation", detail)
        assert report["pass"] is False
        assert report["complexity_score"] < 72
        assert isinstance(report["feedback"], str)

    def test_review_pass_for_simple_game_with_persuasion(self):
        from systemedu.core.agents.builtin.course_idea_detail_critic_agent import (
            CourseIdeaDetailCriticAgent,
        )

        detail = {
            "simulation_params": [
                {"param_name": "a", "min": 0, "max": 100},
                {"param_name": "b", "min": 0, "max": 100},
            ],
            "interaction_flow": ["调参数", "观察", "结论"],
            "visual_storyboard": ["初始", "变化", "结果"],
            "persuasion": {"learning_claim": "A", "evidence": "B", "takeaway": "C"},
            "scene_description": "短描述",
        }
        report = CourseIdeaDetailCriticAgent().review("game", detail)
        assert report["pass"] is True
