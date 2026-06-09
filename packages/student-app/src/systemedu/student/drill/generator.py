"""知识钻取: 专用 prompt 调 LLM 生成结构化下钻知识 (spec 2026-06-09).

与 tutor chat 区分: 直接、完整、儿童友好地讲解高亮知识点 (不反问/不苏格拉底)。
输出固定 5 字段 JSON。
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

log = logging.getLogger(__name__)

DRILL_PROMPT = """你是一个面向 6-18 岁孩子的科学知识讲解员。学生在课文里高亮了一个不熟悉的知识点，
想要一份直接、完整、好懂的资料 (不是反问引导，就是把它讲清楚)。

当前课程节点: {knode_title}
课程上下文 (节选): {knode_context}

学生高亮的知识点:
{highlight_text}

请生成一份结构化讲解，严格输出如下 JSON (不要 markdown 代码块、不要多余文字):
{{
  "simple_explanation": "用一句大白话讲清这是什么",
  "why_matters": "为什么重要 / 用在哪",
  "analogy": "一个生活化类比帮孩子理解",
  "key_points": ["关键点1", "关键点2", "关键点3"],
  "go_deeper": "想更深可以了解的延伸方向"
}}
要求: 中文、口吻友好、准确、贴合孩子认知; key_points 给 3-5 条。"""

_FIELDS = ("simple_explanation", "why_matters", "analogy", "key_points", "go_deeper")


def _strip_fence(t: str) -> str:
    t = t.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def parse_drill(raw: str) -> dict[str, Any]:
    """解析 LLM 输出为固定 5 字段 dict。非 JSON 降级: raw 进 simple_explanation。"""
    try:
        obj = json.loads(_strip_fence(raw))
        if not isinstance(obj, dict):
            raise ValueError("not a dict")
    except Exception:
        log.warning("drill output not JSON, degrading: %r", raw[:120])
        return {
            "simple_explanation": raw.strip(),
            "why_matters": "",
            "analogy": "",
            "key_points": [],
            "go_deeper": "",
        }
    out: dict[str, Any] = {}
    for f in _FIELDS:
        v = obj.get(f)
        if f == "key_points":
            out[f] = v if isinstance(v, list) else ([] if v in (None, "") else [str(v)])
        else:
            out[f] = str(v) if v is not None else ""
    return out


async def generate_drill(highlight_text: str, knode_title: str, knode_context: str) -> dict[str, Any]:
    """调 LLM 生成下钻知识。失败抛异常由调用方处理。"""
    from systemedu.core.llm_client import get_llm
    from langchain_core.messages import HumanMessage

    prompt = DRILL_PROMPT.format(
        knode_title=knode_title or "(未知)",
        knode_context=(knode_context or "")[:1500],
        highlight_text=highlight_text[:500],
    )
    llm = get_llm()
    resp = await llm.ainvoke([HumanMessage(content=prompt)])
    raw = resp.content if hasattr(resp, "content") else str(resp)
    raw = raw if isinstance(raw, str) else str(raw)
    return parse_drill(raw)


__all__ = ["DRILL_PROMPT", "parse_drill", "generate_drill"]
