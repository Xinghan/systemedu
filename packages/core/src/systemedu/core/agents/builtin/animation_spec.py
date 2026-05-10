"""AnimationSpec — 动画场景描述结构体和 HTML 编译器。

LLM 输出 AnimationSpec JSON，由 AnimationCompiler 编译为自包含 HTML。
Runtime (animation_runtime.js) 在浏览器中解析 spec 并渲染 SVG 动画。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# 语义布局系统（A1 slot 系统）
# ─────────────────────────────────────────────────────────────

# slot 定义（画布 600x360 主内容区，底部 60px 保留给 HUD）
SLOT_TABLE: dict[str, dict] = {
    "top-left":   {"x": 60,  "y": 30,  "w": 200, "h": 120},
    "top-center": {"x": 200, "y": 30,  "w": 200, "h": 120},
    "top-right":  {"x": 340, "y": 30,  "w": 200, "h": 120},
    "mid-left":   {"x": 30,  "y": 150, "w": 180, "h": 120},
    "center":     {"x": 210, "y": 120, "w": 180, "h": 120},
    "mid-right":  {"x": 390, "y": 150, "w": 180, "h": 120},
    "bot-left":   {"x": 30,  "y": 260, "w": 180, "h": 80},
    "bot-center": {"x": 210, "y": 260, "w": 180, "h": 80},
    "bot-right":  {"x": 390, "y": 260, "w": 180, "h": 80},
    "full-width": {"x": 40,  "y": 80,  "w": 520, "h": 200},
}

SIZE_SCALE: dict[str, float] = {
    "small": 0.5,
    "medium": 0.75,
    "large": 1.0,
    "xlarge": 1.25,
}


def _resolve_slot(el: dict) -> dict:
    """将 slot+size 转换为 x,y,w,h（原地修改，返回 el）。"""
    slot = el.pop("slot", None)
    if slot is None:
        return el
    base = SLOT_TABLE.get(slot, SLOT_TABLE["center"])
    scale = SIZE_SCALE.get(el.pop("size", "large"), 1.0)
    cx = base["x"] + base["w"] / 2
    cy = base["y"] + base["h"] / 2
    w = base["w"] * scale
    h = base["h"] * scale
    if el.get("type") == "circle":
        el.setdefault("cx", cx)
        el.setdefault("cy", cy)
        el.setdefault("r", min(w, h) / 2)
    elif el.get("type") == "ellipse":
        el.setdefault("cx", cx)
        el.setdefault("cy", cy)
        el.setdefault("rx", w / 2)
        el.setdefault("ry", h / 2)
    else:
        el.setdefault("x", cx - w / 2)
        el.setdefault("y", cy - h / 2)
        el.setdefault("w", w)
        el.setdefault("h", h)
    return el


def _flatten_elements(elements: list) -> list[dict]:
    """递归展开 group 的 children，返回所有叶子元素列表（不含 group）。"""
    result = []
    for el in elements:
        if not isinstance(el, dict):
            continue
        if el.get("type") == "group":
            result.extend(_flatten_elements(el.get("children", [])))
        else:
            result.append(el)
    return result


def _resolve_slots_in_frame(elements: list) -> None:
    """递归对 frame 中所有元素（含 group children）做 slot 解析。"""
    for el in elements:
        if not isinstance(el, dict):
            continue
        _resolve_slot(el)
        if el.get("type") == "group":
            _resolve_slots_in_frame(el.get("children", []))


# ─────────────────────────────────────────────────────────────
# AnimationSpec JSON Schema（LLM 输出目标）
# ─────────────────────────────────────────────────────────────

ANIMATION_SPEC_SCHEMA = """\
{
  "style_key": "edu_soft_tech|concept_lab_clean|storybook_vivid",
  "frame_duration": 3.0,
  "frames": [
    {
      "caption": "该帧的底部说明文字（10字以内）",
      "objective": "该帧的教学目标（不是视觉描述，是教学意图，一句话）",
      "narration": "旁白（可选，10字以内）",
      "elements": [
        // 元素类型说明：
        // rect:   { type, x, y, w, h, fill, stroke, stroke_width, rx, opacity, id, enter }
        // circle: { type, cx, cy, r, fill, stroke, stroke_width, opacity, id, enter }
        // ellipse:{ type, cx, cy, rx, ry, fill, opacity, id, enter }
        // text:   { type, x, y, text, font_size, color, bold, anchor, id, enter }
        // line:   { type, x1, y1, x2, y2, stroke, stroke_width, id, enter }
        // arrow:  { type, x1, y1, x2, y2, stroke, stroke_width, id, enter }
        // label_bubble: { type, x, y, text, font_size, bg, id, enter }
        // formula: { type, x, y, w, h, text(LaTeX), font_size, color, id, enter }
        // group:  { type, children: [...elements], id, enter }
        // path:   { type, d, fill, stroke, stroke_width, id, enter }
        //
        // 坐标轴（自动计算刻度）：
        // axis:  { type, x, y, x_len, y_len, x_label, y_label, x_ticks, y_ticks, stroke, font_size }
        //   x/y 为原点坐标，x_len 为水平轴长度，y_len 为竖直轴长度（向上为负值）
        //
        // 网格（配合 axis 使用）：
        // grid:  { type, x, y, w, h, cols, rows, stroke, opacity }
        //
        // 函数曲线（编译器计算采样点）：
        // plot:  { type, fn, params, x_range, axis_ref, stroke, stroke_width }
        //   fn: "linear"|"quadratic"|"sine"|"points"
        //   params（linear）: { m, b } → y = m*x + b
        //   params（quadratic）: { a, b, c } → y = a*x²+b*x+c
        //   params（sine）: { amplitude, frequency, phase }
        //   params（points）: { points: [[x1,y1],...] }
        //   axis_ref: 关联 axis 元素的 id，用于坐标系转换
        //
        // 语义布局（推荐，代替绝对坐标）：
        //   slot: "top-left|top-center|top-right|mid-left|center|mid-right|bot-left|bot-center|bot-right|full-width"
        //   size: "small|medium|large|xlarge"（配合 slot 使用，不与 x/y/w/h 同时用）
        //
        // fill 可以是颜色字符串或渐变对象：
        //   { type: "linear", stops: [{ offset: "0%", color: "#1d4ed8", opacity: 1 }, ...] }
        //   { type: "radial", stops: [...] }
        //
        // enter（入场动画，可选）：
        //   { duration: 0.5, delay: 0.0, easing: "easeOut|spring|bounce|easeInOut", from_x: -80, from_y: 0 }
        //   { duration: 0.4, delay: 0.1, easing: "spring", from_scale: 0.3 }
        //   （from_x/from_y 表示从偏移位置滑入；from_scale 表示从缩放值放大到1）
      ]
    }
  ]
}"""

# ─────────────────────────────────────────────────────────────
# LLM Prompt 模板
# ─────────────────────────────────────────────────────────────

ANIMATION_SPEC_PROMPT = """\
你是一位 SVG 动画场景设计师。请为以下教学知识点设计一个动画场景规格（AnimationSpec）。

