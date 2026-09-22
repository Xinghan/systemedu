import hashlib
import json
import subprocess
import sys
import tarfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = Path('/private/tmp/energy-release-20260922')
BASE = '76916521'
TIP = 'a55be4a6'
OUT.mkdir(exist_ok=True)

def git(*args):
    return subprocess.check_output(['git', *args], cwd=REPO)

def sha(data):
    return hashlib.sha256(data).hexdigest()

changes = git('diff', '--name-status', BASE, TIP, '--', 'packages/student-web').decode().splitlines()
files = [line.split('\t')[1] for line in changes if not line.startswith('D\t')]
# 只交付当前实际引用的封面，旧封面在线上继续保留以兼容已打开的页面。
files = [p for p in files if not p.endswith('.png') or p.endswith('cover-engineering-v2.png')]
if sys.argv[1] == 'request':
    (OUT / 'request.json').write_text(json.dumps({'files': files, 'base': BASE, 'tip': TIP}, indent=2))
    print(f'准备核对 {len(files)} 个候选文件。')
elif sys.argv[1] == 'prepare':
    baseline = json.loads((OUT / 'baseline.json').read_text())
    current = OUT / 'production'
    current.mkdir(exist_ok=True)
    with tarfile.open(OUT / 'production.tar.gz') as archive:
        assert all(m.isfile() and m.name in files for m in archive.getmembers())
        archive.extractall(current)
    candidate = OUT / 'candidate'
    merged = []
    expected = {'base_commit': BASE, 'source_commit': TIP, 'expected_build': baseline['build'], 'baseline': baseline['files'], 'files': {}}
    for rel in files:
        new = git('cat-file', 'blob', TIP + ':' + rel)
        old_result = subprocess.run(['git', 'cat-file', 'blob', BASE + ':' + rel], cwd=REPO, capture_output=True)
        old = old_result.stdout if old_result.returncode == 0 else None
        live = (current / rel).read_bytes() if (current / rel).exists() else None
        assert (sha(live) if live is not None else None) == baseline['files'][rel]
        if live == new:
            continue
        if live != old:
            assert live is not None and old is not None and b'\0' not in new, rel
            paths = [OUT / name for name in ['merge-live', 'merge-base', 'merge-new']]
            for path, data in zip(paths, [live, old, new]):
                path.write_bytes(data)
            result = subprocess.run(['git', 'merge-file', '-p', *map(str, paths)], capture_output=True)
            assert result.returncode == 0, f'需要人工处理三方合并: {rel}'
            new = result.stdout
            merged.append(rel)
        target = candidate / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(new)
        expected['files'][rel] = sha(new)
    expected['merged_files'] = merged
    with tarfile.open(OUT / 'delta.tar.gz', 'w:gz') as archive:
        for rel in expected['files']:
            archive.add(candidate / rel, arcname=rel)
    (OUT / 'expected.json').write_text(json.dumps(expected, ensure_ascii=False, indent=2) + '\n')
    scripts = candidate / 'scripts'
    scripts.mkdir(exist_ok=True)
    (scripts / 'verify-renewable-model.cjs').write_bytes(git('show', TIP + ':scripts/verify-renewable-model.cjs'))
    modules = candidate / 'packages/student-web/node_modules'
    if not modules.exists():
        modules.symlink_to(REPO / 'packages/student-web/node_modules', target_is_directory=True)
    print(json.dumps({'changed': len(expected['files']), 'merged': merged, 'archive_bytes': (OUT / 'delta.tar.gz').stat().st_size}, ensure_ascii=False))
