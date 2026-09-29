"""Export only committed classroom fixes; never package the dirty checkout."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('/private/tmp/pvlib-classroom-20260929')
OUT.mkdir(parents=True, exist_ok=True)
GIT = '/Users/xinghan/.local/bin/git'
BASE = '26b6c9e6^'
REF = subprocess.check_output([GIT, 'rev-parse', 'main'], cwd=ROOT, text=True).strip()
paths = subprocess.check_output([GIT, 'diff', '--name-only', BASE, '26b6c9e6', '--', 'packages/student-web'], cwd=ROOT, text=True).splitlines()
assert len(paths) == 7
sha = lambda b: hashlib.sha256(b).hexdigest()
files = {}
with tarfile.open(OUT / 'frontend.tar.gz', 'w:gz') as archive:
    for p in paths:
        new = subprocess.check_output([GIT, 'show', REF + ':' + p], cwd=ROOT)
        result = subprocess.run([GIT, 'show', BASE + ':' + p], cwd=ROOT, capture_output=True)
        base = result.stdout if result.returncode == 0 else None
        files[p] = {'base_sha256': sha(base) if base is not None else None, 'new_sha256': sha(new)}
        for name, data in [('new/' + p, new), ('base/' + p, base)]:
            if data is None:
                continue
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(data))
request = {'source_commit': REF, 'fix_commit': '26b6c9e6', 'files': files, 'archive_sha256': sha((OUT / 'frontend.tar.gz').read_bytes())}
(OUT / 'request.json').write_text(json.dumps(request, indent=2) + '\n')
print(json.dumps({'source_commit': REF, 'frontend_files': len(files), 'archive_bytes': (OUT / 'frontend.tar.gz').stat().st_size}))
