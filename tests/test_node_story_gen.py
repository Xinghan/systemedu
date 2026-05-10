"""StoryGenAgent test (spec 022: text-only, no image gen)."""

import pytest


class TestStoryGenNode:
    @pytest.mark.asyncio
    async def test_generate_returns_text_only_paragraphs(self):
        """spec 022: image_gen.py 已删, story 只产出 text + 空 image_url"""
        from systemedu.core.agents.builtin import story_gen_agent as story_mod

        detail = {
            "style_key": "storybook_vivid",
            "paragraphs": [
                {"text": "小明在做实验，观察到了变化。", "image_prompt": "a kid"},
                {"text": "他记录了实验结果。", "image_prompt": "writing notes"},
            ],
        }
        out = await story_mod.StoryGenAgent().generate(detail)
        assert len(out) == 2
        assert out[0]["text"] == "小明在做实验，观察到了变化。"
        assert out[0]["image_url"] == ""
        assert out[1]["image_url"] == ""

    @pytest.mark.asyncio
    async def test_generate_empty_paragraphs(self):
        from systemedu.core.agents.builtin import story_gen_agent as story_mod
        out = await story_mod.StoryGenAgent().generate({"paragraphs": []})
        assert out == []
