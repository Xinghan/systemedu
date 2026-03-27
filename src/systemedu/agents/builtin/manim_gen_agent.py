"""ManimGenAgent - optional Manim-based animation generation."""

from __future__ import annotations

import importlib.util
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

from systemedu.core.config import SYSTEMEDU_HOME

logger = logging.getLogger(__name__)

MANIM_CODE_PROMPT = """你是一位 Manim 工程师。请为下面的知识点生成可执行的 Manim Python 代码。

LaTeX 支持：{latex_instruction}

要求：
1. 只输出纯 Python 代码，不要 markdown 代码块包裹，不要任何说明文字
2. 必须定义一个 Scene 子类，类名固定为 LessonScene
3. 适合公式/几何/坐标/函数演示，不要复杂花哨镜头
4. 代码必须尽量稳定，优先使用 Text、Axes、NumberPlane、Line、Arrow、Dot、Circle、Square、Triangle、RoundedRectangle
5. 绝对禁止引用任何外部变量（如 latex_available、globals()），代码必须完全自包含
6. 动画长度控制在 8-15 秒，使用 4-5 个关键步骤
7. 场景 16:9，背景简洁，重点突出公式和变化关系
8. 画面简单有说服力：一个主公式/主图形 + 1-2 个辅助说明，不要堆过多元素
9. 不要依赖外部资源文件
10. 使用 `self.camera.background_color` 明确设置背景色（推荐深色如 "#0d1117"）
11. 优先用 FadeIn、Create、Write、Transform、Indicate，避免复杂 updater
12. 代码必须可以直接运行，不允许有任何语法错误或未定义变量

知识点：{node_title}
简介：{node_summary}
主题类型：{subject_hint}
detail_plan：{detail_plan_json}
"""


