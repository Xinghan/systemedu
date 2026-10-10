"""One-file CSS rollout. Baselines and production source stay on the server."""
import hashlib
import json
import sys
from pathlib import Path

R = Path('/opt/systemedu/releases/slide-layout-20260909')
LIVE = Path('/opt/systemedu/packages/student-web')
COURSE = Path('/root/.systemedu-library/media/projects/molecule-monster-hunter')
TARGET = 'src/components/learning/diversity-rejection.css'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def hashes(root):
    return {p.relative_to(root).as_posix(): sha(p.read_bytes())
            for p in root.rglob('*') if p.is_file()
            and not {'node_modules', '.next', '.git'}.intersection(p.parts)
            and p.name != 'tsconfig.tsbuildinfo'}

def save(name, value):
    (R / name).write_text(json.dumps(value, indent=2))

def read(name):
    return json.loads((R / name).read_text())

action = sys.argv[1]
root = Path(sys.argv[2]) if len(sys.argv) > 2 else LIVE
if action == 'baseline':
    assert not (R / 'web-before.json').exists(), 'Baseline already exists'
    assert (LIVE / '.next/BUILD_ID').read_text().strip() == 'vmjD0lyGWkm0wfjQ9HWyU', 'Unexpected live build'
    prior = json.loads(Path('/opt/systemedu/releases/lesson-reader-20260909/web-expected.json').read_text())
    assert sha((LIVE / TARGET).read_bytes()) == prior[TARGET], 'CSS changed since previous release'
    save('web-before.json', hashes(LIVE))
    save('course-before.json', hashes(COURSE))
    print('Current reader release confirmed; baselines retained on server.')
elif action == 'patch':
    candidate = (R / 'diversity-rejection.css').read_bytes()
    assert b'container:diversity-rejection / inline-size' in candidate
    (root / TARGET).write_bytes(candidate)
    after = hashes(root)
    before = read('web-before.json')
    changed = sorted(p for p in before.keys() | after.keys() if before.get(p) != after.get(p))
    assert changed == [TARGET], f'Unexpected changes: {changed}'
    save('web-expected.json', after)
    print(json.dumps({'changed_files': changed, 'css_sha256': sha(candidate)}))
elif action == 'pre-switch':
    assert hashes(LIVE) == read('web-before.json'), 'Live frontend changed during build'
    assert hashes(root) == read('web-expected.json'), 'Candidate source changed'
    assert hashes(COURSE) == read('course-before.json'), 'Course content changed'
    print('One-file source whitelist and unchanged course verified.')
elif action == 'verify':
    assert hashes(root) == read('web-expected.json'), 'Live source mismatch'
    assert hashes(COURSE) == read('course-before.json'), 'Course content changed'
    css_assets = [p for p in (root / '.next/static').rglob('*.css')
                  if 'container:diversity-rejection' in p.read_text()]
    assert css_assets, 'New container styles absent from production build'
    result = {'build_id': (root / '.next/BUILD_ID').read_text().strip(),
              'changed_files': [TARGET], 'course_unchanged': True,
              'reader_and_renderers_unchanged': True,
              'css_sha256': sha((root / TARGET).read_bytes()),
              'css_assets': [p.relative_to(root / '.next').as_posix() for p in css_assets]}
    save('verification.json', result)
    print(json.dumps(result))
else:
    raise SystemExit('Unknown step')
