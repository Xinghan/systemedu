"""AnimationGenAgent — generates SVG/CSS animation HTML from a frame-based detail plan."""

import json
import logging

from systemedu.agents.builtin.animation_backend_router_agent import (
    AnimationBackendRouterAgent,
)
from systemedu.agents.builtin.manim_gen_agent import ManimGenAgent
from systemedu.agents.builtin.media_art_direction import (
    KATEX_PROMPT_HINT,
    animation_component_library_block,
    evaluate_animation_html_quality,
    format_animation_quality_feedback,
    inject_katex_if_needed,
    motion_preset_block,
    style_kit_prompt_block,
)

logger = logging.getLogger(__name__)

ANIMATION_GEN_PROMPT = """你是一位专业的 SVG 动画工程师，请根据以下动画帧序列方案，生成一个完整的 HTML 动画文件。

知识节点：{node_title}
动画标题：{title}
动画类型：{animation_type}
风格：{style_hint}
布局信息：{layout_summary}
节奏信息：{beats_summary}
推荐资产：{asset_summary}

帧序列：
{frames_description}
{style_kit_block}
{component_library_block}
{motion_block}

请生成一个完整的 HTML 文件，要求：
1. 使用 SVG + CSS animation 实现帧序列动画（可辅以少量 JS 控制节奏）
2. 每帧切换间隔 2-3 秒，总时长 {total_duration} 秒
3. 包含进度指示器（底部圆点，高度不超过 20px）
4. 动画结束时发送 postMessage：window.parent.postMessage({{type: 'STEP_COMPLETE'}}, '*')
5. HTML 结构：
   - <!DOCTYPE html><html><head>...</head><body style="margin:0;padding:0;overflow:hidden">...</body></html>
   - 使用内联 <style> 和 <script>
   - body 和 html 高度设为 100%，无内外边距
   - SVG 充满整个视口：width="100%" height="100%" viewBox="0 0 600 420"
   - 禁止在 SVG 外添加任何 div 标题或副标题文字
6. 视觉要求（必须严格执行）：
   - 动画主体内容占 viewBox 的上方 85%（约 0~360 区域），焦点元素至少占主区域 60%
   - 底部 360~420 区域：左侧放简短帧说明文字（font-size 11px），右侧放进度圆点
   - 禁止在顶部放大标题（不要 h1/h2/大号 text 元素作为标题）
   - 使用统一 CSS 变量定义颜色、圆角、阴影，保持风格一致
   - 字体：Noto Sans SC / PingFang SC / Microsoft YaHei / system-ui
   - 每帧有明确的视觉焦点
7. 动效质量：
   - 必须体现：anticipation -> main action -> settle
   - 至少一个 secondary overlap（次级元素错峰出现）
   - 优先使用 transform 与 opacity 完成动画
8. {katex_hint}

直接输出完整 HTML 代码，不要添加任何说明文字。
"""

ANIMATION_REPAIR_PROMPT = """你是一位资深动画质量修复工程师。请修复下方 HTML 动画，使其达到专业教学动效标准。

当前质量反馈：
{quality_feedback}

修复目标：
1. 提升构图（焦点更大、减少空旷区域）
2. 统一风格系统（颜色、圆角、阴影、字体）
3. 强化动效语法（anticipation/main action/settle/secondary overlap）
4. 保留并确保 postMessage 完成信号可触发

待修复 HTML：
{raw_html}

直接输出修复后的完整 HTML，不要解释。
"""


