"""Node tests: ManimGenAgent."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest


class TestManimGenNode:
    def test_runtime_profile_collects_tex_env(self, monkeypatch):
        from systemedu.core.agents.builtin import manim_gen_agent as module

        agent = module.ManimGenAgent(MagicMock())

        monkeypatch.setattr(module.importlib.util, "find_spec", lambda name: object())
        monkeypatch.setattr(
            module.shutil,
            "which",
            lambda name: "/opt/homebrew/bin/" + name if name in {"ffmpeg", "latex", "dvisvgm", "kpsewhich"} else None,
        )
        monkeypatch.setattr(
            agent,
            "_run_kpsewhich",
            lambda arg: {
                "texmf.cnf": "/opt/homebrew/Cellar/texlive/20260301/share/texmf-dist/web2c/texmf.cnf",
                "-var-value=TEXMFROOT": "/opt/homebrew/Cellar/texlive/20260301/share",
                "-var-value=TEXMFDIST": "/opt/homebrew/Cellar/texlive/20260301/share/texmf-dist",
                "-var-value=TEXMFVAR": "/Users/xinghan/.texlive2026/texmf-var",
                "-var-value=TEXMFCONFIG": "/Users/xinghan/.texlive2026/texmf-config",
            }.get(arg, ""),
        )
        monkeypatch.setattr(module.Path, "exists", lambda self: str(self) == "/opt/homebrew/lib/libgs.dylib")

        profile = agent.runtime_profile()

        assert profile["latex_available"] is True
        assert profile["tex_env"]["TEXMFCNF"].endswith("/web2c")
        assert profile["tex_env"]["LIBGS"] == "/opt/homebrew/lib/libgs.dylib"

    def test_is_available_requires_manim_and_ffmpeg(self, monkeypatch):
        from systemedu.core.agents.builtin import manim_gen_agent as module

        agent = module.ManimGenAgent(MagicMock())

        monkeypatch.setattr(module.importlib.util, "find_spec", lambda name: object())
        monkeypatch.setattr(
            module.shutil,
            "which",
            lambda name: "/opt/tool" if name == "ffmpeg" else None,
        )
        assert agent.is_available() is True

        monkeypatch.setattr(module.shutil, "which", lambda name: None)
        assert agent.is_available() is False

    @pytest.mark.asyncio
    async def test_generate_uses_deterministic_fallback_code(self, monkeypatch):
        from systemedu.core.agents.builtin.manim_gen_agent import ManimGenAgent

        agent = ManimGenAgent(llm=None)
        captured: dict[str, str] = {}

        monkeypatch.setattr(
            agent,
            "runtime_profile",
            lambda: {
                "manim_available": True,
                "ffmpeg_available": True,
                "latex_available": False,
                "python_executable": "/tmp/fake-python",
                "tex_env": {"TEXMFCNF": "/tmp/texmf.cnf.dir"},
            },
        )

        def fake_render(
            code: str,
            *,
            python_executable: str | None = None,
            extra_env: dict | None = None,
        ) -> str:
            captured["code"] = code
            captured["python"] = python_executable or ""
            captured["env"] = extra_env or {}
            return "/api/media/animations/manim/demo/video.mp4"

        monkeypatch.setattr(agent, "_render_to_media", fake_render)

        html = await agent.generate(
            detail_plan={
                "title": "勾股定理",
                "frames": [{"description": "a^2 + b^2 = c^2"}],
                "beats": [{"focus": "先看直角三角形"}, {"focus": "再看平方关系"}],
            },
            node_title="勾股定理",
            node_summary="通过 a^2 + b^2 = c^2 展示三边关系",
            subject_hint="math_formula",
        )

        assert "<video" in html.lower()
        assert "step_complete" in html.lower()
        assert "class LessonScene" in captured["code"]
        assert "MathTex" not in captured["code"]
        assert captured["python"] == "/tmp/fake-python"
        assert captured["env"]["TEXMFCNF"] == "/tmp/texmf.cnf.dir"

    def test_render_to_media_smoke(self, tmp_path, monkeypatch):
        from systemedu.core.agents.builtin import manim_gen_agent as module

        venv_python = Path.cwd() / ".venv" / "bin" / "python"
        if not venv_python.exists():
            pytest.skip("project venv python missing")

        probe = subprocess.run(
            [str(venv_python), "-c", "import manim"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if probe.returncode != 0:
            pytest.skip("manim not importable in project venv")

        monkeypatch.setattr(module, "SYSTEMEDU_HOME", tmp_path)

        agent = module.ManimGenAgent()
        code = """from manim import *


class LessonScene(Scene):
    def construct(self):
        self.camera.background_color = "#0b1220"
        panel = RoundedRectangle(width=8, height=4.5, corner_radius=0.2, color=BLUE_D)
        label = Text("F = m a", font_size=42, color=YELLOW_B)
        self.play(Create(panel), FadeIn(label, shift=UP * 0.15), run_time=0.8)
        self.play(Indicate(label, scale_factor=1.04), run_time=0.5)
        self.wait(0.2)
"""

        url = agent._render_to_media(code, python_executable=str(venv_python))

        assert url.startswith("/api/media/animations/manim/")
        relative = url.removeprefix("/api/media/")
        output_path = tmp_path / "media" / relative
        assert output_path.exists()
