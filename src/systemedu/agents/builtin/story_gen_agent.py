"""StoryGenAgent — generates story paragraphs (text only, spec 022).

spec 022 移除了 Wanx 多模态 LLM (image_gen.py 已删), 故事段落只产出
text, 不再带 image_url。等将来加回多模态配置 (新 spec) 再恢复图片。
"""

import logging

logger = logging.getLogger(__name__)


class StoryGenAgent:
    """Generates story paragraphs (text-only) from a story detail_plan."""

    async def generate(self, detail_plan: dict) -> list[dict]:
        """Generate story content as text-only paragraphs.

        Returns list of {"text": ..., "image_url": ""} dicts (image_url 留
        空, 前端 fallback 不渲染图)。
        """
        paragraphs = detail_plan.get("paragraphs", [])
        if not paragraphs:
            logger.warning("StoryGenAgent: no paragraphs in detail_plan")
            return []

        results = [{"text": para.get("text", ""), "image_url": ""} for para in paragraphs]
        logger.info(f"StoryGenAgent: generated {len(results)} text-only paragraphs (spec 022: no image gen)")
        return results
