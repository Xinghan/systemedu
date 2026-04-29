"""Step 6.7: Slide 生成 — 老师讲课模式用的 slide 列表。

输入 course_content (含 plan_markdown / theories / ideas / external_resources) +
knode 信息, 用 fast LLM (qwen3.6-plus) 生成结构化 slide 列表, 写到 lesson_slide_v3。

slide 顺序: intro → bullet ×N → theory ×N → anim ×N → game ×N → image (聚合)
            → diagram → videos (聚合) → labxchange (聚合) → outro

不归 pipeline 必经流程; 调用方:
- 主 pipeline: pipeline.py 的 Step 6.7 (在 audio scripts 之后跑)
- 独立 endpoint: gateway POST /course/v3/slides/regenerate
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from ..kimi_client import ainvoke, llm_for
from ..progress import EV_AGENT_LOG, Emitter

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


async def generate_slides(
    *,
    project_name: str,
    knode_id: int,
    version_label: str,
    knode: dict,
    course_content: dict,
    em: Emitter | None = None,
) -> list[dict]:
    """生成 slide 列表 + 写入 lesson_slide_v3 表。返回 slides 列表。

    course_content 来自 LessonContentV3.course_content (json), 包含
    plan_markdown / theories / ideas / rendered_sections / external_resources。
    """
    from course_factory.factory import replace_slides_v3

    em = em or _NoEm()

    plan_markdown = course_content.get("plan_markdown") or ""
    theories = course_content.get("theories") or []
    ideas = course_content.get("ideas") or []
    rendered = course_content.get("rendered_sections") or {}
    ext = course_content.get("external_resources") or {}

    youtube = ext.get("youtube_results") or []
    web = ext.get("web_results") or []
    labxchange = ext.get("labxchange_results") or []

    # 整理 prompt 输入
    theories_block = _format_theories(theories)
    ideas_block = _format_ideas(ideas, rendered)
    age = knode.get("age_range") or [10, 15]
    age_min = age[0] if age else 10
    age_max = age[1] if len(age) > 1 else 15

    template = (PROMPTS_DIR / "slide_gen.md").read_text(encoding="utf-8")
    prompt = (
        template
        .replace("{node_title}", knode.get("title", "") or knode.get("name", ""))
        .replace("{core_question}", knode.get("core_question", "") or "(无)")
        .replace("{acceptance_summary}", _format_list(knode.get("acceptance_standard") or []))
        .replace("{hands_on_summary}", _format_list(knode.get("hands_on_components") or []))
        .replace("{age_min}", str(age_min))
        .replace("{age_max}", str(age_max))
        .replace("{plan_markdown}", plan_markdown[:6000])  # 截断防 prompt 过长
        .replace("{theories_count}", str(len(theories)))
        .replace("{theories_block}", theories_block or "(无 theories)")
        .replace("{ideas_block}", ideas_block or "(无 ideas)")
        .replace("{youtube_count}", str(len(youtube)))
        .replace("{web_count}", str(len(web)))
        .replace("{labxchange_count}", str(len(labxchange)))
    )

    em.emit(EV_AGENT_LOG, {
        "agent": "SlideGen", "phase": "input",
        "input": f"theories={len(theories)} ideas={len(ideas)} youtube={len(youtube)} labxchange={len(labxchange)}",
        "output": f"prompt_len={len(prompt)}",
    })

    llm = llm_for("fast", streaming=False, max_tokens=8192)
    try:
        resp = await ainvoke(llm, [{"role": "user", "content": prompt}],
                             label=f"slide_gen[{project_name}/{knode_id}/{version_label}]")
    except Exception as exc:
        logger.exception(f"[s67] slide gen LLM failed for {project_name}/{knode_id}")
        em.emit(EV_AGENT_LOG, {
            "agent": "SlideGen", "phase": "fail", "input": "", "output": f"LLM error: {exc}",
        })
        raise

    slides = _parse_slides_json(resp)
    if not slides:
        logger.warning(f"[s67] LLM returned no parseable slides; raw head: {resp[:300]}")
        em.emit(EV_AGENT_LOG, {
            "agent": "SlideGen", "phase": "warn",
            "input": "", "output": f"empty slides; raw[:200]={resp[:200]!r}",
        })
        return []

    # 后处理: 补充实际媒体引用 (videos/labxchange/images) 用真实 URL
    slides = _enrich_payloads(slides, ideas, rendered, ext)

    # 写库
    n = replace_slides_v3(project_name, knode_id, version_label, slides)
    em.emit(EV_AGENT_LOG, {
        "agent": "SlideGen", "phase": "output",
        "input": "", "output": f"generated {len(slides)} slides, wrote {n} rows to DB",
    })
    return slides


def _format_theories(theories: list[dict]) -> str:
    if not theories:
        return ""
    lines = []
    for t in theories:
        tid = t.get("theory_id", "")
        title = t.get("title", "")
        subj = t.get("subject", "")
        body = (t.get("body_markdown") or "")[:200]
        lines.append(f"- theory_id={tid} | {title} ({subj}) | {body[:120]}...")
    return "\n".join(lines)


def _format_ideas(ideas: list[dict], rendered: dict) -> str:
    if not ideas:
        return ""
    lines = []
    for i in ideas:
        iid = i.get("idea_id", "")
        mode = i.get("mode", "")
        topic = i.get("topic", "")
        rs = rendered.get(iid) or {}
        has_html = bool(rs.get("html"))
        lines.append(f"- idea_id={iid} | mode={mode} | topic={topic} | has_content={has_html}")
    return "\n".join(lines)


def _format_list(items: list) -> str:
    if not items:
        return "(无)"
    out = []
    for x in items:
        if isinstance(x, str):
            out.append(f"- {x}")
        elif isinstance(x, dict):
            out.append(f"- {x.get('title', x.get('name', str(x)))}")
    return "\n".join(out) if out else "(无)"


_JSON_ARR_RE = re.compile(r"\[\s*\{[\s\S]*\}\s*\]", re.MULTILINE)


def _parse_slides_json(raw: str) -> list[dict]:
    """LLM 输出可能含 ```json 包裹或前后说明; 鲁棒抽取顶层 JSON 数组。"""
    if not raw:
        return []
    s = raw.strip()
    # strip code fences
    if s.startswith("```"):
        lines = s.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    # 直接尝试
    try:
        v = json.loads(s)
        if isinstance(v, list):
            return [x for x in v if isinstance(x, dict)]
    except Exception:
        pass
    # fallback 找最外层数组
    m = _JSON_ARR_RE.search(s)
    if m:
        try:
            v = json.loads(m.group(0))
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
        except Exception:
            pass
    return []


