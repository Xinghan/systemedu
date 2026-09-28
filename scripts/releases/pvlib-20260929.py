"""Server-side release: preserve production baseline, validate, then switch.

Only status/hash summaries leave the server. Backups stay on the server.
"""
import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path('/opt/systemedu')
WEB = ROOT / 'packages/student-web'
UP = Path('/tmp/pvlib-release-20260929')
RELEASE = ROOT / 'releases/pvlib-20260929'
CANDIDATE = RELEASE / 'packages/student-web'
SLUG = 'pvlib-solar-forecast-station'
PREVIEW = 'systemedu-pvlib-preview-web'
BASE = 'http://127.0.0.1:18821'
LIBRARY = Path('/root/.systemedu-library')
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name, value):
    (RELEASE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def read(name):
    return json.loads((RELEASE / name).read_text())


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def hashes(root):
    result = {}
    for directory, names, files in os.walk(root):
        names[:] = [name for name in names if name not in ['node_modules', '.next', '__pycache__']]
        for name in files:
            if name == 'tsconfig.tsbuildinfo':
                continue
            path = Path(directory) / name
            result[str(path.relative_to(root))] = sha(path)
    return result


def request(url, payload=None, token=None, content_type='application/json'):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if payload is not None:
        headers['Content-Type'] = content_type
    req = urllib.request.Request(url, data=payload, headers=headers)
    with opener.open(req, timeout=180) as response:
        return response.read()


def public_projects():
    return json.loads(request('http://127.0.0.1:18820/api/library/projects'))


def admin_token():
    # Load the existing deployment credential internally; never print it.
    credentials = subprocess.check_output(['bash', '-c', 'source /root/.systemedu-library-secrets; printf "%s" "$LIBRARY_BOOTSTRAP_ADMIN"'], text=True).strip()
    username, password = credentials.split(':', 1)
    return json.loads(request(BASE + '/admin/auth/login', json.dumps({'username': username, 'password': password}).encode()))['token']


def health(url):
    for _ in range(30):
        try:
            request(url)
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError('Health check failed: ' + url)


def baseline():
    assert (WEB / '.next/BUILD_ID').read_text().strip() == read('baseline.json')['build']
    assert hashes(WEB) == read('web-before.json'), 'Production frontend changed since staging'
    assert hashes(ROOT / 'packages/student-app') == read('backend-before.json')


def verify_course(root, manifest):
    assert manifest['slug'] == SLUG and len(manifest['knodes']) == 58
    assert manifest['knode_count'] == 58 and manifest['cover_image_path']
    for entry in manifest['files']:
        path = root / entry['path']
        assert path.is_file() and path.stat().st_size == entry['size'] and sha(path) == entry['sha256'], entry['path']


def restore_frontend():
    if not (RELEASE / 'student-web-before').exists():
        return
    run('systemctl', 'stop', 'systemedu-student-web')
    if WEB.exists():
        WEB.rename(RELEASE / 'student-web-failed')
    (RELEASE / 'student-web-before').rename(WEB)
    run('systemctl', 'start', 'systemedu-student-web')
    health('http://127.0.0.1:4000/')


action = sys.argv[1]
RELEASE.mkdir(mode=0o700, parents=True, exist_ok=True)
expected = json.loads((UP / 'request.json').read_text())
if action == 'stage':
    assert not (RELEASE / 'stage.ok').exists()
    assert not (LIBRARY / 'media/projects' / SLUG).exists(), 'Refusing to overwrite an existing course'
    assert shutil.disk_usage(ROOT).free > 3_000_000_000
    before = hashes(WEB)
    save('web-before.json', before)
    save('backend-before.json', hashes(ROOT / 'packages/student-app'))
    save('baseline.json', {'build': (WEB / '.next/BUILD_ID').read_text().strip()})
    save('projects-before.json', public_projects())
    shutil.copytree(WEB, CANDIDATE, ignore=shutil.ignore_patterns('node_modules', '.next', 'public', 'tsconfig.tsbuildinfo'))
    for name in ['public', 'node_modules']:
        run('cp', '-al', str(WEB / name), str(CANDIDATE / name))
    with tarfile.open(UP / 'frontend.tar.gz') as archive:
        assert set(archive.getnames()) == set(expected['files'])
        assert all(m.isfile() and m.name.startswith('packages/student-web/src/') and '..' not in Path(m.name).parts for m in archive.getmembers())
        for rel in expected['files']:
            assert not (ROOT / rel).exists(), f'Expected a new course-specific file: {rel}'
        archive.extractall(RELEASE, filter='data')
    for rel, digest in expected['files'].items():
        assert sha(RELEASE / rel) == digest
    reader = CANDIDATE / 'src/components/learning/course-content-view.tsx'
    source = reader.read_text()
    assert 'export function CourseReadingBody' not in source
    marker = re.search(r'(?m)^(?:export )?function PlanWithIdeas\(', source)
    assert marker
    wrapper = '''export function CourseReadingBody({ content, projectName, moduleId, knowledgeLevel = "K1" }: {
  content: CourseContent; projectName: string; moduleId: string; knowledgeLevel?: import("@/lib/types/api").KnowledgeLevel
}) {
  return <KnowledgeLevelContext.Provider value={knowledgeLevel}>
    <CourseIdentityContext.Provider value={{ projectName, moduleId, knodeId: 0 }}>
      <AudioProvider><PlanWithIdeas content={content} /></AudioProvider>
    </CourseIdentityContext.Provider>
  </KnowledgeLevelContext.Provider>
}

'''
    reader.write_text(source[:marker.start()] + wrapper + source[marker.start():])
    lines = CANDIDATE / 'src/lib/project-lines/lines.json'
    data = json.loads(lines.read_text())
    energy = next(line for line in data if line['id'] == 'energy-motion')
    assert SLUG not in energy['courseSlugs']
    energy['courseSlugs'].append(SLUG)
    lines.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    after = hashes(CANDIDATE)
    changed = {name for name in before.keys() | after.keys() if before.get(name) != after.get(name)}
    assert changed == {p.removeprefix('packages/student-web/') for p in expected['files']} | {'src/components/learning/course-content-view.tsx', 'src/lib/project-lines/lines.json'}
    save('web-expected.json', after)
    save('changed-files.json', {name: after[name] for name in sorted(changed)})
    archive_path = UP / f'{SLUG}.tar.gz'
    assert sha(archive_path) == expected['course_sha256']
    with tarfile.open(archive_path) as archive:
        assert all(member.isfile() and member.name.startswith(SLUG + '/') and '..' not in Path(member.name).parts for member in archive.getmembers())
        archive.extractall(RELEASE / 'course', filter='data')
    manifest = json.loads((RELEASE / 'course' / SLUG / 'manifest.json').read_text())
    verify_course(RELEASE / 'course' / SLUG, manifest)
    assert not any(item['path'].startswith('audit/') for item in manifest['files'])
    save('request.json', expected)
    (RELEASE / 'stage.ok').touch()
    print(json.dumps({'staged_frontend_files': len(changed), 'course_files': len(manifest['files']), 'nodes': 58, 'production_unchanged': True}))
elif action == 'build':
    assert (RELEASE / 'stage.ok').exists()
    baseline()
    env = {**os.environ, 'NEXT_PUBLIC_STUDENT_API_URL': '', 'NEXT_PUBLIC_GATEWAY_URL': ''}
    with (RELEASE / 'build.log').open('w') as log:
        result = subprocess.run(['npm', 'run', 'build'], cwd=CANDIDATE, env=env, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        # Compiler diagnostics only; no credentials or business logs.
        print((RELEASE / 'build.log').read_text()[-6500:])
        raise SystemExit(result.returncode)
    baseline()
    (RELEASE / 'build.ok').touch()
    print('Candidate build:', (CANDIDATE / '.next/BUILD_ID').read_text().strip())
elif action == 'preview':
    assert (RELEASE / 'build.ok').exists()
    run('systemd-run', '--unit=' + PREVIEW, '--property=WorkingDirectory=' + str(CANDIDATE), '/usr/bin/node', str(CANDIDATE / 'node_modules/next/dist/bin/next'), 'start', '-p', '14000', '-H', '127.0.0.1')
    health('http://127.0.0.1:14000/library')
    print('Candidate preview: server loopback 14000')
elif action == 'publish':
    assert (RELEASE / 'build.ok').exists() and not (RELEASE / 'switch-started.ok').exists()
    verification = json.loads((UP / 'browser-verified.json').read_text())
    assert verification['passed'] and verification['build'] == (CANDIDATE / '.next/BUILD_ID').read_text().strip()
    baseline()
    assert not (LIBRARY / 'media/projects' / SLUG).exists(), 'Course appeared after staging'
    assert public_projects() == read('projects-before.json'), 'Course catalog changed after staging'
    assert hashes(CANDIDATE) == read('web-expected.json')
    with sqlite3.connect(LIBRARY / 'db.sqlite') as src, sqlite3.connect(RELEASE / 'library-before.sqlite') as dst:
        src.backup(dst)
    token = admin_token()
    boundary = 'pvlib-release-20260929-boundary'
    payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{SLUG}.tar.gz"\r\nContent-Type: application/gzip\r\n\r\n'.encode()
               + (UP / f'{SLUG}.tar.gz').read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
    imported = json.loads(request(BASE + '/admin/projects/import', payload, token, f'multipart/form-data; boundary={boundary}'))
    assert imported['slug'] == SLUG
    (RELEASE / 'imported.ok').touch()
    shutil.copytree(WEB / '.next/static', CANDIDATE / '.next/static', dirs_exist_ok=True)
    run('systemctl', 'stop', PREVIEW, 'systemedu-student-web')
    (RELEASE / 'switch-started.ok').touch()
    try:
        WEB.rename(RELEASE / 'student-web-before')
        CANDIDATE.rename(WEB)
        run('systemctl', 'start', 'systemedu-student-web')
        health('http://127.0.0.1:4000/library')
        request(BASE + f'/admin/projects/{SLUG}/publish', b'', token)
        health(f'http://127.0.0.1:18820/api/library/projects/{SLUG}')
        health('http://127.0.0.1:18820/api/health')
    except Exception:
        request(BASE + f'/admin/projects/{SLUG}/unpublish', b'', token)
        restore_frontend()
        (RELEASE / 'rolled-back.ok').touch()
        raise
    (RELEASE / 'live.ok').touch()
    print('Published:', SLUG, 'build', (WEB / '.next/BUILD_ID').read_text().strip())
elif action == 'verify':
    assert (RELEASE / 'live.ok').exists() and not (RELEASE / 'rolled-back.ok').exists()
    for rel, digest in read('changed-files.json').items():
        assert sha(WEB / rel) == digest
    assert hashes(ROOT / 'packages/student-app') == read('backend-before.json')
    current = public_projects()
    assert [p for p in current if p['slug'] != SLUG] == read('projects-before.json')
    project = next(p for p in current if p['slug'] == SLUG)
    assert project['knode_count'] == 58 and project['cover_image_path']
    root = LIBRARY / 'media/projects' / SLUG
    manifest = json.loads((root / 'manifest.json').read_text())
    verify_course(root, manifest)
    archive_sha = (read('blueprint-correction.json')['course_sha256']
                   if (RELEASE / 'blueprint-correction.json').exists() else expected['course_sha256'])
    assert sha(root / '_archive' / f'{SLUG}-1.0.0.tar.gz') == archive_sha
    for suffix in ['/knodes/M01', '/files/downloads/pvlib-practice-kit.zip']:
        try:
            request(f'http://127.0.0.1:18820/api/library/projects/{SLUG}' + suffix)
            raise AssertionError('Unauthenticated course access accepted')
        except urllib.error.HTTPError as error:
            assert error.code == 401
    for service in ['systemedu-student-web', 'systemedu-student-backend', 'systemedu-library']:
        assert subprocess.check_output(['systemctl', 'is-active', service], text=True).strip() == 'active'
    save('verified.json', {'passed': True, 'nodes': 58, 'files': len(manifest['files']), 'build': (WEB / '.next/BUILD_ID').read_text().strip(), 'other_courses_unchanged': True, 'backend_unchanged': True, 'anonymous_content_blocked': True})
    print(json.dumps(read('verified.json')))
elif action == 'rollback':
    assert (RELEASE / 'live.ok').exists() and not (RELEASE / 'rolled-back.ok').exists()
    for rel, digest in read('changed-files.json').items():
        assert sha(WEB / rel) == digest, 'Later release detected'
    request(BASE + f'/admin/projects/{SLUG}/unpublish', b'', admin_token())
    restore_frontend()
    (RELEASE / 'rolled-back.ok').touch()
    print('Restored previous frontend; only pvlib unpublished. Student records retained.')
elif action == 'summary':
    print(json.dumps({'build': ((WEB if (RELEASE / 'live.ok').exists() else CANDIDATE) / '.next/BUILD_ID').read_text().strip(), 'staged': (RELEASE / 'stage.ok').exists(), 'live': (RELEASE / 'live.ok').exists(), 'changed': read('changed-files.json')}))
else:
    raise SystemExit('stage | build | preview | publish | verify | rollback | summary')
