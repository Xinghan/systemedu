"""kg-builder pipeline CLI 冒烟测试 (spec 041)."""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
KGB = REPO / "tools" / "kg-builder"


def _run(args):
    env = {"PYTHONPATH": f"{KGB}:{REPO}", "NO_PROXY": "*"}
    import os
    full_env = {**os.environ, **env}
    return subprocess.run([sys.executable, "-m", "kg_builder", *args],
                          cwd=str(REPO), env=full_env, capture_output=True, text=True, timeout=60)


def test_status_runs_and_lists_all_subjects():
    r = _run(["--status"])
    assert r.returncode == 0, r.stderr
    # 11 学科都出现
    for subj in ["math", "phys", "chem", "bio", "cs", "elec", "env", "astro", "med", "eng", "geo"]:
        assert subj in r.stdout
    assert "总" in r.stdout


def test_no_subject_errors():
    r = _run([])
    assert r.returncode != 0  # 缺学科 id 报错
