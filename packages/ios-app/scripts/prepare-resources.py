#!/usr/bin/env python3
"""Build shared source and copy its deterministic output into the iOS bundle."""
from pathlib import Path
import shutil
import subprocess

app = Path(__file__).resolve().parents[1]
runtime = app.parent / "learning-runtime"
subprocess.run(["npm", "run", "typecheck"], cwd=runtime, check=True)
subprocess.run(["npm", "run", "build"], cwd=runtime, check=True)
target = app / "SystemEdu/Resources/WebRuntime"
if target.exists():
    shutil.rmtree(target)
shutil.copytree(runtime / "dist", target, ignore=shutil.ignore_patterns("build-meta.json"))
total = sum(p.stat().st_size for p in target.rglob("*") if p.is_file())
print(f"Prepared {total:,} bytes of local classroom resources at {target}")
