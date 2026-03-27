"""CourseSegmentAgent: split plan_markdown into sections and generate audio scripts."""

import json
import logging
import uuid

logger = logging.getLogger(__name__)

_SEGMENT_PROMPT = """你是一位教育内容结构师，负责将课程学习计划拆分为逻辑清晰的段落，并为每段生成口语化的音频讲解稿。

以下是关于「{node_title}」的课程学习计划（Markdown 格式）：

<plan_markdown>
{plan_markdown}
</plan_markdown>

请完成以下两个任务：

1. 将课程内容按照 ## 标题分段（目标：3-6 段）。如果某段超过约 300 字，在语义完整的地方进一步切割。注意：
   - 保留所有 [[IDEA:xxx]] 占位符，不要删除
   - 保持原始 Markdown 格式（heading、列表等）
   - 每段的 heading 从该段的第一个 ## 标题提取；若无标题则留空字符串

2. 为每段生成口语化的音频讲解稿（audio_script）：
   - 长度：150-250 字
   - 风格：像一位老师在对学生口头讲解，不是复读正文
   - 要点：补充背景知识，解释为什么重要，举一个生活中的例子
   - 语言：中文

请以 JSON 数组格式输出，每个元素包含：
- section_id: 保持空字符串（系统会自动生成）
- heading: 该段标题（string）
- body_markdown: 该段正文（string，保留所有 Markdown 和 [[IDEA:xxx]] 占位符）
- audio_script: 口语化讲解稿（string）

只输出 JSON 数组，不要有其他内容。示例格式：
[
  {{
    "section_id": "",
    "heading": "什么是光合作用",
    "body_markdown": "## 什么是光合作用\\n\\n...",
    "audio_script": "同学们好！今天我们来聊聊植物的超能力——光合作用..."
  }}
]"""


class CourseSegmentAgent:
    """Split plan_markdown into sections and generate per-section audio scripts."""

    def __init__(self, llm):
        self._llm = llm

    async def segment(self, plan_markdown: str, node_title: str) -> list[dict]:
        """Segment plan_markdown and generate audio_script for each section.

        Returns list of dicts with keys:
          section_id, heading, body_markdown, audio_script, audio_url
        """
        import asyncio

        prompt = _SEGMENT_PROMPT.format(
            node_title=node_title,
            plan_markdown=plan_markdown,
        )

        messages = [
            {
                "role": "system",
                "content": "你是专业的教育内容结构师，输出格式严格遵循 JSON 规范。",
            },
            {"role": "user", "content": prompt},
        ]

        try:
            response = await asyncio.to_thread(self._llm.invoke, messages)
            text = response.content if hasattr(response, "content") else str(response)
            text = text.strip()

            # Extract JSON array from response
            start = text.find("[")
            end = text.rfind("]") + 1
            if start == -1 or end == 0:
                raise ValueError("No JSON array found in response")

            segments = json.loads(text[start:end])

            # Assign section_ids and ensure audio_url field
            for seg in segments:
                seg["section_id"] = str(uuid.uuid4())
                seg.setdefault("audio_url", "")
                seg.setdefault("heading", "")
                seg.setdefault("body_markdown", "")
                seg.setdefault("audio_script", "")

            logger.info(
                f"[CourseSegmentAgent] Segmented into {len(segments)} sections for {node_title!r}"
            )
            return segments

        except Exception:
            logger.exception(
                f"[CourseSegmentAgent] Failed to segment plan for {node_title!r}, "
                "falling back to single section"
            )
            # Fallback: treat entire plan as one section
            return [
                {
                    "section_id": str(uuid.uuid4()),
                    "heading": node_title,
                    "body_markdown": plan_markdown,
                    "audio_script": "",
                    "audio_url": "",
                }
            ]
