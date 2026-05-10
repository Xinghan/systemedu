"""Step 5 — Diagram HTML 生成 (LLM)。"""

from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path

from ..kimi_client import ainvoke, llm_for
from ..theme_loader import pick_theme
from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)


async def implement(idea: dict, ctx: dict, *, em: Emitter) -> dict | None:
    detail_plan = idea.get("detail_plan") or {}
    style_key = idea.get("style_key") or detail_plan.get("style_key") or ctx.get("category") or "space"
    theme = pick_theme(style_key)

    prompt = f"""# 生成 Diagram HTML/SVG

为以下 STEM 节点生成一张静态示意图,纯自包含 HTML(可含 inline SVG 或 Canvas 静态绘制)。

## detail_plan
```json
{json.dumps(detail_plan, ensure_ascii=False, indent=2)}
```

## theme palette ({theme.id})
{theme.as_prompt_block()}

## 要求
- 单文件自包含 HTML (`<!DOCTYPE html>` 到 `</html>`)
- body overflow:hidden / height:100vh / margin:0
- 0px 圆角 / 渐变 / ambient glow
- 颜色仅从上方 5 色 palette 中选
- 字体 Space Grotesk + Noto Sans SC
- 标注清晰, 关键元素带短标签(中英都可,但不要过多文字)
- **静态**: 无动画, 无交互(diagram 是静态示意图)
- 长度合理(50-300 行)

直接输出**完整 HTML**, 不要前言/后记/代码块标记。
"""

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementDiagram", "phase": "input",
        "input": f"idea={idea.get('idea_id')}, theme={theme.id}",
        "output": "(generating...)",
    })

    llm = llm_for("fast", streaming=False)
    try:
        html = await ainvoke(llm, [{"role": "user", "content": prompt}], label=f"impl_diagram[{idea.get('idea_id')}]")
    except Exception as exc:
        logger.exception(f"[s50_diag] LLM failed: {exc}")
        return None

    html = _strip_codeblock(html)
    if not html.strip().startswith("<!DOCTYPE"):
        return None

    # diagram 需要写到磁盘文件,factory.make_course_content 接受 html_path
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".html", delete=False, dir="/tmp", encoding="utf-8",
    )
    tmp.write(html)
    tmp.close()

    em.emit(EV_AGENT_LOG, {
        "agent": "ImplementDiagram", "phase": "output",
        "input": "",
        "output": f"length={len(html)}, path={tmp.name}",
    })
    return {
        "html_path": tmp.name,
        "topic": detail_plan.get("topic", "") or idea.get("topic", ""),
        "caption": idea.get("context_summary", "")[:200],
    }


def _strip_codeblock(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text
