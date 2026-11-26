"""Repair CommonMark delimiter boundaries in added teaching prose only."""
import hashlib
import json
import re
from pathlib import Path
import apply_revision as revision

here, source = revision.HERE, revision.SOURCE
audit = source / 'audit' / revision.REVISION
drafts = []
for name in revision.FILES:
    path = here / 'drafts' / (name + '.json')
    items = revision.read(path)
    for item in items:
        for block in item['insertions']:
            block['markdown'] = re.sub(r'\*\*(.+?)\*\*', r' **\1** ', block['markdown'])
    revision.write(path, items)
    drafts.extend(items)

coverage = revision.read(here / 'node-coverage.json')
for item in drafts:
    mid = item['module']
    old = audit / 'previous' / mid
    directory = source / f'knodes/{mid}-w0-module'
    lesson = revision.insert((old / 'lesson.md').read_text(), item['insertions'], item.get('replacements', []))
    (directory / 'lesson.md').write_text(lesson)
    author_path = source / f'authoring/nodes/{mid}.json'
    author = revision.read(author_path)
    author['plan_markdown'] = revision.insert(revision.read(old / 'authoring.json')['plan_markdown'], item['insertions'], item.get('replacements', []))
    revision.write(author_path, author)
    entry = next(row for row in coverage if row['module'] == mid)
    entry['new_sha256'] = hashlib.sha256(lesson.encode()).hexdigest()
    entry['new_han'] = revision.han(lesson)

revision.write(audit / 'insertions.json', drafts)
revision.write(audit / 'node-coverage.json', coverage)
revision.write(here / 'node-coverage.json', coverage)
manifest = revision.read(source / 'manifest.json')
for entry in manifest['files']:
    path = source / entry['path']
    if path.is_file() and (entry['path'].startswith(('audit/beginner-20261126/', 'authoring/nodes/')) or entry['path'].endswith('/lesson.md')):
        entry.update(sha256=revision.sha(path), size=path.stat().st_size)
manifest['total_size_bytes'] = sum(e['size'] for e in manifest['files'])
revision.write(source / 'manifest.json', manifest)
print('Fixed emphasis boundaries in all 32 added lesson blocks; originals retained.')
