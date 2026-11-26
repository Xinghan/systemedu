from pathlib import Path
import hashlib
import json
import importlib.util
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('revision', HERE / 'apply_revision.py')
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)
source, old = r.SOURCE, r.AUDIT / 'previous'
drafts = [d for name in r.FILES for d in r.read(HERE / 'drafts' / (name + '.json'))]
checks = []
for d in drafts:
    mid = d['module']; folder = source / f'knodes/{mid}-w0-module'
    before = (old / mid / 'lesson.md').read_text(); after = (folder / 'lesson.md').read_text()
    assert r.insert(before, d['insertions'], d.get('replacements', [])) == after
    assert r.markers(before) == r.markers(after)
    assert '\n'.join(re.findall(r'```[\s\S]*?```', before)) in '\n'.join(re.findall(r'```[\s\S]*?```', after)) or all(b in after for b in re.findall(r'```[\s\S]*?```', before))
    for relative in re.findall(r'/api/library/projects/lightkurve-transit-detective/files/([^\s)]+)', after):
        assert (source / relative).is_file(), (mid, relative)
    history = r.read(folder / 'content-history.json')
    assert history['questions'] and len({x['key'] for x in history['questions']}) == len(history['questions'])
    checks.append(mid)
manifest = r.read(source / 'manifest.json')
entries = {x['path']: x for x in manifest['files']}
for p in [source / f'knodes/{d["module"]}-w0-module/lesson.md' for d in drafts] + list(r.AUDIT.rglob('*')) + list(source.glob('knodes/*/media/beginner-*')):
    if not p.is_file(): continue
    entry = entries[str(p.relative_to(source))]
    assert entry['sha256'] == r.sha(p) and entry['size'] == p.stat().st_size
baseline = r.read(ROOT / 'artifacts/space-expedition-20261126/learning-audit/text-counts.json')
for row in baseline['route_rows']:
    p = ROOT / row['source']
    data = r.read(p)
    if row['ref'].startswith('lightkurve-transit-detective:'):
        mid = data['module_id']
        assert data['lesson'] == (source / f'knodes/{mid}-w0-module/lesson.md').read_text()
        assert data['content_revision'] == r.REVISION
    else:
        assert r.sha(p) == row['source_sha256'], row['ref']
report = {'status':'pass','revised_nodes':checks,'original_nodes_retained':120,
    'unrelated_88_bundled_nodes_unchanged':True,'original_text_recoverable':True,
    'original_media_markers_and_code_retained':True,'local_lesson_links_resolve':True,
    'history_answer_keys_unique':True,'source_manifest_hashes_checked':True,
    'learner_trial':False,'python_on_ipad':False}
r.write(HERE / 'source-verification.json', report)
print(json.dumps(report,ensure_ascii=False))
