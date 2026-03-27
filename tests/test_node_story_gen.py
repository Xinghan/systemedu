"""Node tests: StoryGenAgent."""

import pytest


class TestStoryGenNode:
    @pytest.mark.asyncio
    async def test_generate_normalizes_prompt_and_returns_image_url(self, monkeypatch):
        from systemedu.agents.builtin import story_gen_agent as story_mod

        captured = {"prompt": ""}

        async def _fake_gen_image(prompt: str) -> str:
            captured["prompt"] = prompt
            return "/api/media/story_images/a.png"

        monkeypatch.setattr(
            "systemedu.education.image_gen.generate_image_url",
            _fake_gen_image,
        )

        detail = {
            "style_key": "storybook_vivid",
            "paragraphs": [
                {
                    "text": "小明在做实验，观察到了变化。",
                    "image_prompt": "a kid in classroom",
                }
            ],
        }
        out = await story_mod.StoryGenAgent().generate(detail)
        assert len(out) == 1
        assert out[0]["image_url"] == "/api/media/story_images/a.png"
        assert "no text" in captured["prompt"].lower()