class ManimGenAgent:
    """Generate a local Manim video and wrap it as iframe HTML."""

    def __init__(self, llm=None):
        self.llm = llm

    def is_available(self) -> bool:
        """Return whether local Manim runtime is available."""
        profile = self.runtime_profile()
        return profile["manim_available"] and profile["ffmpeg_available"]

    def runtime_profile(self) -> dict:
        """Inspect local runtime capabilities relevant to Manim generation."""
        tex_env = self._build_tex_env()
        latex_bin = shutil.which("latex") or shutil.which("pdflatex")
        dvisvgm_bin = shutil.which("dvisvgm")
        return {
            "manim_available": importlib.util.find_spec("manim") is not None,
            "ffmpeg_available": shutil.which("ffmpeg") is not None,
            "latex_available": bool(latex_bin and dvisvgm_bin and tex_env.get("TEXMFCNF")),
            "python_executable": sys.executable,
            "tex_env": tex_env,
        }

    async def generate(
        self,
        *,
        detail_plan: dict,
        node_title: str,
        node_summary: str = "",
        subject_hint: str = "math_formula",
    ) -> str:
        """Generate animation HTML using Manim if available, else return empty."""
        runtime = self.runtime_profile()
        if not self.is_available():
            return ""

        try:
            code = ""
            if self.llm is not None:
                code = await self._generate_code(
                    detail_plan=detail_plan,
                    node_title=node_title,
                    node_summary=node_summary,
                    subject_hint=subject_hint,
                    runtime=runtime,
                )
            if not code:
                code = self._build_fallback_code(
                    detail_plan=detail_plan,
                    node_title=node_title,
                    node_summary=node_summary,
                    subject_hint=subject_hint,
                    latex_available=runtime["latex_available"],
                )
            if not code:
                return ""
            video_url = self._render_to_media(
                code,
                python_executable=runtime["python_executable"],
                extra_env=runtime.get("tex_env"),
            )
            if not video_url:
                return ""
            return _build_manim_player_html(video_url, detail_plan.get("title") or node_title)
        except Exception:
            logger.exception("ManimGenAgent: failed for '%s'", node_title)
            return ""

    async def _generate_code(
        self,
        *,
        detail_plan: dict,
        node_title: str,
        node_summary: str,
        subject_hint: str,
        runtime: dict,
    ) -> str:
        """Generate Manim Python source via LLM."""
        from langchain_core.messages import HumanMessage
        import asyncio

        latex_available = runtime.get("latex_available", False)
        if latex_available:
            latex_instruction = "LaTeX 可用，可以使用 MathTex 和 Tex 渲染公式，但必须确保语法正确，复杂公式优先使用 Text 保险"
        else:
            latex_instruction = "LaTeX 不可用，严禁使用 MathTex 或 Tex，所有公式必须用 Text 以纯文本方式展示，例如 Text('a^2 + b^2 = c^2')"
        prompt = MANIM_CODE_PROMPT.format(
            latex_instruction=latex_instruction,
            node_title=node_title,
            node_summary=node_summary,
            subject_hint=subject_hint,
            detail_plan_json=json.dumps(detail_plan, ensure_ascii=False)[:5000],
        )
        response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
        text = response.content.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()
        if "class LessonScene" not in text:
            return ""
        # Patch out any globals()-based latex_available checks that would break in subprocess
        text = _patch_latex_conditional(text, latex_available=runtime.get("latex_available", False))
        return text

    def _render_to_media(
        self,
        code: str,
        *,
        python_executable: str | None = None,
        extra_env: dict | None = None,
    ) -> str:
        """Render Manim scene into SYSTEMEDU_HOME/media and return public URL."""
        job_id = uuid.uuid4().hex[:12]
        work_dir = SYSTEMEDU_HOME / "tmp" / "manim_jobs" / job_id
        media_dir = SYSTEMEDU_HOME / "media" / "animations" / "manim" / job_id
        work_dir.mkdir(parents=True, exist_ok=True)
        media_dir.mkdir(parents=True, exist_ok=True)

        script_path = work_dir / "scene.py"
        script_path.write_text(code, encoding="utf-8")

        cmd = [
            python_executable or sys.executable,
            "-m",
            "manim",
            str(script_path),
            "LessonScene",
            "-qm",          # 720p — fast enough for teaching, avoids 4K timeout
            "--format=mp4",
            f"--media_dir={media_dir}",
        ]
        env = os.environ.copy()
        tex_env = extra_env if extra_env is not None else self._build_tex_env()
        if tex_env:
            env.update({key: value for key, value in tex_env.items() if value})
        result = subprocess.run(
            cmd,
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=180,
            env=env,
        )
        if result.returncode != 0:
            logger.warning("ManimGenAgent render failed: %s", result.stderr[:500])
            return ""

        mp4_files = sorted(media_dir.rglob("*.mp4"))
        if not mp4_files:
            return ""
        rel = mp4_files[0].relative_to(SYSTEMEDU_HOME / "media")
        return f"/api/media/{rel.as_posix()}"

    def _build_tex_env(self) -> dict:
        """Build TeX-related environment variables for Homebrew TeX Live + dvisvgm."""
        env: dict[str, str] = {}
        kpsewhich = shutil.which("kpsewhich")
        if kpsewhich:
            texmfcnf = self._run_kpsewhich("texmf.cnf")
            if texmfcnf:
                env["TEXMFCNF"] = str(Path(texmfcnf).parent)
            for var_name in ("TEXMFROOT", "TEXMFDIST", "TEXMFVAR", "TEXMFCONFIG"):
                value = self._run_kpsewhich(f"-var-value={var_name}")
                if value:
                    env[var_name] = value

        if "LIBGS" not in env:
            for candidate in (
                "/opt/homebrew/lib/libgs.dylib",
                "/usr/local/lib/libgs.dylib",
            ):
                if Path(candidate).exists():
                    env["LIBGS"] = candidate
                    break

        return env

    def _run_kpsewhich(self, arg: str) -> str:
        """Query kpsewhich for a file or TeX Live variable."""
        kpsewhich = shutil.which("kpsewhich")
        if not kpsewhich:
            return ""
        try:
            result = subprocess.run(
                [kpsewhich, arg],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except Exception:
            return ""
        if result.returncode != 0:
            return ""
        return result.stdout.strip()

    def _build_fallback_code(
        self,
        *,
        detail_plan: dict,
        node_title: str,
        node_summary: str,
        subject_hint: str,
        latex_available: bool,
    ) -> str:
        """Build deterministic Manim code when LLM output is unavailable."""
        title = (detail_plan.get("title") or node_title or "知识点").strip()
        formula = _extract_formula_text(node_title=node_title, node_summary=node_summary, detail_plan=detail_plan)
        subtitle = _derive_subtitle(subject_hint)
        points = _collect_supporting_points(detail_plan=detail_plan, node_summary=node_summary)

        title_literal = json.dumps(title, ensure_ascii=False)
        formula_literal = json.dumps(formula, ensure_ascii=False)
        subtitle_literal = json.dumps(subtitle, ensure_ascii=False)
        point_literals = [json.dumps(point, ensure_ascii=False) for point in points]

        if latex_available:
            formula_block = f"""
        try:
            formula = MathTex({formula_literal}, color=YELLOW_B).scale(1.15)
        except Exception:
            formula = Text({formula_literal}, font_size=38, color=YELLOW_B)
        formula.move_to(panel.get_center() + UP * 0.55)
"""
        else:
            formula_block = f"""
        formula = Text({formula_literal}, font_size=38, color=YELLOW_B)
        formula.move_to(panel.get_center() + UP * 0.55)
"""

        bullet_lines = "\n".join(
            f'        bullet_{idx} = Text({literal}, font_size=24, color=GREY_A)\n'
            f'        bullet_{idx}.align_to(panel, LEFT).shift(DOWN * {1.05 + idx * 0.55} + RIGHT * 1.0)'
            for idx, literal in enumerate(point_literals)
        )
        bullet_group_expr = f"VGroup({', '.join(f'bullet_{idx}' for idx in range(len(point_literals)))})"
        if not point_literals:
            bullet_group_expr = "VGroup()"

        return f"""from manim import *


class LessonScene(Scene):
    def construct(self):
        self.camera.background_color = "#0b1220"

        title = Text({title_literal}, font_size=34, color=WHITE)
        title.to_edge(UP, buff=0.45)

        panel = RoundedRectangle(
            corner_radius=0.22,
            width=10.6,
            height=4.9,
            stroke_color=BLUE_E,
            stroke_width=2,
            fill_color="#0f172a",
            fill_opacity=1.0,
        )
        panel.shift(DOWN * 0.25)

{formula_block}
        caption = Text({subtitle_literal}, font_size=26, color=BLUE_B)
        caption.next_to(formula, DOWN, buff=0.38)
        focus_box = SurroundingRectangle(formula, buff=0.28, color=YELLOW_B, corner_radius=0.15)
        arrow = Arrow(
            start=caption.get_bottom() + DOWN * 0.12,
            end=formula.get_bottom() + DOWN * 0.02,
            buff=0.12,
            color=BLUE_B,
            stroke_width=6,
        )
{bullet_lines}

        bullets = {bullet_group_expr}

        self.play(FadeIn(title, shift=UP * 0.2), Create(panel), run_time=1.0)
        self.play(Write(formula), FadeIn(caption, shift=UP * 0.1), run_time=1.3)
        self.play(Create(focus_box), GrowArrow(arrow), run_time=0.9)
        self.play(LaggedStart(*[FadeIn(item, shift=RIGHT * 0.12) for item in bullets], lag_ratio=0.18), run_time=1.4)
        self.play(Indicate(formula, scale_factor=1.05, color=YELLOW_B), run_time=0.9)
        self.play(FadeOut(focus_box), run_time=0.5)
        self.wait(0.8)
"""


def _extract_formula_text(*, node_title: str, node_summary: str, detail_plan: dict) -> str:
    """Extract the most persuasive formula-like string we can safely display."""
    candidates: list[str] = []
    for text in (
        node_title,
        node_summary,
        detail_plan.get("formula"),
        detail_plan.get("summary"),
        detail_plan.get("title"),
    ):
        if isinstance(text, str) and text.strip():
            candidates.append(text.strip())

    frame_texts = detail_plan.get("frames") or []
    for frame in frame_texts[:4]:
        if not isinstance(frame, dict):
            continue
        for key in ("description", "narration"):
            value = frame.get(key)
            if isinstance(value, str) and value.strip():
                candidates.append(value.strip())

    for text in candidates:
        match = re.search(r"([A-Za-z0-9_\\^√∑∫πθλΔ=+\-*/(). ]{5,})", text)
        if match and "=" in match.group(1):
            return _clean_text_payload(match.group(1), max_len=42)

    for text in candidates:
        if any(token in text for token in ("公式", "定理", "函数", "关系", "变化")):
            return _clean_text_payload(text, max_len=42)

    return _clean_text_payload(node_title or "核心关系", max_len=28)


def _derive_subtitle(subject_hint: str) -> str:
    if subject_hint == "physics_formula":
        return "先看关系式，再看变量如何影响结果"
    if subject_hint == "math_formula":
        return "抓住主公式，理解图形与数量关系"
    return "聚焦一个核心变化，避免堆叠场景"


def _collect_supporting_points(*, detail_plan: dict, node_summary: str) -> list[str]:
    points: list[str] = []
    for beat in (detail_plan.get("beats") or [])[:3]:
        if not isinstance(beat, dict):
            continue
        focus = beat.get("focus") or beat.get("action")
        if isinstance(focus, str) and focus.strip():
            points.append(_clean_text_payload(focus, max_len=22))

    if not points and node_summary:
        chunks = re.split(r"[，。,；;：:]", node_summary)
        points.extend(_clean_text_payload(chunk, max_len=22) for chunk in chunks if chunk.strip())

    cleaned = [point for point in points if point][:3]
    if cleaned:
        return cleaned
    return ["锁定核心对象", "展示一步关键变化", "最后稳定收束"]


def _clean_text_payload(text: str, *, max_len: int) -> str:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    cleaned = cleaned.replace('"', "'")
    return cleaned[:max_len]


def _patch_latex_conditional(code: str, *, latex_available: bool) -> str:
    """Replace globals()-based latex_available checks with the actual boolean value.

    LLMs tend to emit patterns like:
        if globals().get('latex_available', False): ...
        if latex_available: ...
    These fail at runtime because latex_available is not a Python variable in the subprocess.
    We substitute the resolved value so the code is self-contained.
    """
    import re as _re

    # Replace: globals().get('latex_available', ...) or globals().get("latex_available", ...)
    val = "True" if latex_available else "False"
    code = _re.sub(
        r"""globals\(\)\.get\(["']latex_available["'],\s*\w+\)""",
        val,
        code,
    )
    # Replace: bare `latex_available` variable references (as condition)
    # Only when it appears as a standalone name in boolean context, not inside strings
    # Replace `if latex_available:` / `elif latex_available:`
    code = _re.sub(
        r"\blatex_available\b",
        val,
        code,
    )
    return code


def _build_manim_player_html(video_url: str, title: str) -> str:
    """Build embeddable HTML wrapper around rendered Manim video."""
    safe_title = re.sub(r"[<>&]", "", title or "动画")
    return f"""<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {{
      --bg: #0b1220;
      --surface: #0f172a;
      --border: rgba(148, 163, 184, 0.24);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
    }}
    * {{ box-sizing: border-box; }}
    html, body {{
      margin: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at top, #172554 0%, var(--bg) 58%);
      font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      color: var(--text);
      overflow: hidden;
    }}
    .shell {{
      width: 100%;
      height: 100%;
      padding: 14px;
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 10px;
    }}
    .player {{
      width: 100%;
      height: 100%;
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      background: #020617;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
    }}
    video {{
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      background: #020617;
    }}
    .caption {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--muted);
      padding: 0 4px;
    }}
    .badge {{
      color: var(--accent);
      font-weight: 700;
    }}
  </style>
</head>
<body>
  <div class="shell">
    <div class="player">
      <video id="lesson-video" controls playsinline preload="metadata">
        <source src="{video_url}" type="video/mp4" />
      </video>
    </div>
    <div class="caption">
      <span>{safe_title}</span>
      <span class="badge">Manim</span>
    </div>
  </div>
  <script>
    const video = document.getElementById("lesson-video");
    if (video) {{
      video.addEventListener("ended", () => {{
        window.parent.postMessage({{ type: "STEP_COMPLETE" }}, "*");
      }});
    }}
  </script>
</body>
</html>"""
