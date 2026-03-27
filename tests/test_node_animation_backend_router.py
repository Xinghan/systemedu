"""Node tests: AnimationBackendRouterAgent."""

import pytest


class TestAnimationBackendRouterNode:
    @pytest.mark.asyncio
    async def test_route_math_formula_to_manim(self):
        from systemedu.agents.builtin.animation_backend_router_agent import (
            AnimationBackendRouterAgent,
        )

        router = AnimationBackendRouterAgent(llm=None)
        result = await router.route(
            node_title="勾股定理公式推导",
            node_summary="通过 a^2 + b^2 = c^2 展示直角三角形关系",
            project_category="math",
            detail_plan={"frames": [{"description": "展示公式与三角形"}]},
        )
        assert result["backend"] == "manim"
        assert result["subject_hint"] == "math_formula"

    @pytest.mark.asyncio
    async def test_route_general_visual_to_html_svg(self):
        from systemedu.agents.builtin.animation_backend_router_agent import (
            AnimationBackendRouterAgent,
        )

        router = AnimationBackendRouterAgent(llm=None)
        result = await router.route(
            node_title="红外遥控器工作过程",
            node_summary="通过遥控器和电视展示信号传输",
            project_category="other",
            detail_plan={"frames": [{"description": "遥控器发信号"}]},
        )
        assert result["backend"] == "html_svg"
