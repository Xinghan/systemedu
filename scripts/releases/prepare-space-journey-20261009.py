"""Export the committed space journey, mission center, map and films; exclude earlier checkpoint work."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('/private/tmp/space-journey-20261009')
OUT.mkdir(parents=True, exist_ok=True)
GIT = '/Users/xinghan/.local/bin/git'
BASE = 'd63b5e89'
REF = subprocess.check_output([GIT, 'rev-parse', 'fa2c82af'], cwd=ROOT, text=True).strip()
paths = subprocess.check_output([GIT, 'diff', '--name-only', BASE, REF, '--', 'packages/student-web'], cwd=ROOT, text=True).splitlines()
assert len(paths) == 71
sha = lambda b: hashlib.sha256(b).hexdigest()
base_paths = set(subprocess.check_output([GIT, 'ls-tree', '-r', '--name-only', BASE], cwd=ROOT, text=True).splitlines())
files = {}
with tarfile.open(OUT / 'frontend.tar.gz', 'w:gz') as archive:
    for p in paths:
        new = subprocess.check_output([GIT, 'show', REF + ':' + p], cwd=ROOT)
        result = subprocess.run([GIT, 'show', BASE + ':' + p], cwd=ROOT, capture_output=True)
        base = result.stdout if p in base_paths else None
        files[p] = {'base_sha256': sha(base) if base is not None else None, 'new_sha256': sha(new)}
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