class AnimationGenAgent:
    """Generates SVG + CSS animation HTML from a frame detail plan."""

    def __init__(self, llm):
        self.llm = llm
        self.router = AnimationBackendRouterAgent(llm)
        self.manim = ManimGenAgent(llm)

    async def generate(
        self,
        detail_plan: dict,
        node_title: str,
        node_summary: str = "",
        project_category: str = "",
    ) -> str:
        """Generate animation HTML from detail_plan.

        Returns HTML string, or empty string on failure.
        """
        from langchain_core.messages import HumanMessage

        frames = detail_plan.get("frames", [])
        if not frames:
            logger.warning("AnimationGenAgent: no frames in detail_plan")
            return ""

        # Build frames description
        frames_desc_parts = []
        for f in frames:
            idx = f.get("frame_index", 0)
            desc = f.get("description", "")
            elements = ", ".join(f.get("visual_elements", []))
            narration = f.get("narration", "")
            part = f"帧 {idx + 1}: {desc}\n  视觉元素: {elements}"
            if narration:
                part += f"\n  旁白: {narration}"
            frames_desc_parts.append(part)

        frames_description = "\n".join(frames_desc_parts)
        total_duration = max(len(frames) * 3, 12)
        layout = detail_plan.get("layout", {})
        beats = detail_plan.get("beats", [])
        asset_plan = detail_plan.get("asset_plan", [])
        layout_summary = (
            f"focal={layout.get('focal_object', '')}, "
            f"secondary={layout.get('secondary_object', '')}, "
            f"safe_area_fill={layout.get('safe_area_fill', '')}"
        )
        beats_summary = " | ".join(
            f"t={b.get('t', '')}:{b.get('action', '')}/{b.get('focus', '')}"
            for b in beats[:8]
            if isinstance(b, dict)
        ) or "无"
        asset_summary = "、".join(str(i) for i in asset_plan[:8]) if isinstance(asset_plan, list) else "无"

        prompt = ANIMATION_GEN_PROMPT.format(
            node_title=node_title,
            title=detail_plan.get("title", node_title),
            animation_type=detail_plan.get("animation_type", "流程演示"),
            style_hint=detail_plan.get("style_hint", "科技感"),
            frames_description=frames_description,
            total_duration=total_duration,
            layout_summary=layout_summary,
            beats_summary=beats_summary,
            asset_summary=asset_summary or "无",
            style_kit_block=style_kit_prompt_block(
                mode="animation",
                preferred_key=detail_plan.get("style_key"),
            ),
            component_library_block=animation_component_library_block(),
            motion_block=motion_preset_block(),
            katex_hint=KATEX_PROMPT_HINT,
        )

        try:
            import asyncio

            # TEMP: force Manim for testing — remove after verification
            route = {"backend": "manim", "reason": "forced for testing", "subject_hint": "math_formula"}
            detail_plan.setdefault("generation_backend", route["backend"])

            if route["backend"] == "manim":
                logger.info(
                    "AnimationGenAgent: routing '%s' to Manim (%s)",
                    node_title,
                    route.get("reason", ""),
                )
                manim_html = await self.manim.generate(
                    detail_plan=detail_plan,
                    node_title=node_title,
                    node_summary=node_summary,
                    subject_hint=route.get("subject_hint", "math_formula"),
                )
                if manim_html:
                    return inject_katex_if_needed(manim_html)
                logger.warning(
                    "AnimationGenAgent: Manim unavailable or failed for '%s', fallback to HTML/SVG",
                    node_title,
                )

            response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
            html = _strip_code_fence(response.content.strip())
            if not _is_animation_html_usable(html):
                logger.warning("AnimationGenAgent: generation unusable, using fallback template")
                return _build_fallback_animation_html(detail_plan, node_title=node_title)

            report = evaluate_animation_html_quality(html)
            if report["pass"]:
                logger.info(
                    f"AnimationGenAgent: generated quality={report['score']} chars={len(html)} for '{node_title}'"
                )
                return inject_katex_if_needed(html)

            repair_prompt = ANIMATION_REPAIR_PROMPT.format(
                quality_feedback=format_animation_quality_feedback(report),
                raw_html=html[:16000],
            )
            repaired_resp = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=repair_prompt)])
            repaired_html = _strip_code_fence(repaired_resp.content.strip())
            repaired_report = evaluate_animation_html_quality(repaired_html)

            if _is_animation_html_usable(repaired_html) and repaired_report["score"] >= max(report["score"], 70):
                logger.info(
                    "AnimationGenAgent: repaired animation accepted score=%s for '%s'",
                    repaired_report["score"],
                    node_title,
                )
                return inject_katex_if_needed(repaired_html)

            if report["score"] >= 70:
                logger.info(
                    "AnimationGenAgent: keeping original animation score=%s for '%s'",
                    report["score"],
                    node_title,
                )
                return inject_katex_if_needed(html)

            logger.warning(
                "AnimationGenAgent: quality low (orig=%s, repaired=%s), using fallback for '%s'",
                report["score"],
                repaired_report["score"],
                node_title,
            )
            return _build_fallback_animation_html(detail_plan, node_title=node_title)

        except Exception:
            logger.exception(f"AnimationGenAgent: unexpected error for '{node_title}'")
            return _build_fallback_animation_html(detail_plan, node_title=node_title)


def _strip_code_fence(text: str) -> str:
    """Strip markdown code fences when model returns fenced HTML."""
    if not text.startswith("```"):
        return text
    lines = text.split("\n")
    return "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()


def _is_animation_html_usable(html: str) -> bool:
    """Basic structural guard for generated animation HTML."""
    lower = html.lower()
    has_visual = "<svg" in lower or "<video" in lower
    has_motion = ("animation" in lower) or ("@keyframes" in lower)
    has_completion = ("step_complete" in lower) and ("postmessage" in lower)
    # Video wrappers are valid even without CSS keyframes.
    if "<video" in lower:
        return has_visual and has_completion
    return has_visual and has_motion and has_completion


