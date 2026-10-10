"""Server-side scoped release validation. Production files never leave server."""
import hashlib, json, os, sqlite3, sys, tarfile, urllib.request
from pathlib import Path
R=Path('/opt/systemedu/releases/m38-m90-evidence-20260909')
META=json.loads(Path('/tmp/m3890-expected-source.json').read_text())
ALLOWED=set(META['source_sha256'])
WEB_NEW=["src/lib/logp-lab.ts","src/lib/workbench-evidence.ts","src/components/learning/logp-lab-visual.tsx","src/components/learning/logp-lab.css","src/components/learning/partition-object-3d.tsx","src/components/learning/workbench-evidence-visual.tsx","src/components/learning/workbench-evidence.css","public/slide-assets/molecule-monster-hunter/M38/oil-water-comparison-v1.webp"]
WEB_EDIT=['src/components/learning/technical-visual.tsx','src/lib/types/api.ts']
def hashes(root):
    return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file() and 'node_modules' not in p.parts and '.next' not in p.parts and p.name!='tsconfig.tsbuildinfo'}
def save(name,obj): (R/name).write_text(json.dumps(obj,indent=2))
action=sys.argv[1]
root=Path(sys.argv[2]) if len(sys.argv)>2 else None
if action=='web-baseline':
    assert (root/'.next/BUILD_ID').read_text().strip()=='ea4FB-hqZCwxNKu7J5oIs','Unexpected live build'
    for p,h in META['dependencies_sha256'].items(): assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,'Dependency differs: '+p
    save('web-baseline.json',hashes(root));print('Frontend baseline kept on server.')
elif action=='web-patch':
    f=root/WEB_EDIT[0];s=f.read_text();assert 'case "logp-lab"' not in s
    s=s.replace('import type { SlideTechnicalVisual }', 'import { LogpLabVisual } from "./logp-lab-visual"\nimport { WorkbenchEvidenceVisual } from "./workbench-evidence-visual"\n\nimport type { SlideTechnicalVisual }',1)
    marker='switch (visual.renderer) {';assert marker in s
    s=s.replace(marker,marker+'\n    case "logp-lab": return <LogpLabVisual key={visual.scene} visual={visual} />\n    case "workbench-evidence": return <WorkbenchEvidenceVisual key={visual.scene} visual={visual} />',1)
    f.write_text(s)
    f=root/WEB_EDIT[1];s=f.read_text();assert 'renderer: "logp-lab"' not in s
    types=Path('/tmp/m3890-types.txt').read_text();marker='export type SlideTechnicalVisual =';assert marker in s
    f.write_text(s.replace(marker,marker+'\n'+types,1))
    before=json.loads((R/'web-baseline.json').read_text());after=hashes(root)
    changes={p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}
    assert changes<=set(WEB_NEW+WEB_EDIT),changes
    for p,h in META['web_sha256'].items(): assert after[p]==h
    save('web-changes.json',sorted(changes));print(json.dumps({'web_changed':sorted(changes)}))
elif action=='web-delta-check':
    before=json.loads((R/'web-baseline.json').read_text());after=hashes(root)
    changes={p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}
    assert changes<=set(WEB_NEW+WEB_EDIT),changes
    save('web-changes.json',sorted(changes));print(json.dumps({'web_changed':sorted(changes)}))
elif action=='check-web':
    assert hashes(root)==json.loads((R/'web-baseline.json').read_text()),'Live frontend changed while staging'
    print('Live frontend unchanged since staging.')
elif action=='course-baseline':
    current=hashes(root)
    mismatch=[p for p,h in META['source_sha256'].items() if current.get(p)!=h]
    save('course-source-differences.json',mismatch)
    # Source differences are checked by the operator before stage-course applies a delta.
    print(json.dumps({'source_differences':mismatch}))
    if mismatch: raise SystemExit('Target course sources differ from reviewed snapshots; do not overwrite blindly.')
    save('course-baseline.json',current)
