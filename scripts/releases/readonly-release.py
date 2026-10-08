"""Stepwise scoped lecture release. Run on the configured production host only."""
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path('/opt/systemedu')
R = ROOT / 'releases/readonly-20260914'
LIVE = ROOT / 'packages/student-web'
COURSE = Path('/root/.systemedu-library/media/projects/molecule-monster-hunter')
STAGE = R / 'course'
MEM = Path('/dev/shm/systemedu-readonly-20260914')
UPLOAD = Path('/tmp/systemedu-readonly-20260914')
DATABASE = Path('/root/.systemedu-library/db.sqlite')
SERVICES = ['systemedu-student-backend', 'systemedu-student-worker', 'systemedu-student-web', 'systemedu-library']
MODULES = ['M01', 'M02', 'M03', 'M08']
EXPECTED = json.loads((UPLOAD / 'expected.json').read_text())

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def hashes(root):
    return {str(p.relative_to(root)): sha(p) for p in root.rglob('*')
            if p.is_file() and not any(x in p.parts for x in ['node_modules', '.next', '_archive', '__pycache__'])
            and p.name != 'tsconfig.tsbuildinfo'}
def save(name, value): (R / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
def run(*cmd): subprocess.run(cmd, check=True)
def check_selected(root, expected):
    for rel, digest in expected.items(): assert sha(root / rel) == digest, rel
def extract(file, destination, allowed):
    with tarfile.open(file) as tar:
        assert set(tar.getnames()) == set(allowed)
        assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in tar.getmembers())
        for rel in allowed:
            target = destination / rel
            if target.exists(): target.unlink()  # Break shared hardlinks before replacement.
        tar.extractall(destination)

R.mkdir(mode=0o700, exist_ok=True)
action = sys.argv[1]
if action == 'stage':
    assert not (R / 'stage.ok').exists()
    assert (LIVE / '.next/BUILD_ID').read_text().strip() == EXPECTED['expected_build']
    assert shutil.disk_usage(R).free > 1_000_000_000
    check_selected(LIVE, EXPECTED['baseline_web_sha256'])
    save('web-before.json', hashes(LIVE)); save('course-before.json', hashes(COURSE))
    # Source files get independent inodes. Large immutable media/dependencies are reused.
    shutil.copytree(LIVE, R / 'student-web', ignore=shutil.ignore_patterns('node_modules', '.next', 'public', 'tsconfig.tsbuildinfo'))
    run('cp', '-al', str(LIVE / 'public'), str(R / 'student-web/public'))
    run('cp', '-al', str(LIVE / 'node_modules'), str(R / 'student-web/node_modules'))
    extract(UPLOAD / 'web-delta.tar.gz', R / 'student-web', EXPECTED['web_sha256'])
    check_selected(R / 'student-web', EXPECTED['web_sha256'])
    before = json.loads((R / 'web-before.json').read_text()); after = hashes(R / 'student-web')
    assert {p for p in before.keys() | after.keys() if before.get(p) != after.get(p)} <= set(EXPECTED['web_sha256'])
    save('web-expected.json', after)
    run('cp', '-al', str(COURSE), str(STAGE))
    if (STAGE / '_archive').exists(): shutil.rmtree(STAGE / '_archive')
    extract(UPLOAD / 'course-delta.tar.gz', STAGE, EXPECTED['course_sha256'])
    check_selected(STAGE, EXPECTED['course_sha256'])
    from library.manifest import load_manifest, verify_files
    assert not verify_files(load_manifest(STAGE / 'manifest.json'), STAGE)
    before = json.loads((R / 'course-before.json').read_text()); after = hashes(STAGE)
    assert {p for p in before.keys() | after.keys() if before.get(p) != after.get(p)} == set(EXPECTED['course_sha256'])
    save('course-expected.json', after)
    MEM.mkdir(mode=0o700)
    assert shutil.disk_usage(MEM).free > 3_000_000_000
    with tarfile.open(MEM / 'molecule-monster-hunter.tar.gz', 'w:gz') as tar: tar.add(STAGE, arcname='molecule-monster-hunter')
    (R / 'stage.ok').touch()
    print('Staged 11 frontend files; exactly eight course JSON files plus manifest. Live source unchanged.')
