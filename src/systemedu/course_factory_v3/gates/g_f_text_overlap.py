"""5.5f 文字重叠 — 用 5.5b 的截图 + LLM 看图判断。

当前简化版: 不接 vision API,改用纯 HTML 启发式 + LLM 文本审。
未来若接 kimi vision (kimi-k2.6 supports_image_in=True),可改为读 5.5b out_dir 的截图传给 LLM。
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from .base import Gate, GateResult
from ..kimi_client import ainvoke, llm_for
from ..progress import STEP_GATE_F

logger = logging.getLogger(__name__)
PROMPT = Path(__file__).parent.parent / "prompts" / "gate_text_overlap.md"


class TextOverlapGate(Gate):
    name = STEP_GATE_F
    max_revise = 1

    async def run(self, *, html: str | None, idea, ctx, attempt: int = 1) -> GateResult:
        if not html:
            return GateResult("fail", ["empty html"], attempt=attempt)

        # 启发式: 抽取所有 ctx.fillText / .innerText / .textContent 调用 + 标签布局
        # LLM 不看图, 只看代码, 判断"是否可能有标签互相覆盖"
        knode = (ctx or {}).get("knode") or {}
        excerpt = html if len(html) <= 6000 else html[:4000] + "\n\n... (truncated) ...\n\n" + html[-2000:]

        prompt = (
            "你是一位**前端布局检察员**。下面是一段 animation/game 的 HTML/JS, 你看不到截图,"
            "但你要从代码中推断: **画面中是否可能有文字标签互相重叠**。\n\n"
            f"## 节点: {knode.get('title', '')}\n"
            f"## idea topic: {(idea or {}).get('topic', '')}\n\n"
            "## HTML 片段\n```html\n" + excerpt + "\n```\n\n"
            "重点检查:\n"
            "- canvas ctx.fillText / strokeText 调用的 x,y 坐标 是否过于接近(< 30px) 而导致文字会叠加?\n"
            "- 多个力箭头/参数标签 是否定位在同一区域?\n"
            "- HUD 元素的 width 是否预留了足够空间放最长的中文标签?\n"
            "- 数据面板的字号 是否过小 (<11px)?\n\n"
            "输出 JSON (无其它文本):\n"
            "```json\n"
            "{\"verdict\": \"pass\", \"overlapping_pairs\": [], \"truncated_text\": [], \"issues\": []}\n"
            "```\n"
            "verdict=pass 当无明显风险。issues 列出具体修复建议。\n"
        )

        llm = llm_for("fast", streaming=False, max_tokens=2048)
        try:
            response = await ainvoke(llm, [{"role": "user", "content": prompt}],
                                       label=f"gate_5.5f[{(idea or {}).get('idea_id')}-{attempt}]")
        except Exception as exc:
            return GateResult("fail", [f"5.5f LLM crash: {exc}"], attempt=attempt)

        data = _parse_json(response)
        if not isinstance(data, dict):
            return GateResult("fail", ["5.5f LLM returned no JSON"], attempt=attempt)
        verdict = data.get("verdict", "fail")
        issues = list(data.get("issues") or [])
        if verdict == "pass":
            return GateResult("pass", [], attempt=attempt, raw=data)
        return GateResult("fail", issues or ["5.5f verdict=fail"], attempt=attempt, raw=data)


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
