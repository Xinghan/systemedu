"""5.5d Theory 等级评审 — 每个 theory 跨 level 一次 LLM agent。

注意: 与其它闸门接口不同, 这个闸门接收 theory dict (不是 idea+html)。
pipeline 在 Step 1.5 之后单独跑此闸门(对每个 theory 调一次)。
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from .base import Gate, GateResult
from ..kimi_client import ainvoke, llm_for
from ..progress import STEP_GATE_D

logger = logging.getLogger(__name__)
PROMPT = Path(__file__).parent.parent / "prompts" / "gate_theory_grader.md"


class TheoryGraderGate(Gate):
    name = STEP_GATE_D
    max_revise = 2

    async def run(self, *, html: str | None, idea, ctx, attempt: int = 1) -> GateResult:
        """这里 idea 实际是 theory dict, html 是可选的 animation_html 摘要。"""
        if not isinstance(idea, dict):
            return GateResult("fail", ["theory_grader: idea must be a theory dict"], attempt=attempt)

        knowledge_level = (ctx or {}).get("knowledge_level", "K3")

        anim_excerpt = (html or "")[:2000] if html else "(none)"
        prompt = PROMPT.read_text(encoding="utf-8").format(
            title=idea.get("title", ""),
            subject=idea.get("subject", ""),
            knowledge_level=knowledge_level,
            level_bodies_json=json.dumps(idea.get("level_bodies", []), ensure_ascii=False, indent=2)[:6000],
            animation_html_excerpt=anim_excerpt,
        )

        llm = llm_for("fast", streaming=False, max_tokens=4096)
        try:
            response = await ainvoke(llm, [{"role": "user", "content": prompt}],
                                       label=f"gate_5.5d[{idea.get('theory_id')}-{attempt}]")
        except Exception as exc:
            return GateResult("fail", [f"5.5d LLM crash: {exc}"], attempt=attempt)

        data = _parse_json(response)
        if not isinstance(data, dict):
            return GateResult("fail", ["5.5d LLM returned no JSON"], attempt=attempt)
        verdict = data.get("verdict", "fail")
        issues = list(data.get("issues") or [])
        if verdict == "pass":
            return GateResult("pass", [], attempt=attempt, raw=data)
        return GateResult("fail", issues or ["5.5d theory verdict=fail"], attempt=attempt, raw=data)


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json(s: str):
    s = (s or "").strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    try:
        return json.loads(s)
    except Exception:
        m = _JSON_RE.search(s)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return None
