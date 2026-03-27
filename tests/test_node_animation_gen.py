"""Node tests: AnimationGenAgent."""

from unittest.mock import MagicMock

import pytest
from langchain_core.messages import AIMessage


def _make_llm(response_text: str):
    llm = MagicMock()
    llm.invoke = MagicMock(return_value=AIMessage(content=response_text))
    return llm


class TestAnimationGenNode:
    @pytest.mark.asyncio
    async def test_generate_fallback_when_html_unusable(self):
        from systemedu.agents.builtin.animation_gen_agent import AnimationGenAgent

        llm = _make_llm("<html><body>bad output</body></html>")
        detail = {
            "title": "测试动画",
            "frames": [{"frame_index": 0, "description": "状态", "visual_elements": ["A"]}],
        }
        html = await AnimationGenAgent(llm).generate(detail, "力")
        assert "<svg" in html.lower()
        assert "step_complete" in html.lower()

    @pytest.mark.asyncio
    async def test_generate_keeps_valid_html(self):
        from systemedu.agents.builtin.animation_gen_agent import AnimationGenAgent

        good = """<!DOCTYPE html><html><head><style>:root{--x:1}@keyframes k{from{opacity:0}to{opacity:1}}</style></head>
        <body><svg viewBox='0 0 600 420'><defs><linearGradient id='g'/></defs><rect width='300' height='200'/><text>ok</text></svg>
        <script>window.parent.postMessage({type:'STEP_COMPLETE'},'*')</script></body></html>"""
        llm = _make_llm(good)
        detail = {
            "title": "测试动画",
            "frames": [{"frame_index": 0, "description": "状态", "visual_elements": ["A"]}],
        }
        html = await AnimationGenAgent(llm).generate(detail, "力")
        assert "step_complete" in html.lower()

    @pytest.mark.asyncio
    async def test_generate_uses_manim_html_when_router_selects_manim(self):
        from systemedu.agents.builtin.animation_gen_agent import AnimationGenAgent

        llm = _make_llm("<html></html>")
        agent = AnimationGenAgent(llm)

        class _Router:
            async def route(self, **kwargs):
                return {
                    "backend": "manim",
                    "subject_hint": "math_formula",
                    "reason": "公式动画",
                    "confidence": 0.9,
                }

        class _Manim:
            async def generate(self, **kwargs):
                return "<!DOCTYPE html><html><body><video></video><script>window.parent.postMessage({type:'STEP_COMPLETE'},'*')</script></body></html>"

        agent.router = _Router()
        agent.manim = _Manim()
        detail = {
            "title": "勾股定理",
            "frames": [{"frame_index": 0, "description": "公式", "visual_elements": ["三角形"]}],
        }
        html = await agent.generate(detail, "勾股定理", node_summary="公式推导", project_category="math")
        assert "<video" in html.lower()
