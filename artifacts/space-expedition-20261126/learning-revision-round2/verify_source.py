"""Validate node continuity, material availability and actual executed outputs."""
from pathlib import Path
import csv, hashlib, json, re, zipfile

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[2]
SOURCE=Path('/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective')
REVISION='guided-20261126-r2'
AUDIT=SOURCE/'audit'/REVISION
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def csvrows(p):return list(csv.DictReader(p.open()))
markers=lambda s:re.findall(r'\[\[[A-Z0-9_]+:[^\]]+\]\]',s)
coverage=read(HERE/'node-coverage.json')
drafts=[x for name in ['M01-M11','M12-M22','M23-M32'] for x in read(HERE/f'draft-{name}.json')]
assert len(coverage)==len(drafts)==32
for row,item in zip(coverage,drafts):
    mid=row['module'];folder=SOURCE/f'knodes/{mid}-w0-module'
    before=(AUDIT/f'previous/{mid}/lesson.md').read_text();after=(folder/'lesson.md').read_text()
    assert sha(folder/'lesson.md')==row['after_sha256']
    assert markers(before)==markers(after)
    corrected=before
    for correction in item.get('corrections',[]):
        corrected=corrected.replace(correction['old'],correction['new'],1)
    for block in re.findall(r'```[\s\S]*?```',corrected):assert block in after,(mid,'code outside reviewed corrections')
    for rel in re.findall(r'/api/library/projects/lightkurve-transit-detective/files/([^\s)]+)',after):
        assert (SOURCE/rel).is_file(),(mid,rel)
    author=read(SOURCE/f'authoring/nodes/{mid}.json')
    prose=lambda s:'\n'.join(x.strip() for x in re.sub(r'\[\[[^\]]+\]\]','',s).splitlines() if x.strip())
    assert prose(author['plan_markdown'])==prose(after),(mid,'authoring prose differs')
    assert author['assignment']==(folder/'assignment.md').read_text()
    oldauthor=read(AUDIT/f'previous/{mid}/authoring.json')
    for key in set(author)-{'plan_markdown','assignment'}:assert author[key]==oldauthor[key]
    history=read(folder/'content-history.json')
    oldhistory=read(AUDIT/f'previous/{mid}/content-history.json')
    keys={q['key'] for q in history['questions']}
    assert len(keys)==len(history['questions'])
    assert {q['key'] for q in oldhistory['questions']}<=keys
    if any(':0.2.0:' in q['key'] for q in oldhistory['questions']):
        assert any(':beginner-20261126:' in k for k in keys)

manifest=read(SOURCE/'manifest.json');assert manifest['content_revision']==REVISION
entries={f['path']:f for f in manifest['files']}
changed_files=[]
for row in coverage:
    mid=row['module'];changed_files += [SOURCE/f'knodes/{mid}-w0-module/{name}' for name in ['lesson.md','assignment.md','content-history.json']]
    changed_files += [SOURCE/f'authoring/nodes/{mid}.json']
changed_files += [SOURCE/s for s in read(HERE/'refresh-assets.json')]
changed_files += [p for p in AUDIT.rglob('*') if p.is_file()]
for p in changed_files:
    entry=entries[str(p.relative_to(SOURCE))]
    assert entry['sha256']==sha(p) and entry['size']==p.stat().st_size,p

baseline=read(REPO/'artifacts/space-expedition-20261126/learning-audit/text-counts.json')
destinations=[]
for row in baseline['route_rows']:
    p=REPO/row['source'];payload=read(p)
    if row['ref'].startswith('lightkurve-transit-detective:'):
        mid=payload['module_id'];assert payload['content_revision']==REVISION
        assert payload['lesson']==(SOURCE/f'knodes/{mid}-w0-module/lesson.md').read_text()
    else:assert sha(p)==row['source_sha256'],row['ref']
    destinations.append({'original_ref':row['ref'],'destination':row['source'],'retained':True})
assert len(destinations)==120
(HERE/'full-route-destinations.json').write_text(json.dumps(destinations,ensure_ascii=False,indent=2)+'\n')
for base in ['packages/learning-runtime/dist','packages/ios-app/SystemEdu/Resources/WebRuntime']:
    root=REPO/base
    course=next(c for c in read(root/'content/catalog.json')['courses'] if c['id']=='lightkurve-transit-detective')
    for node in course['modules']:
        payload=read(root/node['path'].lstrip('/'));mid=payload['module_id']
        assert payload['lesson']==(SOURCE/f'knodes/{mid}-w0-module/lesson.md').read_text()
    for rel in read(HERE/'refresh-assets.json'):
        assert sha(root/'content/assets/lightkurve-transit-detective'/rel)==sha(SOURCE/rel)

book=read(SOURCE/'downloads/junior-guide.ipynb')
assert all(c.get('outputs',[])==[] and c.get('execution_count') is None for c in book['cells'])
assert sum('Q4_REVEAL = False' in ''.join(c['source']) for c in book['cells'] if c['cell_type']=='code')==1
with zipfile.ZipFile(SOURCE/'downloads/lightkurve-practice-kit.zip') as z:
    assert z.read('lightkurve-practice/junior-guide.ipynb')==(SOURCE/'downloads/junior-guide.ipynb').read_bytes()
    for p in (SOURCE/'practice/raw').glob('*'):
        if p.is_file():assert z.read('lightkurve-practice/raw/'+p.name)==p.read_bytes()
inputrows=csvrows(SOURCE/'downloads/kepler10-q3-validity-input.csv')
assert len(inputrows)==4370 and inputrows[0]['PDCSAP_FLUX_ERR']==''
assert float(inputrows[1]['PDCSAP_FLUX_ERR'])>0
execution=[]
for mode in ['guarded','revealed']:
    report=read(HERE/f'execution-{mode}.json')
    assert report['status']=='pass' and report['notebook_sha256']==sha(SOURCE/'downloads/junior-guide.ipynb')
    out=Path(report['output'])
    assert len(csvrows(out/'validity-ledger.csv'))==4370
    assert len(csvrows(out/'gaps.csv'))==4
    final=read(out/'M32-final/completion-state.json')
    assert not final['learner_understanding_verified'] and final['learner_answers_pending']
    if mode=='guarded':assert not (out/'audit/holdout-first-results.json').exists()
    else:
        predicted=read(out/'audit/holdout-predictions-before-reveal.json')['windows']
        actual=csvrows(out/'M26-comparison-v1/windows.csv')
        assert [int(w['cycle']) for w in actual]==[w['cycle'] for w in predicted]
        comparisons=csvrows(out/'M30-reproduction/comparison.csv')
        assert all(r['status']=='matches' for r in comparisons),comparisons
        assert all(read(out/'M32-final/final-rerun/comparison.json')['checks'].values())
    execution.append({'mode':mode,'code_cells':report['code_cells'],'elapsed_seconds':report['elapsed_seconds']})
report={'status':'pass','revised_nodes':32,'original_route_nodes_retained':120,'unrelated_88_nodes_unchanged':True,
    'old_text_and_assignments_snapshotted':True,'original_media_and_code_retained':True,
    'source_authoring_and_bundles_match':True,'old_answer_keys_retained':True,'download_hashes_and_raw_verified':True,
    'executions':execution,'learner_trial':False,'python_on_ipad':False}
(HERE/'source-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
