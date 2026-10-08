"""Freeze the reviewed M04-only delta against downloaded production baselines."""
import hashlib
import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/readonly-m04-release-20260915'
WEB = ROOT / 'packages/student-web'
COURSE = ROOT.parent / 'systemeduidea/projects_data/molecule-monster-hunter'
CANDIDATE = ROOT / 'artifacts/readonly-m04-20260914/candidate.json'
BASE = OUT / 'baseline'

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p, value): p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

candidate = json.loads(CANDIDATE.read_text())
assert candidate['status']=='local-browser-verified' and candidate['slides']==9
for rel,digest in candidate['course_sha256'].items(): assert sha(COURSE/rel)==digest,rel
assert (COURSE/'knodes/M04-w0-module/slides.json').read_bytes()==(ROOT/'course_factory/fixtures/molecule-monster-hunter/M04-readonly-v1.json').read_bytes()
payload=OUT/'web'; assert not payload.exists(), 'Frozen payload already exists'
component=payload/'src/components/learning'; component.mkdir(parents=True)
for name in ['functional-group-readonly.tsx','functional-group-readonly.css','readonly-presentation.tsx','molecular-object-3d.tsx']:
    (component/name).write_bytes((WEB/'src/components/learning'/name).read_bytes())
(payload/'src/lib').mkdir()
(payload/'src/lib/functional-group-readonly.ts').write_bytes((WEB/'src/lib/functional-group-readonly.ts').read_bytes())
technical=(BASE/'technical-visual.tsx').read_text()
assert technical.count('FunctionalGroupVisual')==2 and technical.count('./functional-group-visual')==1
technical=technical.replace('FunctionalGroupVisual','FunctionalGroupReadonly').replace('./functional-group-visual','./functional-group-readonly')
(component/'technical-visual.tsx').write_text(technical)
files=sorted(str(p.relative_to(payload)) for p in payload.rglob('*') if p.is_file())
assert len(files)==6
for archive,root,paths in [('web-delta.tar.gz',payload,files),('course-delta.tar.gz',COURSE,list(candidate['course_sha256']))]:
    with tarfile.open(OUT/archive,'w:gz') as tar:
        for rel in paths: tar.add(root/rel,arcname=rel)
baseline={f'src/components/learning/{p.name}':sha(p) for p in BASE.glob('*.tsx')}
asset='public/slide-assets/molecule-monster-hunter/M04/phase-comparison-v1.webp'
baseline[asset]='57b3fdbe24a4b995807278f8109d91004813532f8739f8e0ec3865bc61c3caca'
assert sha(WEB/asset)==baseline[asset]
record={'project':'molecule-monster-hunter','numbering_version':'consecutive-v2','production_deployed':False,'modules':['M04'],'slides':9,
        'expected_build':'ZfGjTkWmIZmJ4F16Si-91','web_sha256':{p:sha(payload/p) for p in files},'baseline_web_sha256':baseline,
        'course_sha256':candidate['course_sha256'],'baseline_course_sha256':{f'knodes/M04-w0-module/{p}':v for p,v in candidate['source_sha256'].items()}}
record['baseline_course_sha256']['manifest.json']=sha(ROOT/'artifacts/readonly-m04-20260914/manifest-before.json')
save(OUT/'expected.json',record)
save(OUT/'browser-verified.json',{'m04_readonly_verified':True,'web_sha256':record['web_sha256'],
     'record':'docs/slide-image-prompts/molecule-M04-readonly-decisions.md','candidate_sha256':sha(CANDIDATE),
     'verification':candidate['verification'],'dispatcher_note':'Production dispatcher patched only functional-group import and branch; all other production branches preserved.'})
print(json.dumps(record,ensure_ascii=False,indent=2))
