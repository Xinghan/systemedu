"""Step 0.5: Tavily 外部资源研究。

实现 SKILL.md §294-381。LLM 从 knode 抽英文 web_query / youtube_query,
然后调 factory.research_knode。失败 1 次后 skip 并 emit warning,不阻断 pipeline。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path

from ..kimi_client import ainvoke, llm_for
from ..progress import Emitter, EV_AGENT_LOG, EV_ERROR, STEP_RESEARCH

logger = logging.getLogger(__name__)

PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "research_query.md"


async def run(ctx: dict, *, em: Emitter) -> dict | None:
    """返回 research dict (含 web_results / youtube_results) 或 None。"""
    knode = ctx["knode"]
    milestone = ctx.get("milestone") or {}
    sub_project = ctx.get("sub_project") or {}

    # 1. 用 LLM 抽英文查询词
    try:
        web_query, youtube_query = await _extract_queries(ctx)
    except Exception as exc:
        logger.warning(f"[s05] query extraction failed: {exc}; falling back to factory defaults")
        em.emit(EV_AGENT_LOG, {
            "agent": "ResearchQueryExtractor", "phase": "fallback",
            "input": "", "output": f"LLM extract failed: {exc}; using factory defaults",
        })
        web_query = None  # factory 会自动从 title/milestone 拼
        youtube_query = None

    # 2. 调 factory.research_knode (同步函数,挂 to_thread)
    from course_factory.factory import research_knode

    em.emit(EV_AGENT_LOG, {
        "agent": "TavilyResearch", "phase": "input",
        "input": f"web_query={web_query!r}, youtube_query={youtube_query!r}",
        "output": "(pending)",
    })

    try:
        research = await asyncio.to_thread(
            research_knode,
            knode,
            milestone=milestone,
            sub_project=sub_project,
            web_query=web_query,
            youtube_query=youtube_query,
            max_web=4,
            max_youtube=2,
        )
    except Exception as exc:
        # Tavily 调用失败: emit warning 但不抛 — pipeline 应允许 skip
        logger.warning(f"[s05] research_knode failed: {exc}")
        em.emit(EV_ERROR, {
            "step": STEP_RESEARCH,
            "message": f"Tavily 调用失败,跳过外部资源研究: {exc}",
        })
        return None

    web_count = len(research.get("web_results") or [])
    yt_count = len(research.get("youtube_results") or [])
    em.emit(EV_AGENT_LOG, {
        "agent": "TavilyResearch", "phase": "output",
        "input": f"web_query={research.get('web_query')!r}",
        "output": f"web_results={web_count}, youtube_results={yt_count}",
    })

    # 3. 质量检查: web ∪ youtube 至少 1 条 (F.0.5 / SKILL.md §378)
    if web_count == 0 and yt_count == 0:
        logger.warning(
            f"[s05] both web_results and youtube_results empty for "
            f"queries web={web_query!r} yt={youtube_query!r}"
        )
        em.emit(EV_ERROR, {
            "step": STEP_RESEARCH,
            "message": "Tavily 返回 0 条结果,可能查询词太窄,跳过本节点外部资源",
        })
        # 仍然返回 research dict (空列表),让 make_course_content 自然处理
        # 不返回 None,因为 make_course_content 会 fallback 到 labxchange

    return research


_JSON_RE = re.compile(r"\{[^{}]*?\"web_query\"[^{}]*?\"youtube_query\"[^{}]*?\}", re.DOTALL)


async def _extract_queries(ctx: dict) -> tuple[str, str]:
    """LLM 抽取英文 web_query / youtube_query。失败抛异常由调用方兜底。"""
    knode = ctx["knode"]
    milestone = ctx.get("milestone") or {}
    sub_project = ctx.get("sub_project") or {}

    prompt = PROMPT_FILE.read_text(encoding="utf-8").format(
        project_name=ctx.get("project_name", ""),
        category=ctx.get("category", ""),
        node_title=knode.get("title", "") or knode.get("name", ""),
        node_summary=(knode.get("summary", "") or "")[:400],
        core_question=knode.get("core_question", "") or "(空)",
        milestone_title=milestone.get("title", ""),
        sub_project_problem=(sub_project.get("core_problem", "") or "")[:200],
    )

    llm = llm_for("fast", streaming=False)
    response = await ainvoke(
        llm,
        [{"role": "user", "content": prompt}],
        label="research_query",
    )

    # 解析 JSON
    match = _JSON_RE.search(response)
    if not match:
        # 尝试整段当 JSON 解析(有时 LLM 会输出 ```json ... ```)
        cleaned = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            data = json.loads(cleaned)
        except Exception:
            raise ValueError(f"LLM did not return valid JSON: {response[:200]}")
    else:
        try:
            data = json.loads(match.group(0))
        except Exception:
            raise ValueError(f"JSON match failed to parse: {match.group(0)[:200]}")

    web_query = (data.get("web_query") or "").strip()
    youtube_query = (data.get("youtube_query") or "").strip()

    if not web_query or not youtube_query:
        raise ValueError(f"Missing web_query or youtube_query in: {data}")

    if len(web_query.split()) < 2 or len(youtube_query.split()) < 2:
        raise ValueError(f"Queries too short: web={web_query!r} yt={youtube_query!r}")

    return web_query, youtube_query
