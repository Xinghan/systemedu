"""以生产前端为基线发布动力发明家；保留其他课程、后端及学生数据。"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
from pathlib import Path

ROOT = Path('/opt/systemedu')
WEB = 'packages/student-web'
UP = Path('/tmp/energy-project-lines-20260922')
RELEASE = ROOT / 'releases/energy-project-lines-20260922'
PREVIEW = 'systemedu-energy-preview-web'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def hashes(root):
    return {str(p.relative_to(root)): sha(p) for p in root.rglob('*')
            if p.is_file() and not any(part in p.parts for part in ['node_modules', '.next', '__pycache__'])
            and p.name != 'tsconfig.tsbuildinfo'}


def health(url):
    for _ in range(30):
        try:
            with urllib.request.urlopen(url, timeout=4) as response:
                if response.status == 200:
                    return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('健康检查失败: ' + url)


def check_baseline(expected):
    assert (ROOT / WEB / '.next/BUILD_ID').read_text().strip() == expected['expected_build']
    for rel, digest in expected['baseline'].items():
        path = ROOT / rel
        assert (sha(path) if path.exists() else None) == digest, rel


action = sys.argv[1]
if action == 'inspect':
    request = json.loads((UP / 'request.json').read_text())
    files = request['files']
    assert all(p.startswith(WEB + '/') and '..' not in Path(p).parts for p in files)
    manifest = {'build': (ROOT / WEB / '.next/BUILD_ID').read_text().strip(), 'files': {}}
    with tarfile.open(UP / 'production.tar.gz', 'w:gz') as archive:
        for rel in files:
            path = ROOT / rel
            manifest['files'][rel] = sha(path) if path.exists() else None
            if path.exists():
                archive.add(path, arcname=rel)
    save(UP / 'baseline.json', manifest)
    print('生产基线:', manifest['build'], '核对文件:', len(files))
    raise SystemExit(0)

expected = json.loads((UP / 'expected.json').read_text())
RELEASE.mkdir(mode=0o700, exist_ok=True)
candidate = RELEASE / WEB
if action == 'stage':
    assert not (RELEASE / 'stage.ok').exists()
    check_baseline(expected)
    assert shutil.disk_usage(RELEASE).free > 3_000_000_000
    before = hashes(ROOT / WEB)
    save(RELEASE / 'web-before.json', before)
    save(RELEASE / 'backend-before.json', hashes(ROOT / 'packages/student-app'))
    shutil.copytree(ROOT / WEB, candidate, ignore=shutil.ignore_patterns('node_modules', '.next', 'public', 'tsconfig.tsbuildinfo'))
    for name in ['public', 'node_modules']:
        run('cp', '-al', str(ROOT / WEB / name), str(candidate / name))
    with tarfile.open(UP / 'delta.tar.gz') as archive:
        assert set(archive.getnames()) == set(expected['files'])
        assert all(m.isfile() and m.name.startswith(WEB + '/') and '..' not in Path(m.name).parts for m in archive.getmembers())
        for rel in expected['files']:
            destination = RELEASE / rel
            if destination.exists():
                destination.unlink()
        archive.extractall(RELEASE)
    for rel, digest in expected['files'].items():
        assert sha(RELEASE / rel) == digest, rel
    after = hashes(candidate)
    changed = {WEB + '/' + p for p in before.keys() | after.keys() if before.get(p) != after.get(p)}
    assert changed == set(expected['files']), changed
    save(RELEASE / 'web-expected.json', after)
    save(RELEASE / 'expected.json', expected)
    (RELEASE / 'stage.ok').touch()
    print('隔离暂存完成:', len(changed), '个文件；未修改线上源码。')
elif action == 'refresh':
    assert (RELEASE / 'stage.ok').exists() and not (RELEASE / 'switch-started.ok').exists()
    old = json.loads((RELEASE / 'expected.json').read_text())
    rel = WEB + '/src/components/library/discovery-project-card.tsx'
    changed = {p for p in old['files'].keys() | expected['files'].keys()
               if old['files'].get(p) != expected['files'].get(p)}
    assert changed == {rel} and old['baseline'] == expected['baseline']
    assert sha(RELEASE / rel) == old['files'][rel]
    assert sha(UP / 'discovery-project-card.tsx') == expected['files'][rel]
    check_baseline(expected)
    run('systemctl', 'stop', PREVIEW)
    shutil.copy2(UP / 'discovery-project-card.tsx', RELEASE / rel)
    save(RELEASE / 'web-expected.json', hashes(candidate))
    save(RELEASE / 'expected.json', expected)
    (RELEASE / 'build.ok').unlink(missing_ok=True)
    print('候选封面组件已启用响应式压缩；须重新构建和验证。')
elif action == 'build':
    assert (RELEASE / 'stage.ok').exists() and not (RELEASE / 'build.ok').exists()
    env = {**os.environ, 'NEXT_PUBLIC_STUDENT_API_URL': '', 'NEXT_PUBLIC_GATEWAY_URL': ''}
    with (RELEASE / 'build.log').open('w') as log:
        run('npm', 'run', 'build', cwd=candidate, env=env, stdout=log, stderr=subprocess.STDOUT)
    assert (candidate / '.next/BUILD_ID').is_file()
    check_baseline(expected)
    (RELEASE / 'build.ok').touch()
    print('隔离构建通过:', (candidate / '.next/BUILD_ID').read_text().strip())
elif action == 'preview':
    assert (RELEASE / 'build.ok').exists()
    run('systemd-run', '--unit=' + PREVIEW, '--property=WorkingDirectory=' + str(candidate),
        '/usr/bin/node', str(candidate / 'node_modules/next/dist/bin/next'), 'start', '-p', '14000', '-H', '127.0.0.1')
    health('http://127.0.0.1:14000/library?view=lines&line=energy-motion')
    print('预览服务仅监听服务器 127.0.0.1:14000。')
elif action == 'publish':
    assert (RELEASE / 'build.ok').exists() and not (RELEASE / 'switch-started.ok').exists()
    verified = json.loads((UP / 'preview-verified.json').read_text())
    assert verified['passed'] and verified['files'] == expected['files']
    assert verified['build'] == (candidate / '.next/BUILD_ID').read_text().strip()
    check_baseline(expected)
    assert hashes(ROOT / WEB) == json.loads((RELEASE / 'web-before.json').read_text())
    assert hashes(candidate) == json.loads((RELEASE / 'web-expected.json').read_text())
    assert hashes(ROOT / 'packages/student-app') == json.loads((RELEASE / 'backend-before.json').read_text())
    shutil.copytree(ROOT / WEB / '.next/static', candidate / '.next/static', dirs_exist_ok=True)
    shutil.copy2(UP / 'preview-verified.json', RELEASE / 'preview-verified.json')
    run('systemctl', 'stop', PREVIEW, 'systemedu-student-web')
    (RELEASE / 'switch-started.ok').touch()
    try:
        (ROOT / WEB).rename(RELEASE / 'student-web-before')
        candidate.rename(ROOT / WEB)
        run('systemctl', 'start', 'systemedu-student-web')
        health('http://127.0.0.1:4000/library?view=lines&line=energy-motion')
        health('http://127.0.0.1:18820/api/health')
        for rel, digest in expected['files'].items():
            assert sha(ROOT / rel) == digest, rel
    except Exception:
        run('systemctl', 'stop', 'systemedu-student-web')
        if (RELEASE / 'student-web-before').exists():
            if (ROOT / WEB).exists():
                (ROOT / WEB).rename(RELEASE / 'student-web-failed')
            (RELEASE / 'student-web-before').rename(ROOT / WEB)
        run('systemctl', 'start', 'systemedu-student-web')
        (RELEASE / 'rolled-back.ok').touch()
        raise
    (RELEASE / 'live.ok').touch()
    print('正式发布:', (ROOT / WEB / '.next/BUILD_ID').read_text().strip())
elif action == 'rollback':
    assert (RELEASE / 'live.ok').exists() and (RELEASE / 'student-web-before').exists()
    assert not (RELEASE / 'rolled-back.ok').exists()
    for rel, digest in expected['files'].items():
        assert sha(ROOT / rel) == digest, rel
    run('systemctl', 'stop', 'systemedu-student-web')
    (ROOT / WEB).rename(RELEASE / 'student-web-failed')
    (RELEASE / 'student-web-before').rename(ROOT / WEB)
    run('systemctl', 'start', 'systemedu-student-web')
    health('http://127.0.0.1:4000/')
    (RELEASE / 'rolled-back.ok').touch()
    print('已恢复上一前端；未操作数据库。')
elif action == 'finish':
    assert (RELEASE / 'live.ok').exists() and not (RELEASE / 'rolled-back.ok').exists()
    health('http://127.0.0.1:4000/library?view=lines&line=energy-motion')
    health('http://127.0.0.1:18820/api/health')
    assert hashes(ROOT / 'packages/student-app') == json.loads((RELEASE / 'backend-before.json').read_text())
    (RELEASE / 'finished.ok').touch()
    print('发布完成，旧前端备份与验证记录已保留。')
else:
    raise SystemExit('inspect | stage | refresh | build | preview | publish | rollback | finish')
