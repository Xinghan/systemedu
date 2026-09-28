"""Correct two public introductions without reimporting or replacing lessons."""
import copy
import hashlib
import io
import json
import os
import shutil
import sqlite3
import tarfile
from pathlib import Path

release = Path('/opt/systemedu/releases/pvlib-20260929')
upload = Path('/tmp/pvlib-release-20260929')
patch = json.loads((upload / 'blueprint-patch.json').read_text())
slug = 'pvlib-solar-forecast-station'
assert patch['slug'] == slug
assert (Path('/opt/systemedu/packages/student-web/.next/BUILD_ID').read_text().strip()
        == patch['build'])
assert set(patch['files']) == {'blueprint/README.md', 'blueprint/README.zh.md'}
assert not (release / 'blueprint-correction.json').exists()
root = Path('/root/.systemedu-library/media/projects') / slug
manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
archive_path = root / '_archive' / f'{slug}-1.0.0.tar.gz'
digest = lambda data: hashlib.sha256(data).hexdigest()
expected = json.loads((upload / 'request.json').read_text())
assert digest(archive_path.read_bytes()) == expected['course_sha256']
old_files = {item['path']: item for item in manifest['files']}
assert len(old_files) == 884
for rel, item in patch['files'].items():
    assert digest((root / rel).read_bytes()) == item['before_sha256'] == old_files[rel]['sha256']
    assert digest(item['content'].encode()) == item['sha256']
    assert len(item['content'].encode()) == item['size']
    assert '不自动部署' not in item['content'] and '尚未完成完整内容' not in item['content']
    assert '尚未完成实物装配' in item['content']


def corrected(value):
    result = copy.deepcopy(value)
    for item in result['files']:
        if item['path'] in patch['files']:
            new = patch['files'][item['path']]
            assert item['sha256'] == new['before_sha256']
            item.update(sha256=new['sha256'], size=new['size'])
    result['total_size_bytes'] = sum(item['size'] for item in result['files'])
    return result


new_manifest = corrected(manifest)
replacements = {rel: item['content'].encode() for rel, item in patch['files'].items()}
replacements['manifest.json'] = (json.dumps(new_manifest, ensure_ascii=False, indent=2) + '\n').encode()
backup = release / 'blueprint-before'
backup.mkdir(mode=0o700, exist_ok=False)
for rel in replacements:
    (backup / rel).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / rel, backup / rel)
shutil.copy2(archive_path, backup / archive_path.name)
next_archive = backup / 'corrected.tar.gz'
with tarfile.open(archive_path) as old, tarfile.open(next_archive, 'w:gz') as new:
    assert set(old.getnames()) == {f'{slug}/{rel}' for rel in old_files} | {f'{slug}/manifest.json'}
    for member in old.getmembers():
        assert member.isfile()
        rel = member.name.removeprefix(slug + '/')
        data = replacements[rel] if rel in replacements else old.extractfile(member).read()
        if rel in old_files and rel not in replacements:
            assert digest(data) == old_files[rel]['sha256']
        member.size = len(data)
        new.addfile(member, io.BytesIO(data))
new_hash = digest(next_archive.read_bytes())
with tarfile.open(next_archive) as archive:
    for item in new_manifest['files']:
        data = archive.extractfile(f'{slug}/{item["path"]}').read()
        assert len(data) == item['size'] and digest(data) == item['sha256']

db = sqlite3.connect('/root/.systemedu-library/db.sqlite')
try:
    db.execute('BEGIN IMMEDIATE')
    row = db.execute('SELECT manifest_json, total_size_bytes FROM projects WHERE slug=? AND status=?', (slug, 'published')).fetchone()
    assert row
    before_lessons = db.execute('SELECT * FROM lessons WHERE project_slug=? ORDER BY id', (slug,)).fetchall()
    assert len(before_lessons) == 58
    (backup / 'project-metadata.json').write_text(json.dumps({'manifest_json': row[0], 'total_size_bytes': row[1]}))
    db_manifest = corrected(json.loads(row[0]))
    assert db_manifest['total_size_bytes'] == new_manifest['total_size_bytes']
    for rel, data in replacements.items():
        temporary = (root / rel).with_name(Path(rel).name + '.next')
        temporary.write_bytes(data)
        os.replace(temporary, root / rel)
    shutil.copy2(next_archive, archive_path.with_suffix('.next'))
    os.replace(archive_path.with_suffix('.next'), archive_path)
    cursor = db.execute('UPDATE projects SET manifest_json=?, total_size_bytes=? WHERE slug=? AND manifest_json=?',
                        (json.dumps(db_manifest, ensure_ascii=False), db_manifest['total_size_bytes'], slug, row[0]))
    assert cursor.rowcount == 1
    assert db.execute('SELECT * FROM lessons WHERE project_slug=? ORDER BY id', (slug,)).fetchall() == before_lessons
    db.commit()
except BaseException:
    db.rollback()
    for rel in replacements:
        shutil.copy2(backup / rel, root / rel)
    shutil.copy2(backup / archive_path.name, archive_path)
    raise
finally:
    db.close()

report = {'passed': True, 'changed': sorted(patch['files']), 'lessons_unchanged': 58,
          'files_verified': 884, 'before_archive_sha256': expected['course_sha256'],
          'course_sha256': new_hash,
          'files': {rel: {key: value for key, value in item.items() if key != 'content'} for rel, item in patch['files'].items()}}
(release / 'blueprint-correction.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
