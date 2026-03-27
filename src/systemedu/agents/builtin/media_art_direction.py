"""Shared art direction helpers for animation/game/story generation."""

from __future__ import annotations

import re

# KaTeX auto-render injection snippet (CDN, MIT licensed)
_KATEX_INJECT = """<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\\\(',right:'\\\\)',display:false},{left:'\\\\[',right:'\\\\]',display:true}]})"></script>"""

# Markers that indicate LaTeX content in generated HTML
_LATEX_MARKERS = (r"\(", r"\[", "$$", r"\begin{", r"\frac", r"\int", r"\sum", r"\sqrt")


def inject_katex_if_needed(html: str) -> str:
    """Inject KaTeX CDN into HTML if LaTeX syntax is detected.

    Checks for common LaTeX markers. If found and KaTeX is not already
    present, inserts the CDN scripts before </head>.
    """
    if "katex" in html.lower():
        return html  # already has KaTeX
    if not any(m in html for m in _LATEX_MARKERS):
        return html  # no LaTeX detected
    if "</head>" in html:
        return html.replace("</head>", f"{_KATEX_INJECT}\n</head>", 1)
    # No </head> tag — prepend to document
    return f"<head>{_KATEX_INJECT}\n</head>\n" + html


# Prompt hint telling LLM it can use KaTeX syntax
KATEX_PROMPT_HINT = """数学公式渲染：页面已自动加载 KaTeX，可直接在 HTML 文本节点中使用 LaTeX 语法：
- 行内公式：\\(E = mc^2\\)
- 块级公式：$$\\int_0^\\infty e^{-x}\\,dx = 1$$
- 支持：分数 \\frac{{a}}{{b}}、根号 \\sqrt{{x}}、求和 \\sum_{{i=1}}^n、积分 \\int、希腊字母 \\alpha \\beta \\theta 等
- 公式写在普通 <div> 或 <p> 标签内即可，KaTeX 会自动渲染
- 禁止用 SVG <text> 元素手写公式，应全部改用 KaTeX 语法"""


STYLE_KITS: dict[str, dict] = {
    "edu_soft_tech": {
        "background_family": "cool-light",
        "palette": {
            "bg": "#f2f7fb",
            "surface": "#ffffff",
            "primary": "#1d4ed8",
            "secondary": "#0ea5e9",
            "signal": "#ef4444",
            "success": "#16a34a",
            "text": "#0f172a",
            "muted": "#475569",
        },
        "radius": {"sm": 8, "md": 14, "lg": 22},
        "stroke_width": {"base": 2, "focus": 3},
        "shadow": {
            "soft": "0 10px 30px rgba(15, 23, 42, 0.12)",
            "focus": "0 8px 20px rgba(29, 78, 216, 0.18)",
        },
        "font_pairing": "Noto Sans SC + Nunito",
        "spacing_scale": [4, 8, 12, 16, 24, 32, 40],
    },
    "concept_lab_clean": {
        "background_family": "lab-neutral",
        "palette": {
            "bg": "#eef2ff",
            "surface": "#ffffff",
            "primary": "#0891b2",
            "secondary": "#22c55e",
            "signal": "#f97316",
            "success": "#16a34a",
            "text": "#0b1220",
            "muted": "#475569",
        },
        "radius": {"sm": 8, "md": 14, "lg": 20},
        "stroke_width": {"base": 2, "focus": 3},
        "shadow": {
            "soft": "0 8px 24px rgba(8, 145, 178, 0.14)",
            "focus": "0 12px 26px rgba(34, 197, 94, 0.18)",
        },
        "font_pairing": "Noto Sans SC + Rubik",
        "spacing_scale": [4, 8, 12, 16, 24, 32, 40],
    },
    "storybook_vivid": {
        "background_family": "warm-paper",
        "palette": {
            "bg": "#fff8ee",
            "surface": "#fffdf8",
            "primary": "#d97706",
            "secondary": "#0ea5e9",
            "signal": "#ef4444",
            "success": "#16a34a",
            "text": "#3f2b1d",
            "muted": "#7c5e47",
        },
        "radius": {"sm": 10, "md": 16, "lg": 24},
        "stroke_width": {"base": 2, "focus": 3},
        "shadow": {
            "soft": "0 10px 24px rgba(217, 119, 6, 0.16)",
            "focus": "0 10px 26px rgba(239, 68, 68, 0.16)",
        },
        "font_pairing": "Noto Serif SC + Nunito",
        "spacing_scale": [4, 8, 12, 16, 24, 32, 40],
    },
}

DEFAULT_STYLE_KEY_BY_MODE = {
    "animation": "edu_soft_tech",
    "game": "concept_lab_clean",
    "story": "storybook_vivid",
}

