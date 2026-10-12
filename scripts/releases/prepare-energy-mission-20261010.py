"""Export committed energy/biomed missions and shared components since the deployed space release. Historical unused biomed v1 plates and films are excluded."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('/private/tmp/energy-mission-20261010')
OUT.mkdir(parents=True, exist_ok=True)
GIT = 'git'
BASE = 'fa2c82af'
REF = subprocess.check_output([GIT, 'rev-parse', '90c1539d5e683f5d4c33cb006cc5f2799e7a26eb'], cwd=ROOT, text=True).strip()
paths = subprocess.check_output([GIT, 'diff', '--name-only', BASE, REF, '--', 'packages/student-web'], cwd=ROOT, text=True).splitlines()
paths = [p for p in paths if p.startswith(('packages/student-web/src/', 'packages/student-web/public/mission/')) and not ('/mission/biomedicine/' in p and ('-v1.' in p or '-v1-' in p) and not p.endswith('campus-map-v1.webp'))]
assert paths and all(p.startswith('packages/student-web/') for p in paths)
# Optional energy support lessons predate the deployed checkpoint and were never shipped.
extra_prefixes = ['packages/student-web/src/components/learning/energy-workspace', 'packages/student-web/src/components/learning/energy-machine-view', 'packages/student-web/src/lib/project-lines/energy-model', 'packages/student-web/src/lib/project-lines/energy-geometry', 'packages/student-web/src/lib/project-lines/energy-guides', 'packages/student-web/src/lib/project-lines/energy-courses'] + ['packages/student-web/public/project-lines/energy-motion/'+name+'/' for name in ['compare-energy-settings','design-a-printed-transmission','build-a-printed-generator','hardware']]
all_paths = subprocess.check_output([GIT,'ls-tree','-r','--name-only',REF],cwd=ROOT,text=True).splitlines()
extras = {p for p in all_paths if any(p.startswith(prefix) for prefix in extra_prefixes)} - set(paths)
base_overrides = {'packages/student-web/src/components/learning/biomed-understanding-check.tsx': 'b20bd498'}
paths = sorted(set(paths) | extras | set(base_overrides))
sha = lambda b: hashlib.sha256(b).hexdigest()
base_paths = set(subprocess.check_output([GIT, 'ls-tree', '-r', '--name-only', BASE], cwd=ROOT, text=True).splitlines())
files = {}
with tarfile.open(OUT / 'frontend.tar.gz', 'w:gz') as archive:
    for p in paths:
        new = subprocess.check_output([GIT, 'show', REF + ':' + p], cwd=ROOT)
        result = subprocess.run([GIT, 'show', base_overrides.get(p, BASE) + ':' + p], cwd=ROOT, capture_output=True)
        base = result.stdout if p in base_paths and p not in extras else None
        files[p] = {'base_sha256': sha(base) if base is not None else None, 'new_sha256': sha(new), 'base_ref': base_overrides.get(p, BASE)}
        for name, data in [('new/' + p, new), ('base/' + p, base)]:
            if data is None:
                continue
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(data))
request = {'source_commit': REF, 'base_commit': BASE, 'files': files, 'archive_sha256': sha((OUT / 'frontend.tar.gz').read_bytes())}
(OUT / 'request.json').write_text(json.dumps(request, indent=2) + '\n')
print(json.dumps({'source_commit': REF, 'frontend_files': len(files), 'archive_bytes': (OUT / 'frontend.tar.gz').stat().st_size}))
