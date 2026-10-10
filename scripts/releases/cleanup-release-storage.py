"""Explicit, audited deletion of superseded deployment payloads only.

Retain every root-level database backup and all numbering/latest rollback files.
Never follow symlinks, chmod shared inodes, stop services, or touch live data.
"""
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tarfile
from collections import Counter
from pathlib import Path

ROOT = Path('/opt/systemedu/releases')
PLAN = Path('/tmp/systemedu-release-cleanup-20260914-plan.json')
RESULT = Path('/tmp/systemedu-release-cleanup-20260914-result.json')
OLD = ['slides-20260908', 'm81-evidence-20260908', 'lesson-reader-20260909',
       'slide-layout-20260909', 'm87-m89-evidence-20260909', 'm38-m90-evidence-20260909',
       'm01-evidence-20260910', 'm0203-evidence-20260910', 'm0405-evidence-20260911',
       'm06-evidence-20260911', 'm23-evidence-20260911', 'm08-variable-20260914']
NAMES = ['student-web-before', 'course', 'course-before',
         'molecule-monster-hunter.tar.gz', 'course-before.tar.gz', 'previous-upload.tar.gz']
PROTECTED = [Path('/opt/systemedu/packages/student-web'),
             Path('/root/.systemedu-library/media'),
             ROOT/'numbering-v2-20260914', ROOT/'readonly-20260914']

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()

def inventory(paths):
    rows = []
    for root in paths:
        rows.append(root)
        if root.is_dir():
            for current, dirs, files in os.walk(root, followlinks=False):
                # Next's runtime cache can legitimately change during checks.
                if Path(current).name == '.next':
                    dirs[:] = [d for d in dirs if d != 'cache']
                rows.extend(Path(current)/n for n in dirs+files)
    h = hashlib.sha256(); inodes = {}; counts = Counter()
    for p in sorted(rows):
        s = p.lstat()
        # Directory nlink/mtime and file nlink change when old hardlinks are removed.
        signature = (str(p), s.st_dev, s.st_ino, s.st_mode,
                     s.st_size if not stat.S_ISDIR(s.st_mode) else None,
                     s.st_mtime_ns if not stat.S_ISDIR(s.st_mode) else None,
                     os.readlink(p) if p.is_symlink() else None)
        h.update(json.dumps(signature).encode())
        if stat.S_ISREG(s.st_mode):
            key = (s.st_dev, s.st_ino)
            counts[key] += 1
            inodes[key] = (s.st_blocks*512, s.st_nlink)
    reclaim = sum(size for key,(size,nlink) in inodes.items() if counts[key] == nlink)
    shared = sum(1 for key,(_,nlink) in inodes.items() if counts[key] < nlink)
    return {'digest':h.hexdigest(), 'paths':len(rows), 'reclaimable_file_bytes':reclaim, 'shared_inodes_preserved':shared}

def assert_no_process_or_mount_references(targets):
    prefixes = [str(p)+'/' for p in targets]
    exact = {str(p) for p in targets}
    for line in Path('/proc/self/mountinfo').read_text().splitlines():
        mount = line.split()[4]
        assert not any(mount == str(p) or mount.startswith(str(p)+'/') for p in targets), mount
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit(): continue
        links = [proc/'cwd',proc/'exe',proc/'root']
        try: links += list((proc/'fd').iterdir())
        except OSError: pass
        for link in links:
            try: value = os.readlink(link)
            except OSError: continue
            assert value not in exact and not any(value.startswith(p) for p in prefixes), (str(link), value)
        try:
            lines = (proc/'maps').read_text().splitlines()
        except OSError: continue
        for line in lines:
            assert not any(p in line for p in prefixes), ('mmap', proc.name)