ANIMATION_COMPONENT_LIBRARY = [
    "device_frame",
    "remote_controller",
    "signal_pulse_ring",
    "focus_highlight",
    "caption_plate",
    "state_chip",
    "arrow_flow",
    "mask_reveal_strip",
    "progress_dots",
    "mini_legend",
]

MOTION_PRESETS = {
    "enter": "opacity + translateY(12->0), ease-out, 240-320ms",
    "anticipation": "main action 前 120-180ms 反向轻微位移或缩放",
    "main_action": "动作主体 280-420ms，ease-in-out，焦点元素占主导",
    "secondary_overlap": "次级元素延后 80-140ms 跟随",
    "settle": "回弹或阻尼收敛 200-320ms",
}


def get_style_kit(mode: str, preferred_key: str | None = None) -> tuple[str, dict]:
    """Return (style_key, style_kit) with safe fallback."""
    style_key = preferred_key if preferred_key in STYLE_KITS else None
    if not style_key:
        style_key = DEFAULT_STYLE_KEY_BY_MODE.get(mode, "edu_soft_tech")
    return style_key, STYLE_KITS[style_key]


def style_kit_prompt_block(mode: str, preferred_key: str | None = None) -> str:
    """Return a compact text block used in agent prompts."""
    style_key, kit = get_style_kit(mode=mode, preferred_key=preferred_key)
    palette = kit["palette"]
    radius = kit["radius"]
    shadow = kit["shadow"]
    return (
        f"固定风格系统（必须严格遵守，不可自由发挥）：\n"
        f"- style_key: {style_key}\n"
        f"- 背景家族: {kit['background_family']}，bg={palette['bg']}，surface={palette['surface']}\n"
        f"- 主色: {palette['primary']}，辅助色: {palette['secondary']}，信号色: {palette['signal']}\n"
        f"- 文本色: {palette['text']}，弱化文本: {palette['muted']}\n"
        f"- 圆角: sm={radius['sm']}px, md={radius['md']}px, lg={radius['lg']}px\n"
        f"- 阴影: soft={shadow['soft']} / focus={shadow['focus']}\n"
        f"- 字体: {kit['font_pairing']}\n"
        f"- 间距尺度: {', '.join(str(i) for i in kit['spacing_scale'])} px\n"
    )


def animation_component_library_block() -> str:
    """Return component-library rules for animation prompts."""
    return (
        "可复用组件库（优先组合，不要每次重造形状）：\n"
        + "\n".join(f"- {name}" for name in ANIMATION_COMPONENT_LIBRARY)
        + "\n"
        + "构图要求：主体元素至少占画面宽或高的 60%，避免空旷背景。\n"
        + "布局要求：使用明确焦点（focal object）+ 次焦点（secondary object）。\n"
    )


def motion_preset_block() -> str:
    """Return motion grammar rules for animation prompts."""
    return (
        "动效语法（必须包含以下阶段）：\n"
        + "\n".join(f"- {k}: {v}" for k, v in MOTION_PRESETS.items())
        + "\n"
        + "性能要求：优先 transform / opacity；避免重度 filter 与 box-shadow 动画。\n"
    )


def evaluate_animation_html_quality(html: str) -> dict:
    """Heuristic quality scoring for generated animation HTML."""
    lower = html.lower()
    checks: list[tuple[str, bool, int, str]] = [
        ("contains_svg", "<svg" in lower, 20, "缺少 SVG 场景"),
        ("has_motion", ("@keyframes" in lower) or ("animation" in lower), 15, "缺少明确动画定义"),
        ("has_transform", ("transform" in lower) or ("translate(" in lower), 10, "缺少 transform 动画"),
        ("has_opacity", "opacity" in lower, 8, "缺少透明度层次与过渡"),
        ("has_gradient", ("lineargradient" in lower) or ("radialgradient" in lower), 12, "缺少渐变层次"),
        ("has_defs", "<defs" in lower, 8, "缺少可复用 SVG 定义"),
        ("has_progress", ("step_complete" in lower) and ("postmessage" in lower), 12, "缺少完成信号上报"),
        ("has_style_vars", ":root" in lower and "--" in lower, 8, "缺少统一样式变量"),
        ("has_text", "<text" in lower, 7, "缺少必要标注文字"),
    ]
    score = 0
    issues: list[str] = []
    for _, ok, weight, issue in checks:
        if ok:
            score += weight
        else:
            issues.append(issue)

    # Composition proxy: if no large geometry, penalize.
    has_large_shape = False
    for w, h in re.findall(r'width=["\']?(\d{2,4})["\']?[^>]*height=["\']?(\d{2,4})["\']?', html):
        try:
            if int(w) >= 220 and int(h) >= 120:
                has_large_shape = True
                break
        except ValueError:
            continue
    if has_large_shape:
        score += 10
    else:
        issues.append("主体构图可能偏小，缺少足够大的焦点元素")

    return {
        "score": min(score, 100),
        "issues": issues,
        "pass": score >= 72,
    }


