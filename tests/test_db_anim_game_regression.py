"""Regression test: every animation / game HTML saved in lesson_content must render.

Runs `scripts/verify/_extract_db_html.py` (Python) to dump all HTML blobs from
`~/.systemedu/systemedu.db`, then hands the manifest to
`scripts/verify/db_regression.mjs` (Playwright) which:
  - loads each HTML in Chromium
  - checks canvas exists, has sane size, and has non-black pixels
  - checks no JS errors fire
  - for animations, checks AnimRuntime is defined + title DOM is filled

The test is skipped when:
  - the DB file is missing (clean checkout, CI without seed data)
  - node / playwright chromium is unavailable

This is a slow integration test. Gate with `pytest -m regression` or run
explicitly:
    pytest tests/test_db_anim_game_regression.py -s
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path.home() / ".systemedu" / "systemedu.db"
EXTRACT_PY = ROOT / "scripts" / "verify" / "_extract_db_html.py"
VERIFY_JS = ROOT / "scripts" / "verify" / "db_regression.mjs"


def _node_available() -> bool:
    return shutil.which("node") is not None


def _playwright_available() -> bool:
    # We look for a local `node_modules/playwright` install — the Node script
    # imports `playwright` directly.
    return (ROOT / "node_modules" / "playwright").exists()


def _require_env():
    missing = []
    if not DB_PATH.exists():
        missing.append(f"DB missing at {DB_PATH}")
    if not _node_available():
        missing.append("node not on PATH")
    if not _playwright_available():
        missing.append("playwright not installed (run `npm i playwright`)")
    if not EXTRACT_PY.exists():
        missing.append(f"missing {EXTRACT_PY}")
    if not VERIFY_JS.exists():
        missing.append(f"missing {VERIFY_JS}")
    if missing:
        pytest.skip("; ".join(missing))


pytestmark = pytest.mark.regression


def _run_regression(project: str | None = None) -> dict:
    """Run extract + verify pipeline, return parsed report dict."""
    _require_env()
    tmp_root = Path(tempfile.mkdtemp(prefix="db_anim_game_reg_"))
    manifest = tmp_root / "manifest.json"
    report = tmp_root / "report.json"

    # Step 1: extract HTML blobs
    extract_cmd = [
        sys.executable,
        str(EXTRACT_PY),
        "--out",
        str(tmp_root),
        "--manifest",
        str(manifest),
    ]
    if project:
        extract_cmd += ["--project", project]
    res = subprocess.run(extract_cmd, capture_output=True, text=True, timeout=60)
    assert res.returncode == 0, (
        f"extract failed: rc={res.returncode}\nstdout={res.stdout}\nstderr={res.stderr}"
    )
    assert manifest.exists(), "manifest not produced"
    items = json.loads(manifest.read_text(encoding="utf-8")).get("items", [])
    if not items:
        pytest.skip("no animation/game HTML found in DB")

    # Step 2: verify via Playwright
    verify_cmd = [
        "node",
        str(VERIFY_JS),
        str(manifest),
        "--json",
        str(report),
        "--out",
        str(tmp_root),
    ]
    # Timeout scales with item count (~3s per item)
    timeout = max(120, 5 * len(items))
    verify = subprocess.run(
        verify_cmd, capture_output=True, text=True, timeout=timeout, cwd=str(ROOT)
    )
    # We do NOT assert returncode==0 here because we want the report, not the
    # bare exit code; the report tells us which items failed.
    assert report.exists(), (
        f"regression report not produced\nstdout={verify.stdout}\nstderr={verify.stderr}"
    )
    data = json.loads(report.read_text(encoding="utf-8"))
    data["_tmp_root"] = str(tmp_root)
    data["_verify_stdout"] = verify.stdout
    return data


def _format_failures(report: dict) -> str:
    """Turn a failing report into a human-readable diff suitable for an assertion."""
    fails = [r for r in report.get("results", []) if not r.get("ok")]
    if not fails:
        return ""
    lines = [f"{report['summary']['failed']}/{report['summary']['total']} items failed:"]
    for r in fails[:20]:
        lines.append(
            f"  - {r['project']} k{r['knode_id']} {r['kind']} {r['key']}: {r.get('reason')}"
        )
    if len(fails) > 20:
        lines.append(f"  ... {len(fails) - 20} more")
    lines.append(f"tmp root: {report.get('_tmp_root')}")
    return "\n".join(lines)


def test_all_db_animations_and_games_render():
    """Every saved animation/game HTML must render a non-black canvas without JS errors."""
    report = _run_regression()
    summary = report["summary"]
    if summary["failed"]:
        pytest.fail(_format_failures(report))
    assert summary["passed"] == summary["total"] > 0


@pytest.mark.parametrize(
    "project",
    # Extendable list; add new projects here as they land in DB.
    ["mars-risk-map", "rocket-design"],
)
def test_project_animations_and_games_render(project: str):
    """Per-project variant so CI can attribute failures to one project."""
    # Skip if project not in DB rather than fail
    _require_env()
    import sqlite3 as _sqlite3

    conn = _sqlite3.connect(str(DB_PATH))
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM lesson_content WHERE project_name=?", (project,)
        ).fetchone()[0]
    finally:
        conn.close()
    if not count:
        pytest.skip(f"project {project} not in DB")

    report = _run_regression(project=project)
    if report["summary"]["failed"]:
        pytest.fail(_format_failures(report))
