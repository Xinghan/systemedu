"""StoryGenAgent — generates story paragraphs with images from a story detail plan."""

import asyncio
import logging

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
        if not paragraphs:
            logger.warning("StoryGenAgent: no paragraphs in detail_plan")
            return []

        async def _gen_one(para: dict) -> dict:
            text = para.get("text", "")
            image_prompt = para.get("image_prompt", "")
            image_url = ""
            if image_prompt:
                try:
                    image_url = await generate_image_url(image_prompt)
                except Exception:
                    logger.exception(
                        f"StoryGenAgent: image generation failed for prompt: {image_prompt[:50]}"
                    )
            return {"text": text, "image_url": image_url}

        results = await asyncio.gather(*[_gen_one(p) for p in paragraphs])
        logger.info(f"StoryGenAgent: generated {len(results)} paragraphs")
        return list(results)
