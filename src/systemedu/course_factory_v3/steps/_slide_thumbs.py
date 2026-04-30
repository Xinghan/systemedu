"""Slide thumbnail 预渲染 — 用 Playwright 把 anim/game/diagram HTML 渲染成 PNG.

输出路径: web/public/slide-thumbs/{project}-{knode}-{slide_id}.png
URL: /slide-thumbs/{project}-{knode}-{slide_id}.png (Next.js 静态 serving)
"""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# web/public 在 repo root 下
ROOT = Path(__file__).resolve().parents[4]
THUMBS_DIR = ROOT / "web" / "public" / "slide-thumbs"


def _safe_name(s: str) -> str:
    """slug-ify so it's safe in a filename."""
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", s)[:80]


async def render_thumbnail(
    *,
    html: str,
    project_name: str,
    knode_id: int,
    slide_id: str,
    width: int = 1280,
    height: int = 720,
    settle_ms: int = 1500,
) -> str | None:
    """渲染一段 HTML 为 PNG, 返回前端可访问的 URL (相对 /, 由 Next.js 静态 serve)。

    失败返 None (调用方决定是否兜底)。
    """
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"{_safe_name(project_name)}-{knode_id}-{_safe_name(slide_id)}.png"
    out_path = THUMBS_DIR / fname

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(viewport={"width": width, "height": height})
            page = await ctx.new_page()
            # set_content 有 size 限制 (~32k chars), 大 HTML 用临时文件:
            if len(html) > 30000:
                import os
                import tempfile
                tmp = tempfile.NamedTemporaryFile(
                    suffix=".html", delete=False, mode="w", encoding="utf-8"
                )
                tmp.write(html)
                tmp.close()
                try:
                    await page.goto(f"file://{tmp.name}")
                finally:
                    try:
                        os.unlink(tmp.name)
                    except Exception:
                        pass
            else:
                await page.set_content(html, wait_until="load")
            await page.wait_for_timeout(settle_ms)  # 让 anim 跑几帧 / fonts 加载
            await page.screenshot(path=str(out_path), full_page=False)
            await browser.close()
        logger.info(f"[thumbs] wrote {out_path} ({out_path.stat().st_size} bytes)")
        return f"/slide-thumbs/{fname}"
    except Exception as exc:
        logger.warning(f"[thumbs] render failed for {project_name}/{knode_id}/{slide_id}: {exc}")
        return None


async def render_thumbnails_for_slides(
    *,
    project_name: str,
    knode_id: int,
    slides: list[dict],
    rendered_sections: dict,
) -> list[dict]:
    """为 slide 列表中的 anim/game/diagram 各跑一次 Playwright 截图,
    把 thumbnail_url 填入 payload。串行 (并行启 chromium 太重)。

    其他 kind (intro/bullet/...) 不动。
    """
    out: list[dict] = []
    for slide in slides:
        slide = dict(slide)
        kind = slide.get("kind", "")
        payload = dict(slide.get("payload") or {})
        if kind in ("animation", "game"):
            idea_id = payload.get("idea_id") or ""
        elif kind == "diagram":
            idea_id = payload.get("diagram_html_id") or payload.get("idea_id") or ""
        else:
            out.append(slide)
            continue
        if not idea_id:
            out.append(slide)
            continue
        rs = rendered_sections.get(idea_id) or {}
        html = rs.get("html") or ""
        if not html:
            out.append(slide)
            continue
        url = await render_thumbnail(
            html=html,
            project_name=project_name,
            knode_id=knode_id,
            slide_id=slide.get("slide_id") or idea_id,
        )
        if url:
            payload["thumbnail_url"] = url
        slide["payload"] = payload
        out.append(slide)
    return out
