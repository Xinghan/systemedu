"""CourseSegmentAgent: split plan_markdown into sections and generate audio scripts.

Segmentation is done by pure Python (split on ## headings) to guarantee
that [[IDEA:xxx]] placeholders are never lost. LLM is only used to generate
per-section audio_script.
"""

import json
import logging
import re
import uuid

logger = logging.getLogger(__name__)

_AUDIO_SCRIPT_PROMPT = """你是一位教育内容讲解师。请为以下课程段落生成口语化的音频讲解稿。

课程主题：{node_title}
段落标题：{heading}
段落正文：
{body}

要求：
- 长度：100-200 字
- 风格：像一位老师在对学生口头讲解，不是复读正文
- 要点：补充背景知识，解释为什么重要，举一个生活中的例子
- 语言：中文
- 直接输出讲解稿内容，不要有标题或前言
"""


def _split_by_headings(plan_markdown: str) -> list[dict]:
    """Split plan_markdown by ## and ### headings using pure Python.

    Guarantees that all [[IDEA:xxx]] placeholders are preserved in their
    original positions. Splits on both ## and ### to ensure ideas are
    placed in the correct sub-section.
    """
    lines = plan_markdown.split("\n")
    sections: list[dict] = []
    current_heading = ""
    current_lines: list[str] = []

    for line in lines:
        # Detect ## or ### heading
        heading_match = re.match(r"^(#{2,3})\s+(.+)", line)
        if heading_match:
            # Save previous section if it has content
            if current_lines:
                body = "\n".join(current_lines).strip()
                if body:
                    sections.append({
                        "section_id": str(uuid.uuid4()),
                        "heading": current_heading,
                        "body_markdown": body,
                        "audio_script": "",
                        "audio_url": "",
                    })
            # Start new section
            current_heading = heading_match.group(2).strip()
            current_lines = [line]
        else:
            current_lines.append(line)

    # Don't forget the last section
    if current_lines:
        body = "\n".join(current_lines).strip()
        if body:
            sections.append({
                "section_id": str(uuid.uuid4()),
                "heading": current_heading,
                "body_markdown": body,
                "audio_script": "",
                "audio_url": "",
            })

    # If no headings were found, return the whole plan as one section
    if not sections:
        sections.append({
            "section_id": str(uuid.uuid4()),
            "heading": "",
            "body_markdown": plan_markdown.strip(),
            "audio_script": "",
            "audio_url": "",
        })

    return sections


class CourseSegmentAgent:
    """Split plan_markdown into sections and generate per-section audio scripts.

    Segmentation uses pure Python (## heading split) to guarantee placeholder
    preservation. LLM is only called for audio_script generation.
    """

    def __init__(self, llm):
        self._llm = llm

    async def segment(self, plan_markdown: str, node_title: str) -> list[dict]:
        """Segment plan_markdown and generate audio_script for each section.

        Returns list of dicts with keys:
          section_id, heading, body_markdown, audio_script, audio_url
        """
        import asyncio

        # Step 1: Pure Python split — placeholders guaranteed preserved
        sections = _split_by_headings(plan_markdown)

        logger.info(
            f"[CourseSegmentAgent] Split into {len(sections)} sections for {node_title!r}"
        )

        # Step 2: Generate audio_script for each section via LLM (parallel)
        async def _gen_audio(sec: dict) -> dict:
            # Skip sections that are just placeholders with no real text
            body_text = re.sub(r'\[\[IDEA:[^\]]+\]\]', '', sec["body_markdown"]).strip()
            body_text = re.sub(r'^##\s+.*$', '', body_text, flags=re.MULTILINE).strip()
            if len(body_text) < 30:
                return sec

            prompt = _AUDIO_SCRIPT_PROMPT.format(
                node_title=node_title,
                heading=sec["heading"] or node_title,
                body=body_text[:800],
            )
            try:
                response = await asyncio.to_thread(
                    self._llm.invoke,
                    [{"role": "user", "content": prompt}],
                )
                text = response.content if hasattr(response, "content") else str(response)
                sec["audio_script"] = text.strip()
            except Exception:
                logger.warning(
                    f"[CourseSegmentAgent] Failed to generate audio_script for section "
                    f"{sec['heading']!r}, skipping"
                )
            return sec

        sections = list(await asyncio.gather(*[_gen_audio(s) for s in sections]))

        return sections