def targets_and_evidence():
    targets = []; evidence = []
    for release in OLD:
        parent = ROOT/release
        assert parent.is_dir() and not parent.is_symlink()
        for name in NAMES:
            p = parent/name
            if not p.exists(): continue
            assert not p.is_symlink() and p.resolve() == p
            if name == 'student-web-before':
                assert (p/'package.json').is_file() and (p/'src').is_dir()
                proof = {'kind':'superseded frontend source/build/dependencies', 'package':json.loads((p/'package.json').read_text()).get('name')}
            elif name in ['course', 'course-before']:
                course = p if (p/'manifest.json').is_file() else p/'molecule-monster-hunter'
                assert (course/'manifest.json').is_file() and (course/'knodes').is_dir()
                if course != p:
                    assert {x.name for x in p.iterdir()} == {'molecule-monster-hunter'}
                manifest = json.loads((course/'manifest.json').read_text())
                assert not any(Path(f['path']).suffix in {'.sqlite','.db','.dump','.sql'} for f in manifest['files'])
                proof = {'kind':'historical published/staged curriculum copy', 'manifest_files':len(manifest['files'])}
            else:
                assert p.is_file()
                with tarfile.open(p) as tar:
                    members = tar.getmembers()
                    assert members
                    roots = {Path(m.name).parts[0] for m in members if Path(m.name).parts}
                    assert roots <= {'molecule-monster-hunter'}, roots
                    assert all('..' not in Path(m.name).parts and not m.name.startswith('/') for m in members)
                    assert not any(Path(m.name).suffix in {'.sqlite','.db','.dump','.sql'} for m in members)
                    assert any(m.name == 'molecule-monster-hunter/manifest.json' for m in members)
                    proof = {'kind':'historical curriculum release archive', 'members':len(members)}
            targets.append(p)
            evidence.append({'path':str(p), **proof})
            print('Checked '+str(p), flush=True)
    return targets, evidence

action = sys.argv[1]
assert action in {'audit','apply'}
assert (PROTECTED[0]/'.next/BUILD_ID').read_text().strip() == 'ZfGjTkWmIZmJ4F16Si-91'
assert (ROOT/'readonly-20260914/resumed.ok').exists()
targets, evidence = targets_and_evidence()
assert targets and all(p.parent.name in OLD and p.name in NAMES for p in targets)
assert_no_process_or_mount_references(targets)
plan = {'targets':evidence, 'inventory':inventory(targets)}
if action == 'audit':
    assert not PLAN.exists(), 'Existing audit must not be overwritten'
    PLAN.write_text(json.dumps(plan, ensure_ascii=False, indent=2)+'\n')
    PLAN.chmod(0o600)
    print(json.dumps(plan, ensure_ascii=False))
else:
    assert not RESULT.exists()
    assert plan == json.loads(PLAN.read_text()), 'Candidate changed since audit'
    assert getattr(shutil.rmtree, 'avoids_symlink_attacks', False)
    before = inventory(PROTECTED)
    databases = {str(p):sha(p) for p in ROOT.glob('*/library-before.sqlite')}
    databases.update({str(p):sha(p) for p in (ROOT/'numbering-v2-20260914').glob('*.dump')})
    live_db_paths = [Path('/root/.systemedu-library/db.sqlite'),Path('/opt/systemedu/.data/pg'),Path('/opt/systemedu/.data/redis')]
    live_identity = {str(p):(p.stat().st_dev,p.stat().st_ino) for p in live_db_paths}
    free_before = shutil.disk_usage(ROOT).free
    removed = []
    for p in targets:
        assert p.resolve() == p and p.parent.name in OLD and p.name in NAMES
        if p.is_dir(): shutil.rmtree(p)
        else: p.unlink()
        removed.append(str(p))
        RESULT.write_text(json.dumps({'status':'in-progress','removed':removed},indent=2)+'\n')
        RESULT.chmod(0o600)
        print('Removed '+str(p), flush=True)
    after = inventory(PROTECTED)
    assert before['digest'] == after['digest'], 'Protected tree changed'
    assert all(sha(Path(p)) == digest for p,digest in databases.items()), 'Database backup changed'
    assert all((Path(p).stat().st_dev,Path(p).stat().st_ino) == ident for p,ident in live_identity.items()), 'Live data path identity changed'
    result = {'status':'verified', 'removed':removed, 'free_before':free_before,
              'free_after':shutil.disk_usage(ROOT).free, 'protected_tree_paths':before['paths'],
              'protected_trees_unchanged':True, 'database_backups_unchanged':len(databases),
              'live_data_paths_untouched':True, 'inventory':plan['inventory']}
    RESULT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))