def format_animation_quality_feedback(report: dict) -> str:
    """Convert quality report to terse, prompt-friendly feedback."""
    issues = report.get("issues") or []
    if not issues:
        return "当前质量检查通过。请保持构图焦点、风格一致性与动效层次。"
    top = issues[:5]
    return "需要修复的问题：\n" + "\n".join(f"- {item}" for item in top)


def normalize_story_image_prompt(
    prompt: str,
    *,
    style_key: str | None = None,
    paragraph_text: str = "",
) -> str:
    """Harden story image prompts with stable style constraints."""
    resolved_key, kit = get_style_kit("story", preferred_key=style_key)
    palette = kit["palette"]
    style_suffix = (
        f"children's educational illustration, style_key={resolved_key}, "
        f"primary color {palette['primary']}, secondary color {palette['secondary']}, "
        "clear focal subject, cinematic composition, no text, no watermark."
    )
    base = (prompt or "").strip()
    if paragraph_text:
        base = f"{base} Scene context: {paragraph_text[:120]}".strip()
    if not base:
        base = "Educational children's story scene"
    if "no text" not in base.lower():
        base = f"{base}. {style_suffix}"
    return base[:560]


def inject_game_style_overrides(html: str, style_key: str | None = None) -> str:
    """Inject shared game CSS tokens to keep output style consistent across mechanics."""
    resolved_key, kit = get_style_kit("game", preferred_key=style_key)
    palette = kit["palette"]
    style_block = f"""
<style id="edu-game-style-kit">
:root {{
  --bg1: {palette['bg']} !important;
  --bg2: {palette['surface']} !important;
  --accent: {palette['primary']} !important;
  --accent2: {palette['secondary']} !important;
  --green: {palette['success']} !important;
  --red: {palette['signal']} !important;
  --text: {palette['text']} !important;
  --dim: {palette['muted']} !important;
}}
html, body {{
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif !important;
}}
</style>
""".strip()
    if "edu-game-style-kit" in html:
        return html
    if "</head>" in html:
        return html.replace("</head>", f"{style_block}\n</head>", 1)
    return style_block + "\n" + html


def evaluate_detail_plan(mode: str, detail_plan: dict) -> dict:
    """Evaluate complexity + persuasion for detail plans."""
    issues: list[str] = []
    complexity_score = 100
    persuasion_score = 100

    if mode == "animation":
        frames = detail_plan.get("frames") or []
        frame_count = int(detail_plan.get("frame_count") or len(frames) or 0)
        if frame_count > 6:
            complexity_score -= 20
            issues.append("动画帧数过多（建议 4-6 帧）")
        total_elements = 0
        for frame in frames:
            total_elements += len(frame.get("visual_elements") or []) if isinstance(frame, dict) else 0
        if total_elements > 20:
            complexity_score -= 20
            issues.append("视觉元素总数过多，建议聚焦 1 个主场景")
        if len(detail_plan.get("beats") or []) > 6:
            complexity_score -= 15
            issues.append("动作节拍过多，建议减少到 4-6 个关键 beat")
        layout = detail_plan.get("layout") or {}
        safe_fill = layout.get("safe_area_fill")
        try:
            if safe_fill is None or float(safe_fill) < 0.55:
                complexity_score -= 8
                issues.append("构图占比偏低，主体可能太小（safe_area_fill 建议 >= 0.55）")
        except (TypeError, ValueError):
            complexity_score -= 8
            issues.append("layout.safe_area_fill 无效")

    elif mode == "game":
        params = detail_plan.get("simulation_params") or []
        flow = detail_plan.get("interaction_flow") or []
        storyboard = detail_plan.get("visual_storyboard") or []
        if len(params) > 3:
            complexity_score -= 25
            issues.append("模拟参数过多（建议 2-3 个）")
        if len(flow) > 4:
            complexity_score -= 15
            issues.append("交互步骤过多（建议 3-4 步）")
        if len(storyboard) > 3:
            complexity_score -= 10
            issues.append("分镜阶段过多（建议 3 段）")
        scene_desc = str(detail_plan.get("scene_description") or "")
        if len(scene_desc) > 90:
            complexity_score -= 8
            issues.append("场景描述过长，可能导致执行时发散")

    elif mode == "story":
        paragraphs = detail_plan.get("paragraphs") or []
        if len(paragraphs) > 4:
            complexity_score -= 15
            issues.append("故事段落偏多（建议 3-4 段）")
        for idx, para in enumerate(paragraphs, start=1):
            text = str((para or {}).get("text") or "")
            if len(text) > 180:
                complexity_score -= 6
                issues.append(f"第 {idx} 段文字偏长，影响节奏")

    persuasion = detail_plan.get("persuasion") if isinstance(detail_plan, dict) else None
    if not isinstance(persuasion, dict):
        persuasion_score -= 35
        issues.append("缺少 persuasion 说服力设计（学习主张/证据/结论）")
    else:
        filled = sum(1 for k in ("learning_claim", "evidence", "takeaway") if str(persuasion.get(k) or "").strip())
        if filled < 2:
            persuasion_score -= 20
            issues.append("persuasion 字段信息不足")

    return {
        "complexity_score": max(complexity_score, 0),
        "persuasion_score": max(persuasion_score, 0),
        "pass": complexity_score >= 72 and persuasion_score >= 65,
        "issues": issues,
    }