elif action=='manifest':
    before=json.loads((R/'course-baseline.json').read_text());after=hashes(root)
    changes={p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}
    assert changes<=ALLOWED,changes-ALLOWED
    for n in META['nodes']:
        slides=json.loads((root/'knodes'/n['node']/'slides.json').read_text())['slides']
        assert len(slides)==n['slides'] and all(s.get('audio_path') is None for s in slides)
        assert all(s['payload'].get('technical_visual') for s in slides)
    sys.path.insert(0,'/opt/systemedu/tools/content-pipeline/src')
    from content_pipeline.manifest import regenerate_manifest
    from library.manifest import load_manifest,verify_files
    regenerate_manifest(root)
    m=json.loads((root/'manifest.json').read_text());m['files']=[f for f in m['files'] if not f['path'].startswith('_archive/')];m['total_size_bytes']=sum(f['size'] for f in m['files']);(root/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
    assert not verify_files(load_manifest(root/'manifest.json'),root)
    save('course-expected.json',hashes(root));print(json.dumps({'content_changed':sorted(changes),'slides':20}))
elif action=='check-course':
    assert hashes(root)==json.loads((R/'course-baseline.json').read_text()),'Course changed while staging'
elif action=='backup-db':
    target=R/'library-before.sqlite';assert not target.exists()
    with sqlite3.connect('file:/root/.systemedu-library/db.sqlite?mode=ro',uri=True) as src,sqlite3.connect(target) as dst:src.backup(dst)
    print('Consistent DB backup kept on production server.')
elif action=='audit-package':
    with tarfile.open(R/'molecule-monster-hunter.tar.gz','r:gz') as tar:
        members={m.name:m for m in tar.getmembers() if m.isfile()}
        prefix='molecule-monster-hunter/'
        manifest=json.load(tar.extractfile(prefix+'manifest.json'))
        missing=[f['path'] for f in manifest['files'] if prefix+f['path'] not in members]
        mismatch=[f['path'] for f in manifest['files'] if prefix+f['path'] in members and members[prefix+f['path']].size!=f['size']]
        result={'manifest_files':len(manifest['files']),'missing_count':len(missing),'missing_only_archive':bool(missing) and all(p.startswith('_archive/') for p in missing),'size_mismatch_count':len(mismatch)}
        print(json.dumps(result));save('package-audit.json',result)
        if missing or mismatch: raise SystemExit('Release package does not satisfy its manifest.')
elif action=='repair-package':
    manifest_path=root/'manifest.json';manifest=json.loads(manifest_path.read_text())
    removed=[f for f in manifest['files'] if f['path'].startswith('_archive/')]
    assert removed,'No archive entries to repair'
    manifest['files']=[f for f in manifest['files'] if not f['path'].startswith('_archive/')]
    manifest['total_size_bytes']=sum(f['size'] for f in manifest['files'])
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    from library.manifest import load_manifest,verify_files
    assert not verify_files(load_manifest(manifest_path),root)
    expected=json.loads((R/'course-expected.json').read_text());current=hashes(root)
    assert {k:v for k,v in current.items() if k!='manifest.json'}=={k:v for k,v in expected.items() if k!='manifest.json'}
    save('course-expected.json',current)
    print(json.dumps({'removed_derived_archive_entries':len(removed),'course_content_unchanged':True}))
elif action=='verify':
    actual=hashes(root);expected=json.loads((R/'course-expected.json').read_text());archive='_archive/molecule-monster-hunter-0.1.0.tar.gz'
    assert actual.get(archive)==hashlib.sha256((R/'molecule-monster-hunter.tar.gz').read_bytes()).hexdigest()
    assert {k:v for k,v in actual.items() if k!=archive}=={k:v for k,v in expected.items() if k!=archive}
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));counts={}
    for n in META['nodes']:
        req=urllib.request.Request('http://127.0.0.1:18821/v1/projects/molecule-monster-hunter/knodes/'+n['module'],headers={'Authorization':'Bearer '+os.environ['LIBRARY_LICENSE_TOKEN']})
        with opener.open(req) as response:content=json.load(response)
        slides=json.loads((root/'knodes'/n['node']/'slides.json').read_text())['slides'];assert content['slides']==slides
        counts[n['module']]=len(slides)
    before=json.loads((R/'course-baseline.json').read_text());changes={p for p in before.keys()|actual.keys() if before.get(p)!=actual.get(p)}
    assert changes<=ALLOWED|{'manifest.json',archive}
    result={'verified_nodes':counts,'total_slides':sum(counts.values()),'other_nodes_unchanged':True,'new_audio':False,'changed_files':sorted(changes)}
    save('verification.json',result);print(json.dumps(result))
else: raise SystemExit('Unknown action')