def _build_fallback_animation_html(detail_plan: dict, node_title: str) -> str:
    """Deterministic fallback template with fixed style system and staged motion."""
    frames = detail_plan.get("frames") or []
    cleaned_frames: list[dict] = []
    for i, frame in enumerate(frames[:8]):
        if not isinstance(frame, dict):
            continue
        cleaned_frames.append({
            "idx": i + 1,
            "description": str(frame.get("description") or f"步骤 {i + 1}"),
            "elements": [str(e) for e in (frame.get("visual_elements") or [])[:4]],
            "narration": str(frame.get("narration") or ""),
        })
    if not cleaned_frames:
        cleaned_frames = [{
            "idx": 1,
            "description": detail_plan.get("title") or node_title,
            "elements": ["核心概念", "关键变化", "结论"],
            "narration": "",
        }]

    title = str(detail_plan.get("title") or node_title)
    frame_json = json.dumps(cleaned_frames, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {{
      --bg: #f2f7fb;
      --surface: #ffffff;
      --primary: #1d4ed8;
      --secondary: #0ea5e9;
      --signal: #ef4444;
      --text: #0f172a;
      --muted: #475569;
      --radius-lg: 22px;
      --radius-md: 14px;
      --shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    }}
    * {{ box-sizing: border-box; }}
    html, body {{
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      background: var(--bg);
    }}
    #frame-caption {{
      font-size: 11px;
      fill: var(--muted);
    }}
    .badge {{
      fill: #e0f2fe;
      stroke: #bae6fd;
      stroke-width: 1.2;
    }}
    .badge-text {{
      font-size: 11px;
      fill: #0c4a6e;
      font-weight: 700;
    }}
    @keyframes pulseGlow {{
      0% {{ opacity: 0.55; transform: scale(0.98); }}
      50% {{ opacity: 1; transform: scale(1.02); }}
      100% {{ opacity: 0.55; transform: scale(0.98); }}
    }}
  </style>
</head>
<body>
  <svg width="100%" height="100%" viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f7fbff"/>
        <stop offset="100%" stop-color="#e8f3ff"/>
      </linearGradient>
      <linearGradient id="focusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1d4ed8"/>
        <stop offset="100%" stop-color="#0ea5e9"/>
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#1e3a8a" flood-opacity="0.18"/>
      </filter>
    </defs>

    <rect x="0" y="0" width="600" height="420" fill="url(#bgGrad)" />
    <g id="stage">
      <rect x="32" y="20" width="536" height="336" rx="22" fill="var(--surface)" filter="url(#softShadow)" />
      <rect x="56" y="48" width="488" height="240" rx="18" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2" />
      <g id="focus-group" style="transform-origin:300px 170px; animation:pulseGlow 3.2s ease-in-out infinite;">
        <circle cx="300" cy="168" r="84" fill="url(#focusGrad)" opacity="0.14" />
        <circle cx="300" cy="168" r="50" fill="url(#focusGrad)" opacity="0.24" />
        <text id="focal-title" x="300" y="176" text-anchor="middle" font-size="22" font-weight="800" fill="var(--primary)">{title}</text>
      </g>
      <g id="element-badges"></g>
    </g>

    <g id="hud">
      <text id="frame-caption" x="24" y="388">正在准备动画…</text>
      <g id="progress-dots" transform="translate(462,378)"></g>
    </g>
  </svg>

  <script>
    const FRAMES = {frame_json};
    let index = 0;
    const caption = document.getElementById("frame-caption");
    const dots = document.getElementById("progress-dots");
    const badges = document.getElementById("element-badges");
    const title = document.getElementById("focal-title");

    function renderDots() {{
      dots.innerHTML = "";
      FRAMES.forEach((_, i) => {{
        const cx = i * 18;
        const active = i === index;
        dots.innerHTML += `<circle cx="${{cx}}" cy="0" r="${{active ? 6 : 4}}" fill="${{active ? '#1d4ed8' : '#93c5fd'}}" opacity="${{active ? 1 : 0.45}}" />`;
      }});
    }}

    function renderBadges(frame) {{
      badges.innerHTML = "";
      const elements = (frame.elements || []).slice(0, 4);
      elements.forEach((text, i) => {{
        const x = 86 + i * 116;
        const y = 262;
        badges.innerHTML += `
          <g transform="translate(${{x}},${{y}})">
            <rect class="badge" x="0" y="0" width="108" height="32" rx="10" />
            <text class="badge-text" x="54" y="21" text-anchor="middle">${{text}}</text>
          </g>
        `;
      }});
    }}

    function renderFrame() {{
      const frame = FRAMES[index];
      caption.textContent = `第${{index + 1}}帧：${{frame.description || ""}}`;
      title.textContent = frame.narration || "{title}";
      renderDots();
      renderBadges(frame);
    }}

    function tick() {{
      index += 1;
      if (index >= FRAMES.length) {{
        window.parent.postMessage({{type: "STEP_COMPLETE"}}, "*");
        index = FRAMES.length - 1;
        renderFrame();
        return;
      }}
      renderFrame();
      setTimeout(tick, 2300);
    }}

    renderFrame();
    setTimeout(tick, 2300);
  </script>
</body>
</html>"""
