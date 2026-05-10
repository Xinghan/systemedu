"""IconGenAgent — generates a compact SVG icon for a project."""

import logging
import re

logger = logging.getLogger(__name__)

ICON_PROMPT = """\
You are an SVG icon designer. Generate a beautiful, unique SVG icon (24x24 viewBox) for a learning project.

Project title: {title}
Category: {category}
Description: {description}

Requirements:
- viewBox="0 0 24 24", no width/height attributes
- Use fill and/or stroke — primary color must be #7c3aed (violet)
- You may use lighter tints like fillOpacity 0.1-0.2 for fills
- Use 1-3 simple geometric paths that visually represent the topic
- Stroke width: 1.5, strokeLinecap="round", strokeLinejoin="round"
- NO text, NO clipPath, NO defs, NO foreignObject, NO <image>
- Output ONLY the raw SVG element, nothing else. No markdown, no explanation.

Example output format:
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="..." stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/></svg>
"""


async def generate_project_icon(
    title: str,
    category: str,
    description: str,
    llm=None,
) -> str:
    """Generate an SVG icon string for the given project.

    Returns the raw SVG string, or empty string on failure.
    """
    if llm is None:
        from systemedu.core.llm_client import get_llm
        llm = get_llm(streaming=False)

    prompt = ICON_PROMPT.format(
        title=title,
        category=category or "other",
        description=(description or "")[:300],
    )

    try:
        response = await llm.ainvoke(prompt)
        raw = response.content if hasattr(response, "content") else str(response)
        raw = raw.strip()

        # Extract SVG element
        match = re.search(r"<svg\b[^>]*>.*?</svg>", raw, re.DOTALL | re.IGNORECASE)
        if not match:
            logger.warning("IconGenAgent: no SVG element found in LLM response")
            return ""

        svg = match.group(0)

        # Safety: strip any disallowed tags
        for tag in ("script", "image", "foreignObject", "use", "defs", "clipPath", "filter"):
            if f"<{tag}" in svg.lower():
                logger.warning(f"IconGenAgent: disallowed tag <{tag}> found, rejecting")
                return ""

        logger.info(f"IconGenAgent: generated icon ({len(svg)} chars) for '{title}'")
        return svg

    except Exception:
        logger.exception(f"IconGenAgent: failed to generate icon for '{title}'")
        return ""