elif action == 'build':
    assert (R / 'stage.ok').exists() and not (R / 'build.ok').exists()
    env = {**os.environ, 'NEXT_PUBLIC_STUDENT_API_URL': '', 'NEXT_PUBLIC_GATEWAY_URL': ''}
    with (R / 'build.log').open('w') as log:
        subprocess.run(['npm', 'run', 'build'], cwd=R / 'student-web', env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    assert (R / 'student-web/.next/BUILD_ID').is_file()
    assert hashes(LIVE) == json.loads((R / 'web-before.json').read_text())
    assert hashes(R / 'student-web') == json.loads((R / 'web-expected.json').read_text())
    (R / 'build.ok').touch()
    print('Isolated build:', (R / 'student-web/.next/BUILD_ID').read_text().strip())
elif action == 'pause':
    assert (R / 'build.ok').exists() and (UPLOAD / 'browser-verified.json').is_file()
    assert not (R / 'paused.ok').exists()
    browser = json.loads((UPLOAD / 'browser-verified.json').read_text())
    assert browser['m03_s2_s7_motion_verified'] is True
    assert browser['web_sha256'] == EXPECTED['web_sha256']
    assert hashes(LIVE) == json.loads((R / 'web-before.json').read_text())
    assert hashes(COURSE) == json.loads((R / 'course-before.json').read_text())
    assert shutil.disk_usage(R).free > 650_000_000
    conf = Path('/etc/nginx/sites-available/systemedu')
    shutil.copy2(conf, R / 'nginx-before')
    text = conf.read_text(); assert 'server {' in text
    conf.write_text(text.replace('server {', 'server {\n  if (-f /opt/systemedu/releases/readonly-20260914/maintenance.flag) { return 503; }'))
    run('nginx', '-t'); (R / 'maintenance.flag').touch(); run('systemctl', 'reload', 'nginx')
    run('systemctl', 'stop', *SERVICES)
    with sqlite3.connect(f'file:{DATABASE}?mode=ro', uri=True) as src, sqlite3.connect(R / 'library-before.sqlite') as dst: src.backup(dst)
    (R / 'paused.ok').touch(); print('Maintenance enabled; all services quiesced and Library backed up.')
elif action == 'publish':
    assert (R / 'paused.ok').exists() and os.environ.get('TMPDIR') == str(MEM)
    import library.importer as importer
    importer.PROJECTS_MEDIA_DIR = MEM / 'imported'
    manifest = importer.import_tarball(MEM / 'molecule-monster-hunter.tar.gz')
    from library.manifest import verify_files
    assert not verify_files(manifest, MEM / 'imported/molecule-monster-hunter')
    assert not verify_files(manifest, STAGE)
    assert hashes(STAGE) == json.loads((R / 'course-expected.json').read_text())
    (STAGE / '_archive').mkdir()
    shutil.copy2(MEM / 'molecule-monster-hunter.tar.gz', STAGE / '_archive/molecule-monster-hunter-0.2.0.tar.gz')
    COURSE.rename(R / 'course-before'); STAGE.rename(COURSE)
    shutil.copytree(LIVE / '.next/static', R / 'student-web/.next/static', dirs_exist_ok=True)
    LIVE.rename(R / 'student-web-before'); (R / 'student-web').rename(LIVE)
    (R / 'live.ok').touch(); print('Read-only frontend and 34 lecture slides atomically switched.')
elif action == 'verify':
    assert (R / 'live.ok').exists()
    assert hashes(COURSE) == json.loads((R / 'course-expected.json').read_text())
    assert hashes(LIVE) == json.loads((R / 'web-expected.json').read_text())
    from library.models import get_session, Lesson
    db = get_session(); counts = {}
    for module in MODULES:
        node, = (COURSE / 'knodes').glob(module + '-*')
        slides = json.loads((node / 'slides.json').read_text())['slides']
        lesson = db.query(Lesson).filter_by(project_slug='molecule-monster-hunter', knode_id=module).one()
        assert lesson.slides == slides and all(s['audio_path'] is None for s in slides)
        counts[module] = len(slides)
    db.close(); assert sum(counts.values()) == 34
    before = sqlite3.connect(R / 'library-before.sqlite'); after = sqlite3.connect(DATABASE)
    query = 'SELECT project_slug,knode_id,title,plan_markdown,slides,rendered_sections FROM lessons WHERE project_slug != ? OR knode_id NOT IN (?,?,?,?) ORDER BY project_slug,knode_id'
    args = ('molecule-monster-hunter', *MODULES)
    assert before.execute(query, args).fetchall() == after.execute(query, args).fetchall()
    save('verification.json', {'project': 'molecule-monster-hunter', 'modules': counts, 'slides': 34, 'presentation_mode': 'readonly', 'other_nodes_unchanged': True, 'new_audio': False, 'build_id': (LIVE / '.next/BUILD_ID').read_text().strip(), 'authenticated_student_e2e': False})
    (R / 'verified.ok').touch(); print((R / 'verification.json').read_text())
elif action == 'start':
    assert (R / 'verified.ok').exists()
    run('systemctl', 'start', *SERVICES)
    print('Services started; maintenance remains until health/API checks pass.')
elif action == 'api-verify':
    import urllib.request
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for module in MODULES:
        request = urllib.request.Request(f'http://127.0.0.1:18821/v1/projects/molecule-monster-hunter/knodes/{module}', headers={'Authorization': 'Bearer ' + os.environ['LIBRARY_LICENSE_TOKEN']})
        with opener.open(request, timeout=20) as response: content = json.load(response)
        node, = (COURSE / 'knodes').glob(module + '-*')
        assert content['slides'] == json.loads((node / 'slides.json').read_text())['slides']
    for url in ['http://127.0.0.1:18820/api/health', 'http://127.0.0.1:4000/']:
        with opener.open(url, timeout=20) as response: assert response.status == 200
    (R / 'api.ok').touch(); print('All 34 Library API slide payloads exact; backend and web healthy.')
elif action == 'resume':
    assert (R / 'verified.ok').exists() and (R / 'api.ok').exists()
    shutil.copy2(R / 'nginx-before', '/etc/nginx/sites-available/systemedu')
    run('nginx', '-t'); run('systemctl', 'reload', 'nginx')
    (R / 'maintenance.flag').unlink(); (R / 'resumed.ok').touch()
    print('Public traffic resumed. Previous source, frontend, DB and nginx retained for rollback.')
elif action == 'rollback':
    assert (R / 'paused.ok').exists() and not (R / 'resumed.ok').exists()
    run('systemctl', 'stop', *SERVICES)
    if (R / 'course-before').exists(): COURSE.rename(R / 'course-failed'); (R / 'course-before').rename(COURSE)
    if (R / 'student-web-before').exists(): LIVE.rename(R / 'student-web-failed'); (R / 'student-web-before').rename(LIVE)
    for suffix in ['', '-wal', '-shm']:
        file = Path(str(DATABASE) + suffix)
        if file.exists(): file.rename(R / ('library-failed.sqlite' + suffix))
    shutil.copy2(R / 'library-before.sqlite', DATABASE)
    run('systemctl', 'start', *SERVICES)
    shutil.copy2(R / 'nginx-before', '/etc/nginx/sites-available/systemedu')
    run('nginx', '-t'); run('systemctl', 'reload', 'nginx')
    (R / 'rolled-back.ok').touch(); print('Previous course and frontend restored.')
else: raise SystemExit('Unknown release step')