知识节点：{node_title}
动画标题：{anim_title}
动画类型：{animation_type}
风格：{style_hint}
帧数：{frame_count} 帧
布局信息：主焦点={focal_object}，次焦点={secondary_object}
节奏要点：{beats_summary}
{scientific_model_block}

画布尺寸：600 x 420（主内容区 600 x 360，底部 60px 为 HUD 系统保留，禁止在此放内容）
风格要求：
- style_key = {style_key}
- edu_soft_tech：主色 #1d4ed8，辅色 #0ea5e9，背景 #f2f7fb，卡片白色
- concept_lab_clean：主色 #0891b2，辅色 #22c55e，背景 #f0fdfa
- storybook_vivid：主色 #d97706，辅色 #0ea5e9，背景 #fffbeb

设计要求：
1. 每帧独立描述完整的场景状态（不是增量变化）
2. 主焦点元素应占据画面中心，尺寸不小于 160x120
3. 使用 enter 动画实现帧内元素的入场效果（先出现背景/容器，再出现主体，最后出现标注）
4. 第 1 帧：建立场景（容器/背景元素，anticipation 感）
5. 中间帧：展示核心变化（main action）
6. 最后帧：展示结论状态（settle + 标注 label_bubble）
7. 每帧至少包含 3-6 个元素
8. 使用 fill 渐变让主体元素更立体（linear 或 radial 渐变）
9. 数学公式使用 formula 类型，text 字段填写 LaTeX 代码（如 a^2 + b^2 = c^2）
10. 每帧必须有 objective 字段，用一句话说明该帧的教学意图（不是视觉描述，是教学目标）
11. 布局优先使用 slot 字段（如 "center"、"top-left"），只有箭头端点等需精确坐标时才用 x/y

以下帧序列供参考（你需要转化为具体的视觉元素和坐标）：
{frames_description}

输出格式（严格 JSON，不要 markdown 代码块）：
{schema}

