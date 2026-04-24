"""统一 revise 入口。闸门失败时拿 issues 反馈,重生成对应 step 产物。

接口:
    revised = await revise(step_name, original, issues, ctx)

step_name 决定加载哪个 prompts/revise_*.md。
对于 anim/game,会把原 detail_plan + issues 一起喂回 implement prompt 重新生成 HTML。
对于 theory,会把原 level_bodies + issues 喂回 theory_body prompt。
对于 plan,见 s10_plan._revise_plan (已就地实现)。
"""

from __future__ import annotations

import logging
from pathlib import Path

from .kimi_client import ainvoke, kimi
from .progress import Emitter, EV_REVISE_START

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"


async def revise_html(
    *,
    step_name: str,
    mode: str,  # "animation" | "game"
    original_html: str,
    issues: list[str],
    detail_plan: dict,
    ctx: dict,
    em: Emitter,
    attempt: int,
) -> str:
    """重新生成 anim/game HTML, 把 issues 写进 prompt。"""
    em.emit(EV_REVISE_START, {
        "step": step_name, "mode": mode, "attempt": attempt,
        "issue_count": len(issues),
    })

    issues_block = "\n".join(f"- {i}" for i in issues[:20])

    revise_prompt = f"""# Revise (闸门 {step_name} 失败) — 重新生成 {mode} HTML

你之前生成的 HTML 没通过下列闸门检查,现在请**修复全部问题**重新输出完整 HTML:

## 待修复的问题

{issues_block}

## 原始 HTML 关键片段

```html
{original_html[:3000]}
... (truncated) ...
{original_html[-2000:]}
```

## 原始 detail_plan (作为参考)

```json
{_short_json(detail_plan)}
```

## 要求

- **保留原 HTML 中正确的部分**, 只针对上述 issues 改动
- 仍需遵守 implement_{mode}.md 中的全部硬性约束 (单文件 / overflow:hidden /
  禁 onclick / 禁 setInterval / i18n 双语 / 禁 window 同名变量 / theme palette 一致)
- 直接输出**完整 HTML 字符串**, 不要前言后记代码块标记

输出:
"""

    llm = kimi(streaming=False)
    revised = await ainvoke(
        llm,
        [{"role": "user", "content": revise_prompt}],
        label=f"revise_{mode}_attempt{attempt}",
    )
    return _strip_codeblock(revised)


async def revise_theory(
    *,
    original_theory: dict,
    issues: list[str],
    ctx: dict,
    em: Emitter,
    attempt: int,
) -> dict | None:
    """5.5d theory grader 失败时, 重新生成对应 theory 的 level_bodies。"""
    em.emit(EV_REVISE_START, {
        "step": "5.5d", "mode": "theory", "attempt": attempt,
        "theory_id": original_theory.get("theory_id"),
        "issue_count": len(issues),
    })

    issues_block = "\n".join(f"- {i}" for i in issues[:20])
    import json

    revise_prompt = f"""# Revise theory (5.5d 等级评审失败)

theory_id={original_theory.get('theory_id')}, title={original_theory.get('title')}

## 待修复的问题

{issues_block}

## 原 level_bodies + exercises

```json
{json.dumps({
    "level_bodies": original_theory.get("level_bodies", []),
    "exercises": original_theory.get("exercises", []),
}, ensure_ascii=False, indent=2)[:4000]}
```

## 要求

- 修复 issues 列出的问题, 重写 level_bodies 中对应等级的 body_markdown
- K1 仍必须零公式零字母, K{ctx.get('knowledge_level', 'K3')[1:]} 必须真升级 (用对应等级数学工具)
- 必须先解释概念本身 (≥2 个生活类比/具体例子), 再关联项目场景
- exercises 仍需 1-3 道, K1 难度

输出 JSON (与 theory_body.md 输出格式一致):

```json
{{
  "theory_id": "{original_theory.get('theory_id')}",
  "title": "{original_theory.get('title')}",
  "subject": "{original_theory.get('subject')}",
  "tags": {json.dumps(original_theory.get('tags', []), ensure_ascii=False)},
  "related_paragraph": "{original_theory.get('related_paragraph', '')}",
  "body_markdown": "(= K1 版本)",
  "level_bodies": [...],
  "exercises": [...]
}}
```

仅输出 JSON, 无其它文本。
"""

    llm = kimi(streaming=False)
    response = await ainvoke(
        llm,
        [{"role": "user", "content": revise_prompt}],
        label=f"revise_theory_attempt{attempt}",
    )

    # 解析 JSON
    import re
    s = response.strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()

    try:
        data = json.loads(s)
    except Exception:
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if not m:
            logger.warning(f"[revise_theory] no JSON in response: {response[:200]}")
            return None
        try:
            data = json.loads(m.group(0))
        except Exception:
            return None

    if not isinstance(data, dict):
        return None
    if not data.get("body_markdown") or not data.get("level_bodies"):
        return None
    return data


def _short_json(obj) -> str:
    import json
    return json.dumps(obj, ensure_ascii=False, indent=2)[:1500]


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
