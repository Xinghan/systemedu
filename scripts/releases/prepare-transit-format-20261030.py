"""Export the committed integration delta; refuse to overwrite production drift."""
import hashlib
import io
import json
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('/private/tmp/systemedu-transit-format-20261030')
BASE_REF = '7cc73d9b5a0de99fb9cde17312004166c2a20d83'
PREFIX = 'packages/student-web/'
base = json.loads((OUT / 'production-baseline.json').read_text())

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

ref = git('rev-parse', 'HEAD').decode().strip()
changed = git('diff', '--name-status', BASE_REF, ref, '--', PREFIX).decode().splitlines()
files = {}
with tarfile.open(OUT / 'frontend.tar.gz', 'w:gz') as archive:
    for change in changed:
        status, name = change.split('\t')
        assert status in ('A', 'M'), f'Unsupported change: {change}'
        relative = name.removeprefix(PREFIX)
        assert relative.startswith(('src/', 'public/'))
        data = git('show', f'{ref}:{name}')
        digest = hashlib.sha256(data).hexdigest()
        if status == 'M':
            previous = hashlib.sha256(git('show', f'{BASE_REF}:{name}')).hexdigest()
            assert base['files'].get(relative) == previous, f'Production drift: {relative}'
        else:
            assert relative not in base['files'], f'Already exists on production: {relative}'
        info = tarfile.TarInfo(relative)
        info.size = len(data)
        info.mode = 0o644
        archive.addfile(info, io.BytesIO(data))
        files[relative] = digest
assert files, 'No frontend changes'
request = {'source_commit': ref, 'base_commit': BASE_REF, 'baseline_build': base['build'],
           'config_files': [], 'files': files,
           'archive_sha256': hashlib.sha256((OUT / 'frontend.tar.gz').read_bytes()).hexdigest()}
(OUT / 'request.json').write_text(json.dumps(request, indent=2) + '\n')
print(json.dumps({'source_commit': ref, 'files': len(files), 'production_drift': False}))
