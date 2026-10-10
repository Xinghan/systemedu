"""Read-only production checks; outputs counts/hashes, never learner text or secrets."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/course_migrations"))
from migrate_student_numbering import migrate
from systemedu.student.db import _ensure_engine

source = Path('/root/.systemedu-library/media/projects/molecule-monster-hunter')
report = json.loads((ROOT / 'source-report.json').read_text())
differences = []
for rel, expected in report['source_sha256'].items():
    path = source / rel
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        differences.append(rel)
print(json.dumps({'course_source_differences': differences, 'free_bytes': __import__('shutil').disk_usage(source).free}))
if differences:
    raise SystemExit('Production source differs; stop before changing content.')
print(json.dumps(migrate(_ensure_engine()), ensure_ascii=False))
