"""Regression tests for Linux deployment scripts."""

from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_deploy_script_references_linux_system_deps():
    script = (ROOT / "scripts" / "deploy.sh").read_text(encoding="utf-8")

    assert "source scripts/linux_system_deps.sh" in script
    assert "systemedu_install_linux_system_deps" in script
    assert "systemedu_verify_linux_runtime" in script
    assert "python -m pip install dashscope manim" in script
    assert "ManimGenAgent().runtime_profile()" in script


def test_linux_system_deps_script_covers_manim_runtime_packages():
    script = (ROOT / "scripts" / "linux_system_deps.sh").read_text(encoding="utf-8")

    for expected in (
        "ffmpeg",
        "libcairo2-dev",
        "libpango1.0-dev",
        "ghostscript",
        "dvisvgm",
        "texlive",
        "nodejs",
        "npm",
        "python3-venv",
    ):
        assert expected in script


def test_deploy_scripts_are_valid_bash():
    for relative_path in ("scripts/deploy.sh", "scripts/linux_system_deps.sh"):
        result = subprocess.run(
            ["bash", "-n", str(ROOT / relative_path)],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        assert result.returncode == 0, result.stderr
