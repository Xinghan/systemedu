"""spec 031 P7: qwen-plus judge.

输入:
  - question: 学生问题
  - answer: tutor 实际回答
  - expected_facets / bad_facets: 数据集字段
输出:
  - JudgeResult(score_relevance, score_factual, score_personalization,
                hit_facets, miss_facets, hit_bad_facets, reason)
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import HumanMessage

log = logging.getLogger(__name__)


JUDGE_PROMPT = """你是一个教学 AI 回答质量评审员。给定 (学生问题, AI 助教回答),
按下面 3 个维度 0-100 打分, 然后逐条匹配预期/反向要点。

学生问题:
{question}

AI 助教回答:
{answer}

预期应覆盖的要点 (expected_facets, 命中越多越好):
{expected}

不应出现的内容 (bad_facets, 出现就扣分):
{bad}

打分维度:
- relevance: 答到提问者的问题没有? 答非所问扣分.
- factual: 内容是否正确无幻觉? 错的知识点扣大分.
- personalization: 是否用了学生背景 / 当前所学模块? 答得通用空洞扣分.

输出严格 JSON (不要 markdown 代码块):
{{
  "score_relevance": 0-100,
  "score_factual": 0-100,
  "score_personalization": 0-100,
  "hit_facets": [被回答覆盖的 expected_facets 索引列表],
  "miss_facets": [漏掉的 expected_facets 索引列表],
  "hit_bad_facets": [不慎出现的 bad_facets 索引列表],
  "reason": "<=150字简短评语"
}}
"""


@dataclass
class JudgeResult:
    score_relevance: int
    score_factual: int
    score_personalization: int
    hit_facets: list[int] = field(default_factory=list)
    miss_facets: list[int] = field(default_factory=list)
    hit_bad_facets: list[int] = field(default_factory=list)
    reason: str = ""

    @property
    def overall(self) -> int:
        return int(round(
            (self.score_relevance + self.score_factual + self.score_personalization) / 3
        ))


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


async def judge(
    llm: Any,
    *,
    question: str,
    answer: str,
    expected_facets: list[str],
    bad_facets: list[str],
) -> JudgeResult:
    prompt = JUDGE_PROMPT.format(
        question=question,
        answer=answer,
        expected="\n".join(f"  [{i}] {f}" for i, f in enumerate(expected_facets)) or "  (无)",
        bad="\n".join(f"  [{i}] {f}" for i, f in enumerate(bad_facets)) or "  (无)",
    )
    resp = await llm.ainvoke([HumanMessage(content=prompt)])
    text = resp.content if hasattr(resp, "content") else str(resp)
    if isinstance(text, list):
        text = "".join(p if isinstance(p, str) else p.get("text", "") for p in text)
    text = _FENCE_RE.sub("", text).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        log.warning("judge returned non-JSON: %r", text[:200])
        return JudgeResult(0, 0, 0, [], list(range(len(expected_facets))), [],
                           reason="judge parse failed")
    return JudgeResult(
        score_relevance=int(data.get("score_relevance", 0)),
        score_factual=int(data.get("score_factual", 0)),
        score_personalization=int(data.get("score_personalization", 0)),
        hit_facets=list(data.get("hit_facets") or []),
        miss_facets=list(data.get("miss_facets") or []),
        hit_bad_facets=list(data.get("hit_bad_facets") or []),
        reason=str(data.get("reason", ""))[:300],
    )


__all__ = ["judge", "JudgeResult", "JUDGE_PROMPT"]
