"""Regression checks for frontend/backend Manim display contract."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_api_types_expose_generation_backend():
    content = (ROOT / "web" / "src" / "lib" / "types" / "api.ts").read_text(encoding="utf-8")

    assert "CourseGenerationBackend" in content
    assert "generation_backend?" in content


def test_course_content_view_shows_backend_badge():
    content = (
        ROOT / "web" / "src" / "components" / "learning" / "course-content-view.tsx"
    ).read_text(encoding="utf-8")

    assert 'backend === "manim"' in content
    assert 'return "Manim"' in content
    assert "section.generation_backend || idea.generation_backend" in content


def test_course_step_renderer_detects_manim_html():
    content = (
        ROOT / "web" / "src" / "components" / "learning" / "course-step-renderer.tsx"
    ).read_text(encoding="utf-8")

    assert 'step.html.includes("/api/media/animations/manim/")' in content
    assert '"Manim 动画"' in content
