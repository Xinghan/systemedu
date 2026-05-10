"""5.5e 游戏性 + 美观 — LLM agent。"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from .base import Gate, GateResult
from ..kimi_client import ainvoke, llm_for
from ..progress import STEP_GATE_E

logger = logging.getLogger(__name__)
PROMPT = Path(__file__).parent.parent / "prompts" / "gate_game_aesthetic.md"


class GameAestheticGate(Gate):
    name = STEP_GATE_E
    max_revise = 2

    async def run(self, *, html: str | None, idea, ctx, attempt: int = 1) -> GateResult:
        if not html:
            return GateResult("fail", ["empty html"], attempt=attempt)

        excerpt = html if len(html) <= 6000 else html[:4000] + "\n\n... (truncated) ...\n\n" + html[-2000:]
        knode = (ctx or {}).get("knode") or {}
        div = (idea or {}).get("divergence") or {}

        prompt = PROMPT.read_text(encoding="utf-8").format(
            node_title=knode.get("title", "") or knode.get("name", ""),
            topic=(idea or {}).get("topic", ""),
            chosen_pattern=div.get("chosen_pattern", "") or (idea or {}).get("mode_reason", ""),
            detail_summary=_summarize((idea or {}).get("detail_plan") or {}),
            html_excerpt=excerpt,
            style_key=(idea or {}).get("style_key", ""),
        )

        llm = llm_for("fast", streaming=False, max_tokens=4096)
        try:
            response = await ainvoke(llm, [{"role": "user", "content": prompt}],
                                       label=f"gate_5.5e[{(idea or {}).get('idea_id')}-{attempt}]")
        except Exception as exc:
            return GateResult("fail", [f"5.5e LLM crash: {exc}"], attempt=attempt)

        data = _parse_json(response)
        if not isinstance(data, dict):
            return GateResult("fail", ["5.5e LLM returned no JSON"], attempt=attempt)
        verdict = data.get("verdict", "fail")
        issues = list(data.get("issues") or [])
        if verdict == "pass":
            return GateResult("pass", [], attempt=attempt, raw=data)
        return GateResult("fail", issues or ["5.5e verdict=fail"], attempt=attempt, raw=data)


def _summarize(d: dict) -> str:
    keys = ("game_concept", "game_mechanic", "win_condition", "scene_description")
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
