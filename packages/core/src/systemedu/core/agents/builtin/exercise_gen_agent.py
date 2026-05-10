"""ExerciseGenAgent — generates inline quiz exercises for a knowledge point."""

import asyncio
import json
import logging
import re

logger = logging.getLogger(__name__)

EXERCISE_GEN_PROMPT = """你是一位教育内容设计师，为课程内容设计轻量级即时检测题。

知识节点：{node_title}
练习主题：{topic}
上下文（刚刚学过的内容）：{context_summary}

请设计 {count} 道选择题，帮助学生快速核对对上方内容的理解。

要求：
- 全部是选择题，每题 4 个选项
- 题目直接考查刚才这段内容的核心概念，不要出范围外的题
- 语言简洁，适合青少年
- 每题附 1-2 句解析，帮助学生理解为什么答案正确
- 答对应有成就感，题目不要过难

只输出 JSON 数组（不要任何其他内容）：
[
  {{
    "type": "choice",
    "question": "题目内容",
    "options": ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"],
    "correct": 0,
    "explanation": "简短解析（1-2句）"
  }}
]

correct 字段为正确选项的下标（0-3）。选项格式必须以 "A. "、"B. " 等开头。
"""


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        end = len(lines)
        if lines[-1].strip() == "```":
            end = -1
        text = "\n".join(lines[1:end]).strip()
    return text


def _extract_json_array(text: str) -> str:
    """Extract the first JSON array from text."""
    bracket_start = text.find("[")
    if bracket_start == -1:
        return text
    # Find matching closing bracket
    depth = 0
    for i in range(bracket_start, len(text)):
        if text[i] == "[":
            depth += 1
        elif text[i] == "]":
            depth -= 1
            if depth == 0:
                return text[bracket_start:i + 1]
    return text[bracket_start:]


class ExerciseGenAgent:
    """Generates 2-3 inline quiz exercises for a course idea (exercise mode).

    Returns a list of exercise dicts, each with:
      - type: "choice" | "short_answer"
      - question: str
      - options: list[str] (choice only)
      - correct: int (choice only)
      - explanation: str (choice only)
      - hint: str (short_answer only, optional)
      - sample_answer: str (short_answer only)
    """

    DEFAULT_COUNT = 2

    def __init__(self, llm):
        self.llm = llm

    async def generate(
        self,
        node_title: str,
        node_summary: str,
        topic: str,
        context_summary: str,
        count: int = DEFAULT_COUNT,
    ) -> list[dict]:
        """Generate inline exercises. Returns list of exercise dicts.

        On failure, returns a minimal fallback exercise list.
        """
        from langchain_core.messages import HumanMessage

        prompt = EXERCISE_GEN_PROMPT.format(
            node_title=node_title,
            node_summary=node_summary[:300] if node_summary else "",
            topic=topic,
            context_summary=context_summary[:300] if context_summary else "",
            count=count,
        )

        try:
            response = await asyncio.to_thread(
                self.llm.invoke, [HumanMessage(content=prompt)]
            )
            raw = _strip_code_fence(response.content.strip())
            raw = _extract_json_array(raw)
            exercises = json.loads(raw)

            if not isinstance(exercises, list) or not exercises:
                logger.warning("ExerciseGenAgent: empty or non-list response for '%s'", topic)
                return self._fallback(topic)

            validated = []
            for ex in exercises:
                if not isinstance(ex, dict):
                    continue
                ex_type = ex.get("type", "")
                if ex_type not in ("choice", "short_answer"):
                    continue
                if not ex.get("question"):
                    continue
                if ex_type == "choice":
                    options = ex.get("options", [])
                    if len(options) < 2:
                        continue
                    validated.append({
                        "type": "choice",
                        "question": ex["question"],
                        "options": options[:4],
                        "correct": int(ex.get("correct", 0)),
                        "explanation": ex.get("explanation", ""),
                    })
                else:
                    validated.append({
                        "type": "short_answer",
                        "question": ex["question"],
                        "hint": ex.get("hint", ""),
                        "sample_answer": ex.get("sample_answer", ""),
                    })

            if not validated:
                logger.warning("ExerciseGenAgent: no valid exercises after validation for '%s'", topic)
                return self._fallback(topic)

            logger.info("ExerciseGenAgent: generated %d exercises for '%s'", len(validated), topic)
            return validated

        except (json.JSONDecodeError, TypeError):
            logger.exception("ExerciseGenAgent: JSON parse error for '%s'", topic)
            return self._fallback(topic)
        except Exception:
            logger.exception("ExerciseGenAgent: unexpected error for '%s'", topic)
            return self._fallback(topic)

    def _fallback(self, topic: str) -> list[dict]:
        return [
            {
                "type": "short_answer",
                "question": f"用自己的话描述一下你对「{topic}」的理解。",
                "hint": "可以结合刚才学到的内容来思考。",
                "sample_answer": "答案因人而异，关键是能说出核心概念。",
            }
        ]