def _enrich_payloads(slides: list[dict], ideas: list[dict], rendered: dict,
                      ext: dict) -> list[dict]:
    """LLM 可能简化 payload 写法, 这里把 videos/labxchange/images 真实 URL 填回。"""
    youtube = ext.get("youtube_results") or []
    web = ext.get("web_results") or []
    labxchange = ext.get("labxchange_results") or []

    # 找所有 image idea 的 src
    image_payloads = []
    for i in ideas:
        if i.get("mode") == "image":
            iid = i.get("idea_id", "")
            rs = rendered.get(iid) or {}
            src = rs.get("src") or rs.get("image_url") or ""
            if src:
                image_payloads.append({
                    "src": src,
                    "caption": rs.get("caption") or rs.get("alt") or i.get("topic", ""),
                    "source_url": rs.get("source_url", ""),
                })

    out: list[dict] = []
    for s in slides:
        s = dict(s)
        kind = s.get("kind", "")
        payload = dict(s.get("payload") or {})
        if kind == "videos" and not payload.get("videos"):
            payload["videos"] = [
                {
                    "title": v.get("title", ""),
                    "url": v.get("url", ""),
                    "thumbnail": v.get("thumbnail", "") or _yt_thumb(v.get("url", "")),
                }
                for v in youtube
            ]
        elif kind == "labxchange" and not payload.get("labxchange"):
            payload["labxchange"] = [
                {"title": x.get("title", ""), "url": x.get("url", ""),
                 "description": x.get("description", "")}
                for x in labxchange
            ]
        elif kind == "image" and not payload.get("images"):
            payload["images"] = image_payloads
        s["payload"] = payload
        out.append(s)
    return out


def _yt_thumb(url: str) -> str:
    """Extract YouTube thumbnail from watch URL."""
    m = re.search(r"(?:v=|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})", url or "")
    if m:
        return f"https://img.youtube.com/vi/{m.group(1)}/hqdefault.jpg"
    return ""


class _NoEm:
    """Stand-in emitter when none provided."""
    def emit(self, *a: Any, **k: Any) -> None:
        pass
