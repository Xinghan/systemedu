"""5.5c 科学一致性 — LLM agent 检查物理数值/方向/比例/单位。"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from .base import Gate, GateResult
from ..kimi_client import ainvoke, llm_for
from ..progress import STEP_GATE_C

logger = logging.getLogger(__name__)
PROMPT = Path(__file__).parent.parent / "prompts" / "gate_science.md"


class ScienceGate(Gate):
    name = STEP_GATE_C
    max_revise = 2

    async def run(self, *, html: str | None, idea, ctx, attempt: int = 1) -> GateResult:
        if not html:
            return GateResult("fail", ["empty html"], attempt=attempt)
        knode = (ctx or {}).get("knode") or {}

        # 取关键 HTML 片段(过长会超 token):前 4k + 后 2k
        excerpt = html if len(html) <= 6000 else html[:4000] + "\n\n... (truncated) ...\n\n" + html[-2000:]

        prompt = PROMPT.read_text(encoding="utf-8").format(
            node_title=knode.get("title", "") or knode.get("name", ""),
            category=(ctx or {}).get("category", ""),
            core_question=knode.get("core_question", ""),
            topic=(idea or {}).get("topic", ""),
            detail_summary=_summarize_detail((idea or {}).get("detail_plan") or {}),
            html_excerpt=excerpt,
        )

        llm = llm_for("fast", streaming=False, max_tokens=4096)
        try:
            response = await ainvoke(llm, [{"role": "user", "content": prompt}],
                                       label=f"gate_5.5c[{(idea or {}).get('idea_id')}-{attempt}]")
        except Exception as exc:
            logger.exception(f"[5.5c] LLM failed: {exc}")
            return GateResult("fail", [f"5.5c LLM crash: {exc}"], attempt=attempt)

        data = _parse_json(response)
        if not isinstance(data, dict):
            return GateResult("fail", ["5.5c LLM returned no JSON"], attempt=attempt)
        verdict = data.get("verdict", "fail")
        issues = list(data.get("issues") or [])
        if verdict == "pass":
            return GateResult("pass", [], attempt=attempt, raw=data)
        return GateResult("fail", issues or ["科学性 verdict=fail"], attempt=attempt, raw=data)


def _summarize_detail(d: dict) -> str:
    keys = ("title", "game_concept", "scene_description", "win_condition", "animation_type")
    return "; ".join(f"{k}={d[k]}" for k in keys if k in d)[:500]


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