def format_detail_plan_feedback(report: dict) -> str:
    """Format detail-plan evaluation issues for revision prompts."""
    issues = report.get("issues") or []
    if not issues:
        return "当前方案通过。请保持简洁单场景与高说服力。"
    return "\n".join(f"- {item}" for item in issues[:8])


def simplify_detail_plan(mode: str, detail_plan: dict) -> dict:
    """Deterministically simplify detail plans while preserving core intent."""
    plan = dict(detail_plan or {})

    if mode == "animation":
        original_frame_count = plan.get("frame_count")
        frames = []
        for i, frame in enumerate((plan.get("frames") or [])[:5]):
            if not isinstance(frame, dict):
                continue
            frames.append({
                "frame_index": i,
                "description": str(frame.get("description") or f"关键步骤{i + 1}")[:60],
                "visual_elements": [str(v) for v in (frame.get("visual_elements") or [])[:3]],
                "narration": str(frame.get("narration") or "")[:40],
            })
        if not frames:
            frames = [{
                "frame_index": 0,
                "description": str(plan.get("title") or "核心概念展示"),
                "visual_elements": ["核心对象", "变化信号", "结论标记"],
                "narration": "",
            }]
        plan["frames"] = frames
        try:
            raw_count = int(original_frame_count)
            plan["frame_count"] = max(4, min(raw_count, 6))
        except (TypeError, ValueError):
            plan["frame_count"] = max(4, min(len(frames), 6))
        plan["layout"] = {
            "focal_object": (plan.get("layout") or {}).get("focal_object", "核心对象"),
            "secondary_object": (plan.get("layout") or {}).get("secondary_object", "辅助对象"),
            "safe_area_fill": 0.62,
        }
        beats = [b for b in (plan.get("beats") or []) if isinstance(b, dict)][:5]
        if not beats:
            beats = [
                {"t": 0.0, "action": "enter", "focus": "核心对象"},
                {"t": 0.2, "action": "anticipation", "focus": "触发点"},
                {"t": 0.55, "action": "main_action", "focus": "关键变化"},
                {"t": 0.8, "action": "secondary_overlap", "focus": "辅助反馈"},
                {"t": 1.0, "action": "settle", "focus": "结论"},
            ]
        plan["beats"] = beats

    elif mode == "game":
        params = []
        for i, p in enumerate((plan.get("simulation_params") or [])[:3]):
            if not isinstance(p, dict):
                continue
            pmin = p.get("min", 0)
            pmax = p.get("max", 100)
            try:
                pmin_f = float(pmin)
                pmax_f = float(pmax)
                if pmax_f <= pmin_f:
                    pmax_f = pmin_f + 1
                pmin, pmax = int(pmin_f), int(pmax_f)
            except (TypeError, ValueError):
                pmin, pmax = 0, 100
            default = p.get("default", int((pmin + pmax) / 2))
            params.append({
                "param_name": str(p.get("param_name") or f"param_{i + 1}"),
                "label": str(p.get("label") or f"参数{i + 1}"),
                "min": pmin,
                "max": pmax,
                "default": int(default) if isinstance(default, (int, float)) else int((pmin + pmax) / 2),
                "unit": str(p.get("unit") or ""),
            })
        plan["simulation_params"] = params
        plan["interaction_flow"] = [str(s) for s in (plan.get("interaction_flow") or [])[:4]]
        plan["visual_storyboard"] = [str(s) for s in (plan.get("visual_storyboard") or [])[:3]]

    elif mode == "story":
        paragraphs = []
        for para in (plan.get("paragraphs") or [])[:4]:
            if not isinstance(para, dict):
                continue
            paragraphs.append({
                "text": str(para.get("text") or "")[:180],
                "image_prompt": str(para.get("image_prompt") or "")[:320],
            })
        plan["paragraphs"] = paragraphs

    persuasion = plan.get("persuasion")
    if not isinstance(persuasion, dict):
        plan["persuasion"] = {
            "learning_claim": "本场景聚焦一个关键概念，确保学生能解释“为什么”。",
            "evidence": "通过可见变化证明概念成立，减少抽象记忆负担。",
            "takeaway": "学生能用自己的话复述规律并举一个生活例子。",
        }
    return plan
