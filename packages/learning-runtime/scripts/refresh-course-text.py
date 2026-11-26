#!/usr/bin/env python3
"""Refresh one installed course's text from its canonical source, without other exports.

Keeps activity IDs, source edition, interactions, route context and unrelated assets.
Use the full exporter for new courses or media/algorithm changes.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil

def read(p): return json.loads(p.read_text())
def write(p, data): p.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))

def refresh(source, out, extra_assets=()):
    manifest = read(source / 'manifest.json')
    slug = manifest['slug']
    catalog_path = out / 'content/catalog.json'
    catalog = read(catalog_path)
    course = next(c for c in catalog['courses'] if c['id'] == slug)
    assert course['version'] == str(manifest['version']), 'Edition change requires a full export'
    index = {n['module_id']: n for n in manifest['knodes']}
    assert set(index) == {n['moduleId'] for n in course['modules']}
    # Every download advertised below must be present in the offline bundle.
    tracked = {p: p.relative_to(source) for p in (source / 'downloads').glob('*') if p.is_file()}
    for node in course['modules']:
        directory = source / index[node['moduleId']]['knode_dir']
        target = out / node['path'].lstrip('/')
        payload = read(target)
        assert payload['module_id'] == node['moduleId'] and payload['course_id'] == slug
        for field, file in [('lesson','lesson.md'),('assignment','assignment.md'),('theories','theories.json'),('content_history','content-history.json')]:
            p = directory / file
            if not p.exists():
                assert field == 'content_history'
                continue
            payload[field] = p.read_text() if p.suffix == '.md' else read(p)
            tracked[p] = p.relative_to(source)
        if manifest.get('content_revision') and 'content_history' in payload:
            payload['content_revision'] = manifest['content_revision']
        payload['downloads'] = [dict(title=p.name, url=f'/content/assets/{slug}/downloads/{p.name}')
                                for p in sorted((source / 'downloads').glob('*')) if p.is_file()]
        write(target, payload)
        # Source downloads remain consistent with the classroom's current text.
        for p in directory.glob('media/beginner-*'):
            tracked[p] = p.relative_to(source)
    course['contentRevision'] = manifest.get('content_revision')
    write(catalog_path, catalog)
    tracked[source / 'manifest.json'] = Path('manifest.json')
    if manifest.get('content_revision'):
        for p in (source / 'audit' / manifest['content_revision']).rglob('*'):
            if p.is_file(): tracked[p] = p.relative_to(source)
    for relative in extra_assets:
        p = (source / relative).resolve()
        if not p.is_relative_to(source.resolve()) or not p.is_file():
            raise ValueError(f'Missing or unsafe course asset: {relative}')
        tracked[p] = p.relative_to(source.resolve())
    coverage_path = out / 'content/coverage.json'
    coverage = read(coverage_path)
    for path, relative in tracked.items():
        destination = out / 'content/assets' / slug / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
        coverage['source_files'][slug + '/' + str(relative)] = hashlib.sha256(path.read_bytes()).hexdigest()
    write(coverage_path, coverage)
    print(f'Refreshed {len(index)} modules in {out}; edition and activity IDs retained')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, action='append', required=True)
    parser.add_argument('--asset', action='append', default=[], help='Additional course-relative file to refresh')
    args = parser.parse_args()
    for destination in args.out: refresh(args.source, destination, args.asset)
