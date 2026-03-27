"""StoryGenAgent — generates story paragraphs with images from a story detail plan."""

import asyncio
import logging

from systemedu.agents.builtin.media_art_direction import normalize_story_image_prompt

logger = logging.getLogger(__name__)


class StoryGenAgent:
    """Generates story paragraphs with image URLs from a story detail_plan."""

    async def generate(self, detail_plan: dict) -> list[dict]:
        """Generate story content with images.

        Returns list of {"text": ..., "image_url": ...} dicts.
        Image generation failures are handled gracefully (image_url = "").
        """
        from systemedu.education.image_gen import generate_image_url

        paragraphs = detail_plan.get("paragraphs", [])
        style_key = detail_plan.get("style_key")
        if not paragraphs:
            logger.warning("StoryGenAgent: no paragraphs in detail_plan")
            return []

        async def _gen_one(para: dict) -> dict:
            text = para.get("text", "")
            image_prompt = para.get("image_prompt", "")
            normalized_prompt = normalize_story_image_prompt(
                image_prompt,
                style_key=style_key,
                paragraph_text=text,
            )
            image_url = ""
            if normalized_prompt:
                # Retry up to 3 times with 2s backoff to handle rate limits (429)
                for attempt in range(3):
                    try:
                        image_url = await generate_image_url(normalized_prompt)
                        if image_url:
                            break
                        if attempt < 2:
                            await asyncio.sleep(2)
                    except Exception:
                        logger.exception(
                            "StoryGenAgent: image generation error (attempt %d): %s",
                            attempt + 1,
                            normalized_prompt[:80],
                        )
                        if attempt < 2:
                            await asyncio.sleep(2)
            return {"text": text, "image_url": image_url}

        # Serial generation to avoid Wanx rate limits (2 req/s)
        results = []
        for para in paragraphs:
            results.append(await _gen_one(para))
        logger.info(f"StoryGenAgent: generated {len(results)} paragraphs")
        return results
