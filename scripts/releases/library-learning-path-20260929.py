"""Apply committed learning-path and loading fixes onto the deployed frontend, validate and switch.

Production source, course bytes and rollback backups stay on the server. No
backend, database, content import or student record mutation is performed.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request

ROOT = Path('/opt/systemedu')
WEB = ROOT / 'packages/student-web'
COURSE = Path('/root/.systemedu-library/media/projects/pvlib-solar-forecast-station')
UP = Path('/tmp/library-learning-path-20260929')
RELEASE = ROOT / 'releases/library-learning-path-20260929'
CANDIDATE = RELEASE / 'packages/student-web'
PREVIEW = 'systemedu-learning-path-preview-web'
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def hashes(root):
    result = {}
    for directory, names, files in os.walk(root):
        names[:] = [n for n in names if n not in ['node_modules', '.next', '__pycache__']]
        for name in files:
            if name != 'tsconfig.tsbuildinfo':
                p = Path(directory) / name
                result[str(p.relative_to(root))] = sha(p)
    return result


def save(name, data):
    (RELEASE / name).write_text(json.dumps(data, indent=2) + '\n')


def read(name):
    return json.loads((RELEASE / name).read_text())


def request(url):
    with opener.open(url, timeout=30) as response:
        return response.read()


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def data_unchanged():
    assert hashes(ROOT / 'packages/student-app') == read('backend-before.json')
    assert hashes(COURSE) == read('course-before.json')
    assert json.loads(request('http://127.0.0.1:18820/api/library/projects')) == read('catalog-before.json')


def baseline():
    assert (WEB / '.next/BUILD_ID').read_text().strip() == read('baseline.json')['build']
    assert hashes(WEB) == read('web-before.json'), 'Concurrent frontend change detected'
    data_unchanged()


def health(port):
    for _ in range(30):
        try:
            request(f'http://127.0.0.1:{port}/library')
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError('Frontend health check failed')


def restore():
    run('systemctl', 'stop', 'systemedu-student-web')
    if WEB.exists():
        WEB.rename(RELEASE / 'student-web-failed')
    (RELEASE / 'student-web-before').rename(WEB)
    run('systemctl', 'start', 'systemedu-student-web')
    health(4000)
    (RELEASE / 'rolled-back.ok').touch()


action = sys.argv[1]
RELEASE.mkdir(parents=True, exist_ok=True, mode=0o700)
expected = json.loads((UP / 'request.json').read_text())
if action in ['stage', 'resume-stage']:
    if action == 'stage':
        assert not CANDIDATE.exists()
        assert shutil.disk_usage(ROOT).free > 2_000_000_000
        save('baseline.json', {'build': (WEB / '.next/BUILD_ID').read_text().strip(), 'source_commit': expected['source_commit']})
        before = hashes(WEB)
        save('web-before.json', before)
        save('backend-before.json', hashes(ROOT / 'packages/student-app'))
        save('course-before.json', hashes(COURSE))
        save('catalog-before.json', json.loads(request('http://127.0.0.1:18820/api/library/projects')))
        assert read('course-before.json'), 'Missing existing course'
        shutil.copytree(WEB, CANDIDATE, ignore=shutil.ignore_patterns('node_modules', '.next', 'public', 'tsconfig.tsbuildinfo'))
        for name in ['public', 'node_modules']:
            run('cp', '-al', str(WEB / name), str(CANDIDATE / name))
    else:
        # Only resume the untouched candidate that stopped at the first file.
        assert not (RELEASE / 'stage.ok').exists()
        baseline()
        before = read('web-before.json')
        assert hashes(CANDIDATE) == before
    assert sha(UP / 'frontend.tar.gz') == expected['archive_sha256']
    bundle = RELEASE / 'committed-input'
    with tarfile.open(UP / 'frontend.tar.gz') as archive:
        allowed = {f'new/{p}' for p in expected['files']} | {f'base/{p}' for p, v in expected['files'].items() if v['base_sha256']}
        assert set(archive.getnames()) == allowed
        for member in archive.getmembers():
            assert member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts
        archive.extractall(bundle, filter='data')
    merged = []
    for p, value in expected['files'].items():
        assert p.startswith(('packages/student-web/src/', 'packages/student-web/public/library/learning-path/'))
        current = RELEASE / p
        new = bundle / 'new' / p
        assert sha(new) == value['new_sha256']
        if value['base_sha256'] is None:
            assert not current.exists(), p
            current.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(new, current)
        else:
            base = bundle / 'base' / p
            assert sha(base) == value['base_sha256']
            result = subprocess.run(['git', 'merge-file', '-p', str(current), str(base), str(new)], capture_output=True)
            if result.returncode:
                (RELEASE / ('conflict-' + Path(p).name)).write_bytes(result.stdout)
                raise RuntimeError('Merge conflict in ' + p + '; production unchanged')
            current.write_bytes(result.stdout)
            if sha(current) != value['new_sha256']:
                merged.append(p)
    after = hashes(CANDIDATE)
    changed = {p for p in before.keys() | after.keys() if before.get(p) != after.get(p)}
    assert changed == {p.removeprefix('packages/student-web/') for p in expected['files']}
    save('web-expected.json', after)
    save('changed-files.json', {p: after[p] for p in sorted(changed)})
    baseline()
    (RELEASE / 'stage.ok').touch()
    print(json.dumps({'staged_files': len(changed), 'preserved_production_customizations': merged, 'production_unchanged': True}))
elif action == 'build':
    assert (RELEASE / 'stage.ok').exists()
    baseline()
    with (RELEASE / 'build.log').open('w') as log:
        result = subprocess.run(['npm', 'run', 'build'], cwd=CANDIDATE, env={**os.environ, 'NEXT_PUBLIC_STUDENT_API_URL': '', 'NEXT_PUBLIC_GATEWAY_URL': ''}, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        print((RELEASE / 'build.log').read_text()[-6500:])
        raise SystemExit(result.returncode)
    # The deployed app ignores historical type errors at build time; reject new ones.
    diagnostics = {}
    for name, directory in [('baseline', WEB), ('candidate', CANDIDATE)]:
        check = subprocess.run(['node', 'node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false', '--pretty', 'false'], cwd=directory, capture_output=True, text=True)
        assert check.returncode in (0, 2), check.stderr
        (RELEASE / (name + '-types.log')).write_text(check.stdout)
        diagnostics[name] = set(re.sub(r'\(\d+,\d+\)', '(line)', line) for line in check.stdout.splitlines() if 'error TS' in line)
    new_errors = sorted(diagnostics['candidate'] - diagnostics['baseline'])
    save('type-comparison.json', {'baseline_errors': len(diagnostics['baseline']), 'candidate_errors': len(diagnostics['candidate']), 'new_errors': new_errors})
    assert not new_errors, new_errors
    assert hashes(CANDIDATE) == read('web-expected.json')
    baseline()
    (RELEASE / 'build.ok').touch()
    print(json.dumps({'build': (CANDIDATE / '.next/BUILD_ID').read_text().strip()}))
elif action == 'preview':
    assert (RELEASE / 'build.ok').exists()
    run('systemd-run', '--unit=' + PREVIEW, '--property=WorkingDirectory=' + str(CANDIDATE), '/usr/bin/node', str(CANDIDATE / 'node_modules/next/dist/bin/next'), 'start', '-p', '14003', '-H', '127.0.0.1')
    health(14003)
    print(json.dumps({'preview_port': 14003}))
elif action == 'publish':
    assert (RELEASE / 'build.ok').exists() and not (RELEASE / 'switch-started.ok').exists()
    verification = json.loads((UP / 'browser-verified.json').read_text())
    assert verification['passed'] and len(verification['checks']) == 8 and verification['loadingIndicator']
    assert verification['build'] == (CANDIDATE / '.next/BUILD_ID').read_text().strip()
    baseline()
    assert hashes(CANDIDATE) == read('web-expected.json')
    shutil.copytree(WEB / '.next/static', CANDIDATE / '.next/static', dirs_exist_ok=True)
    run('systemctl', 'stop', PREVIEW, 'systemedu-student-web')
    (RELEASE / 'switch-started.ok').touch()
    try:
        WEB.rename(RELEASE / 'student-web-before')
        CANDIDATE.rename(WEB)
        run('systemctl', 'start', 'systemedu-student-web')
        health(4000)
    except Exception:
        restore()
        raise
    (RELEASE / 'live.ok').touch()
    print(json.dumps({'published': True, 'build': (WEB / '.next/BUILD_ID').read_text().strip()}))
elif action == 'verify':
    assert (RELEASE / 'live.ok').exists() and not (RELEASE / 'rolled-back.ok').exists()
    assert hashes(WEB) == read('web-expected.json')
    data_unchanged()
    for service in ['systemedu-student-web', 'systemedu-student-backend', 'systemedu-library']:
        assert subprocess.check_output(['systemctl', 'is-active', service], text=True).strip() == 'active'
    report = {'passed': True, 'build': (WEB / '.next/BUILD_ID').read_text().strip(), 'source_commit': expected['source_commit'], 'changed_files': len(read('changed-files.json')), 'backend_catalog_and_course_bytes_unchanged': True}
    save('verified.json', report)
    print(json.dumps(report))
elif action == 'rollback':
    assert (RELEASE / 'live.ok').exists() and not (RELEASE / 'rolled-back.ok').exists()
    assert hashes(WEB) == read('web-expected.json'), 'Later frontend changes detected'
    restore()
    print(json.dumps({'rolled_back': True}))
else:
    raise SystemExit('stage | build | preview | publish | verify | rollback')
