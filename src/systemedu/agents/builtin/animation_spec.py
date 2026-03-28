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
# AnimationSpec JSON Schema（LLM 输出目标）
# ─────────────────────────────────────────────────────────────

ANIMATION_SPEC_SCHEMA = """\
{
  "style_key": "edu_soft_tech|concept_lab_clean|storybook_vivid",
  "frame_duration": 3.0,
  "frames": [
    {
      "caption": "该帧的底部说明文字（10字以内）",
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

以下帧序列供参考（你需要转化为具体的视觉元素和坐标）：
{frames_description}

输出格式（严格 JSON，不要 markdown 代码块）：
{schema}

注意：
- x/y/cx/cy/w/h 必须是数字，在 0-600（x）和 0-360（y，主内容区）范围内
- 所有坐标要精确，确保元素不超出画布边界
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
    """将 AnimationSpec JSON 编译为自包含 HTML 字符串。"""
    from systemedu.agents.builtin.media_art_direction import inject_katex_if_needed

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
    """验证 AnimationSpec 的基本结构，返回 (valid, issues)。"""
    issues = []
    if not isinstance(spec, dict):
        return False, ["spec 不是 dict"]
    frames = spec.get("frames", [])
    if not frames:
        issues.append("frames 为空")
    elif not isinstance(frames, list):
        issues.append("frames 不是列表")
    else:
        for i, frame in enumerate(frames):
            if not isinstance(frame, dict):
                issues.append(f"frame[{i}] 不是 dict")
                continue
            elements = frame.get("elements", [])
            if len(elements) < 2:
                issues.append(f"frame[{i}] 元素数量 {len(elements)} < 2")
            for j, el in enumerate(elements):
                if not isinstance(el, dict):
                    issues.append(f"frame[{i}].elements[{j}] 不是 dict")
                    continue
                if "type" not in el:
                    issues.append(f"frame[{i}].elements[{j}] 缺少 type")
    return len(issues) == 0, issues
