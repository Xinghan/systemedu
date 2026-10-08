"""Create explicitly scoped deployment inputs; never reads local secrets."""
import json, tarfile, hashlib, io
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/molecule-numbering-20260914'
OUT.mkdir(exist_ok=True)
WEB=ROOT/'packages/student-web'
changed=[r['file'] for r in json.loads((ROOT/'artifacts/molecule-numbering-20260912/frontend-changes.json').read_text())]
changed=[p for p in changed if not any(n in p for n in ['funnel-evidence-visual','lipinski-evidence-visual','roc-evidence-visual'])]
extra=['src/lib/api/client.ts','src/lib/api/gateway.ts','src/lib/hooks/use-page-kind.ts','src/lib/hooks/use-websocket-chat.ts','src/components/learning/teacher-scene-view.tsx','src/lib/data/diversity-pool.json']
new=['src/lib/course-numbering.ts','src/lib/data/molecule-numbering-v2.json','src/lib/numbering-storage.ts','src/components/learning/learn-page.tsx','src/app/(learn)/learn/[slug]/v2/[moduleId]/page.tsx']
backend=['chat/memory_layers.py','chat/payload.py','chat/routes.py','server.py','workers/fact_extractor_worker.py']
files=['packages/student-web/'+p for p in sorted(set(changed+extra))]+['packages/student-app/src/systemedu/student/'+p for p in backend]
(OUT/'inspect-files.txt').write_text('\n'.join(files)+'\n')
meta={'existing':files,'new':['packages/student-web/'+p for p in new]+['packages/student-app/src/systemedu/student/'+p for p in ['course_numbering.py','molecule-numbering-v2.json']]}
contents={p:(ROOT/p).read_bytes() for p in meta['existing']+meta['new']}
# Do not deploy unrelated invitation feature or the EMG image ordering change.
server='packages/student-app/src/systemedu/student/server.py'
contents[server]=contents[server].replace(b'from .invite_application import ROUTES as _invite_application_routes\n',b'').replace(b'        *_invite_application_routes,\n',b'')
teacher='packages/student-web/src/components/learning/teacher-scene-view.tsx'
text=(OUT/'production-before'/teacher).read_text().replace('import { getToken } from "@/lib/auth"','import { getToken } from "@/lib/auth"\nimport { MOLECULE_NUMBERING_VERSION } from "@/lib/course-numbering"')
text=text.replace('headers: !previewUrl && token ? { Authorization: `Bearer ${token}` } : undefined,','headers: !previewUrl ? { "X-Course-Numbering": MOLECULE_NUMBERING_VERSION, ...(token ? { Authorization: `Bearer ${token}` } : {}) } : undefined,')
text=text.replace('headers: token ? { Authorization: `Bearer ${token}` } : undefined,','headers: { "X-Course-Numbering": MOLECULE_NUMBERING_VERSION, ...(token ? { Authorization: `Bearer ${token}` } : {}) },')
contents[teacher]=text.encode()
meta['expected']={p:hashlib.sha256(data).hexdigest() for p,data in contents.items()}
meta['before']={p:hashlib.sha256((OUT/'production-before'/p).read_bytes()).hexdigest() for p in files}
(OUT/'scope.json').write_text(json.dumps(meta,indent=2))
with tarfile.open('/tmp/numbering-code.tar.gz','w:gz') as tar:
    for p,data in contents.items():
        info=tarfile.TarInfo(p);info.size=len(data);info.mode=0o644;tar.addfile(info,io.BytesIO(data))
    for p in ['scripts/course_migrations/migrate_student_numbering.py','scripts/course_migrations/molecule_numbering.py']:
        tar.add(ROOT/p,arcname=p)
print(json.dumps({'scoped_files':len(meta['expected']),'bundle_bytes':Path('/tmp/numbering-code.tar.gz').stat().st_size}))
CANDIDATE=ROOT/'artifacts/molecule-numbering-20260912/candidate-v5/molecule-monster-hunter'
missing={'m01-protein-target-candidates-v1.webp','m03-real-molecule-skeletons-v1.webp','m04-ethane-ethanol-water-v1.webp','m38-oil-water-logp-v1.webp','m85-membrane-absorption-v1.webp'}
with tarfile.open('/tmp/numbering-course-text.tar.gz','w:gz') as tar:
    for path in CANDIDATE.rglob('*'):
        if path.is_file() and (path.suffix in {'.json','.md','.html','.txt'} or path.name in missing):
            tar.add(path,arcname=path.relative_to(CANDIDATE).as_posix())
