"""PatternRouterAgent — 根据知识节点上下文识别匹配的参数化动画模板并提取参数。"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from .animation_patterns.registry import PATTERN_REGISTRY, render_pattern

logger = logging.getLogger(__name__)

_SYSTEM = """\
你是一个教育动画路由专家。你的任务是：
1. 判断给定的知识点是否适合使用某个预制动画模板
2. 如果适合，提取模板所需的参数

可用的动画模板列表（pattern_id → 适用场景）：
{pattern_list}

判断规则：
- 只有当知识点的核心概念与模板适用场景高度匹配时，才选择该模板
- 如果没有匹配的模板，返回 matched=false
- 参数提取要贴近知识点的实际内容（如具体速度值、名称等），不要用默认值
- 中文标题、标签优先

输出格式（严格 JSON）：
{{
  "matched": true/false,
  "pattern_id": "模板ID 或 null",
  "reason": "一句话说明匹配原因或不匹配原因",
  "params": {{
    "参数名": 参数值
  }}
}}
"""

_USER_TMPL = """\
知识节点标题：{title}
知识节点摘要：{summary}
动画主题（idea topic）：{topic}
课程上下文：{context}

请判断上述内容是否适合某个预制动画模板，并输出 JSON。
"""


def _build_pattern_list() -> str:
    lines = []
    for pid, info in PATTERN_REGISTRY.items():
        suitable = "、".join(info["suitable_for"])
        lines.append(f"- {pid}：{info['description']}（适合：{suitable}）")
    return "\n".join(lines)


class PatternRouterAgent:
    """LLM 路由 + 参数提取，返回渲染好的 HTML 字符串。"""

    def __init__(self, llm: BaseChatModel) -> None:
        self._llm = llm
        self._pattern_list = _build_pattern_list()

    async def route(
        self,
        node_title: str,
        node_summary: str,
        topic: str,
        context: str = "",
    ) -> dict[str, Any]:
        """返回 {matched, pattern_id, reason, params, html}。

        html 为空字符串表示未匹配或渲染失败。
        """
        system = _SYSTEM.format(pattern_list=self._pattern_list)
        user = _USER_TMPL.format(
            title=node_title,
            summary=node_summary,
            topic=topic,
            context=context or "无",
        )
        messages = [SystemMessage(content=system), HumanMessage(content=user)]

        try:
            resp = await self._llm.ainvoke(messages)
            raw = resp.content.strip()
        except Exception as e:
            logger.error("PatternRouterAgent LLM error: %s", e)
            return {"matched": False, "pattern_id": None, "reason": str(e), "params": {}, "html": ""}

        # Extract JSON
        result = _parse_json(raw)
        if result is None:
            logger.warning("PatternRouterAgent: failed to parse JSON: %s", raw[:200])
            return {"matched": False, "pattern_id": None, "reason": "JSON parse failed", "params": {}, "html": ""}

        matched = result.get("matched", False)
        pattern_id = result.get("pattern_id")
        params = result.get("params", {})

        html = ""
        if matched and pattern_id and pattern_id in PATTERN_REGISTRY:
            # Merge defaults
            defaults = {k: v["default"] for k, v in PATTERN_REGISTRY[pattern_id]["params"].items()}
            merged = {**defaults, **params}
            html = render_pattern(pattern_id, merged)
            if not html:
                logger.warning("PatternRouterAgent: render_pattern returned empty for %s", pattern_id)
                matched = False

        logger.info(
            "PatternRouterAgent: %s → matched=%s pattern=%s",
            node_title, matched, pattern_id,
        )
        return {
            "matched": matched,
            "pattern_id": pattern_id,
            "reason": result.get("reason", ""),
            "params": params,
            "html": html,
        }


def _parse_json(text: str) -> dict | None:
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try extracting from markdown code block
    import re
    m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            pass
    # Try finding JSON object
    m2 = re.search(r"\{[\s\S]+\}", text)
    if m2:
        try:
            return json.loads(m2.group(0))
        except json.JSONDecodeError:
            pass
    return None