注意：
- 优先使用 slot + size 组合代替绝对坐标（slot 列表见 schema 注释）
- 绝对坐标（x/y/cx/cy/w/h）只在 slot 不够精确时使用（如箭头端点）
- x/y/cx/cy/w/h 必须是数字，在 0-600（x）和 0-360（y，主内容区）范围内
- 直接输出 JSON，不要任何说明文字
"""


# ─────────────────────────────────────────────────────────────
# AnimationCompiler：AnimationSpec JSON → 完整 HTML
# ─────────────────────────────────────────────────────────────

_RUNTIME_JS_PATH = Path(__file__).parent / "animation_runtime.js"


def _load_runtime_js() -> str:
    """加载 animation_runtime.js 内容。"""
    try:
        return _RUNTIME_JS_PATH.read_text(encoding="utf-8")
    except Exception as exc:
        logger.error("AnimationCompiler: cannot load runtime JS: %s", exc)
        return "/* runtime load failed */"


def compile_animation_spec(spec: dict, node_title: str = "") -> str:
    """将 AnimationSpec JSON 编译为自包含 HTML 字符串。

    编译前对所有帧中的 slot 字段进行解析（A1），将语义布局转换为绝对坐标。
    """
    from systemedu.core.agents.builtin.media_art_direction import inject_katex_if_needed

    # A1: slot 解析预处理
    for frame in spec.get("frames", []):
        _resolve_slots_in_frame(frame.get("elements", []))

    runtime_js = _load_runtime_js()
    spec_json = json.dumps(spec, ensure_ascii=False)

    # 检测是否含公式（formula 元素）
    has_formula = '"formula"' in spec_json

    title = node_title or spec.get("title", "")

    html = f"""<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html, body {{
      width: 100%; height: 100%;
      overflow: hidden;
      font-family: "Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
      background: #f2f7fb;
    }}
    svg {{ display: block; }}
  </style>
</head>
<body>
  <div id="canvas" style="width:100%;height:100%;"></div>
  <script>
/* ── AnimationRuntime ── */
{runtime_js}
/* ── End Runtime ── */
  </script>
  <script>
    var SPEC = {spec_json};
    document.addEventListener('DOMContentLoaded', function() {{
      var container = document.getElementById('canvas');
      var rt = new AnimationRuntime(SPEC, container);
      rt.play();
    }});
  </script>
</body>
</html>"""

    if has_formula:
        html = inject_katex_if_needed(html)

    return html


def validate_animation_spec(spec: dict) -> tuple[bool, list[str]]:
    """验证 AnimationSpec 的结构、几何合法性和时间线合法性。

    返回 (valid, issues)。issues 非空时仍允许降级生成（不阻塞）。
    """
    issues = []
    if not isinstance(spec, dict):
        return False, ["spec 不是 dict"]

    frames = spec.get("frames", [])
    if not frames:
        issues.append("frames 为空")
    elif not isinstance(frames, list):
        issues.append("frames 不是列表")
    else:
        frame_duration = spec.get("frame_duration", 3.0)

        for i, frame in enumerate(frames):
            if not isinstance(frame, dict):
                issues.append(f"frame[{i}] 不是 dict")
                continue

            # A2: objective 字段检查
            if not frame.get("objective"):
                issues.append(f"第{i+1}帧缺少 objective 字段")

            elements = frame.get("elements", [])
            if len(elements) < 2:
                issues.append(f"第{i+1}帧元素数量 {len(elements)} < 2")

            for j, el in enumerate(elements):
                if not isinstance(el, dict):
                    issues.append(f"第{i+1}帧 elements[{j}] 不是 dict")
                    continue
                if "type" not in el:
                    issues.append(f"第{i+1}帧 elements[{j}] 缺少 type")

            # A3: 几何边界检查（对展开后的叶子元素）
            flat = _flatten_elements(elements)
            for el in flat:
                t = el.get("type")
                if t == "rect":
                    x = el.get("x", 0)
                    y = el.get("y", 0)
                    w = el.get("w", 0)
                    h = el.get("h", 0)
                    if x < 0 or y < 0 or x + w > 600 or y + h > 360:
                        issues.append(
                            f"第{i+1}帧元素 {el.get('id', '?')} (rect) "
                            f"超出画布边界 [{x:.0f},{y:.0f},{x+w:.0f},{y+h:.0f}]"
                        )
                elif t in ("circle", "ellipse"):
                    cx = el.get("cx", 0)
                    cy = el.get("cy", 0)
                    r = el.get("r", el.get("rx", 0))
                    if cx - r < 0 or cy - r < 0 or cx + r > 600 or cy + r > 360:
                        issues.append(
                            f"第{i+1}帧元素 {el.get('id', '?')} ({t}) 超出画布边界"
                        )
                elif t == "text":
                    fs = el.get("font_size", 14)
                    if fs < 10:
                        issues.append(
                            f"第{i+1}帧文字元素 {el.get('id', '?')} font_size={fs} 过小（< 10px），不可读"
                        )

            # A6: 时间线合法性验证
            for el in flat:
                enter = el.get("enter")
                if not enter or not isinstance(enter, dict):
                    continue
                delay = enter.get("delay", 0)
                duration = enter.get("duration", 0.5)
                el_id = el.get("id", "?")
                if duration <= 0:
                    issues.append(
                        f"第{i+1}帧元素 {el_id} enter.duration={duration} 必须 > 0"
                    )
                if delay < 0:
                    issues.append(
                        f"第{i+1}帧元素 {el_id} enter.delay={delay} 不能为负数"
                    )
                if delay + duration > frame_duration:
                    issues.append(
                        f"第{i+1}帧元素 {el_id} enter 动画(delay={delay}+duration={duration}) "
                        f"超出 frame_duration={frame_duration}"
                    )

    return len(issues) == 0, issues
