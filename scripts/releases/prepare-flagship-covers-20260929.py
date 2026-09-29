"""Package only cover assets/helpers; production source is patched on the server."""
import hashlib
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'packages/student-web'
OUT = Path('/private/tmp/flagship-covers-20260929')
OUT.mkdir(parents=True, exist_ok=True)
files = [WEB / p for p in ['src/lib/project-cover.ts', 'src/lib/project-lines/project-cover-variants.json', 'src/lib/project-lines/flagship-covers.json']]
flagships = json.loads(files[2].read_text())
variants = json.loads(files[1].read_text())
assert set(variants) == set(flagships) | {'pvlib-solar-forecast-station'}
files += [WEB / 'public' / p.lstrip('/') for p in flagships.values()]
files += [WEB / 'public' / v['src'].lstrip('/') for cover in variants.values() for v in cover['variants']]
archive = OUT / 'assets.tar.gz'
with tarfile.open(archive, 'w:gz') as package:
    for p in files:
        package.add(p, arcname=str(p.relative_to(ROOT)))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
request = {'archive_sha256': sha(archive), 'files': {str(p.relative_to(ROOT)): sha(p) for p in files}}
(OUT / 'request.json').write_text(json.dumps(request, indent=2) + '\n')
print(json.dumps({'files': len(files), 'archive_bytes': archive.stat().st_size}))
