"""Package only the reviewed pvlib lesson files and the required UI adapters."""
import hashlib
import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parent / 'systemeduidea/projects_data/pvlib-solar-forecast-station'
OUT = Path('/private/tmp/pvlib-release-20260929')
OUT.mkdir(parents=True, exist_ok=True)
SLUG = SOURCE.name
manifest = json.loads((SOURCE / 'manifest.json').read_text())
allowed = ('knodes/', 'practice/', 'downloads/', 'blueprint/', 'tree/')
files = [item for item in manifest['files'] if item['path'].startswith(allowed) or item['path'] == manifest['cover_image_path']]
assert len(manifest['knodes']) == 58 and manifest['version'] == '1.0.0'
assert len({item['path'] for item in files}) == len(files)
for item in files:
    relative = Path(item['path'])
    assert not relative.is_absolute() and '..' not in relative.parts
    data = (SOURCE / relative).read_bytes()
    assert len(data) == item['size'] and hashlib.sha256(data).hexdigest() == item['sha256'], relative
manifest['files'] = files
manifest['total_size_bytes'] = sum(item['size'] for item in files)
package_manifest = OUT / 'manifest.json'
package_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
archive_path = OUT / f'{SLUG}.tar.gz'
with tarfile.open(archive_path, 'w:gz') as archive:
    archive.add(package_manifest, arcname=f'{SLUG}/manifest.json')
    for item in files:
        archive.add(SOURCE / item['path'], arcname=f'{SLUG}/{item["path"]}')
web = 'packages/student-web/'
frontend = [web + path for path in [
    'src/components/learning/pvlib-course-preview.tsx',
    'src/components/learning/pvlib-course-preview.module.css',
    'src/components/learning/pvlib-published-lesson.tsx',
    'src/lib/pvlib-preview.ts',
    'src/app/(learn)/learn/pvlib-solar-forecast-station/[moduleId]/page.tsx',
]]
with tarfile.open(OUT / 'frontend.tar.gz', 'w:gz') as archive:
    for path in frontend:
        archive.add(ROOT / path, arcname=path)
request = {
    'slug': SLUG, 'course_sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
    'course_files': len(files), 'course_bytes': manifest['total_size_bytes'],
    'files': {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in frontend},
}
(OUT / 'request.json').write_text(json.dumps(request, indent=2) + '\n')
print(json.dumps({'course_files': len(files), 'compressed_bytes': archive_path.stat().st_size, 'frontend_files': len(frontend), 'course_sha256': request['course_sha256']}))
