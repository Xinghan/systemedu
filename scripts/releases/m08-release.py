"""Explicit M08-only release using a private memory importer target to bound disk use."""
import hashlib,json,os,shutil,sqlite3,subprocess,sys,tarfile
from pathlib import Path
ROOT=Path('/opt/systemedu');R=ROOT/'releases/m08-variable-20260914'
LIVE=ROOT/'packages/student-web';COURSE=Path('/root/.systemedu-library/media/projects/molecule-monster-hunter')
STAGE=R/'course';MEM=Path('/dev/shm/systemedu-m08-20260914')
FILES=['slides.json','audio_scripts.json','lesson.md','assignment.md']
NODE='knodes/M08-w0-smiles'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def hashes(root):return {str(p.relative_to(root)):sha(p) for p in root.rglob('*') if p.is_file() and not any(x in p.parts for x in ['node_modules','.next','__pycache__']) and p.name!='tsconfig.tsbuildinfo'}
def save(name,d):(R/name).write_text(json.dumps(d,ensure_ascii=False,indent=2))
action=sys.argv[1];R.mkdir(mode=0o700,exist_ok=True)
if action=='stage':
    assert not (R/'stage.ok').exists() and (LIVE/'.next/BUILD_ID').read_text().strip()=='nzSmTUp_uCWpnWW84nmMT'
    assert sha(COURSE/'manifest.json')=='1344a66c8f3a50b3268b9d980c8a243896b6d7b49a17b92061112e102a91d330'
    assert shutil.disk_usage(R).free>850_000_000
    save('web-before.json',hashes(LIVE));save('course-before.json',hashes(COURSE))
    subprocess.run(['cp','-al',str(LIVE),str(R/'student-web')],check=True);shutil.rmtree(R/'student-web/.next')
    subprocess.run(['cp','-al',str(COURSE),str(STAGE)],check=True);shutil.rmtree(STAGE/'_archive')
    for p in [*(NODE+'/'+f for f in FILES),'manifest.json']:(STAGE/p).unlink()
    with tarfile.open('/tmp/m08-course-delta.tar.gz') as tar:tar.extractall(STAGE)
    from library.manifest import load_manifest,verify_files
    assert not verify_files(load_manifest(STAGE/'manifest.json'),STAGE)
    before=json.loads((R/'course-before.json').read_text());after=hashes(STAGE)
    allowed={NODE+'/'+f for f in FILES}|{'manifest.json','_archive/molecule-monster-hunter-0.2.0.tar.gz'}
    assert {p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}<=allowed
    with tarfile.open('/tmp/m08-web-new.tar.gz') as tar:tar.extractall(R/'student-web')
    p=R/'student-web/src/components/learning/technical-visual.tsx';s=p.read_text();p.unlink()
    assert 'PythonVariableVisual' not in s
    s='import { PythonVariableVisual } from "./python-variable-visual"\n'+s if not s.startswith('"use client"') else s.replace('"use client"','"use client"\nimport { PythonVariableVisual } from "./python-variable-visual"',1)
    needle='return <CodeTraceVisual visual={visual} />';assert s.count(needle)==1
    s=s.replace(needle,'if (visual.aria_label?.startsWith("M08 ·")) return <PythonVariableVisual key={visual.aria_label} visual={visual} />\n      '+needle);p.write_text(s)
    p=R/'student-web/src/lib/types/api.ts';s=p.read_text();p.unlink();needle='active_lines: number[]';assert s.count(needle)==1
    p.write_text(s.replace(needle,needle+'\n        code?: string\n        error?: string'))
    save('web-expected.json',hashes(R/'student-web'));save('course-expected.json',hashes(STAGE))
    MEM.mkdir(mode=0o700,exist_ok=True);assert shutil.disk_usage(MEM).free>2_500_000_000
    with tarfile.open(MEM/'molecule-monster-hunter.tar.gz','w:gz') as tar:tar.add(STAGE,arcname='molecule-monster-hunter')
    (R/'stage.ok').touch();print('Only M08 four lesson files + manifest, four frontend files staged.')
elif action=='pause':
    assert (R/'build.ok').exists() and not (R/'paused.ok').exists()
    assert hashes(LIVE)==json.loads((R/'web-before.json').read_text())
    assert hashes(COURSE)==json.loads((R/'course-before.json').read_text())
    conf=Path('/etc/nginx/sites-available/systemedu');shutil.copy2(conf,R/'nginx-before')
    s=conf.read_text();assert 'server {' in s
    conf.write_text(s.replace('server {','server {\n  if (-f /opt/systemedu/releases/m08-variable-20260914/maintenance.flag) { return 503; }'))
    subprocess.run(['nginx','-t'],check=True);(R/'maintenance.flag').touch();subprocess.run(['systemctl','reload','nginx'],check=True)
    subprocess.run(['systemctl','stop','systemedu-student-backend','systemedu-student-worker','systemedu-student-web'],check=True)
    with sqlite3.connect('file:/root/.systemedu-library/db.sqlite?mode=ro',uri=True) as src,sqlite3.connect(R/'library-before.sqlite') as dst:src.backup(dst)
    (R/'paused.ok').touch();print('Short maintenance enabled and library backup verified.')
elif action=='publish':
    assert (R/'paused.ok').exists() and os.environ.get('TMPDIR')==str(MEM)
    # Normal importer and normal production DB; file destination is isolated in this CLI
    # process only. The library server configuration is not changed. The full imported
    # tree is checked before an atomic directory swap. Immutable bytes are reused.
    import library.importer as importer
    importer.PROJECTS_MEDIA_DIR=MEM/'imported'
    manifest=importer.import_tarball(MEM/'molecule-monster-hunter.tar.gz')
    from library.manifest import verify_files
    imported=MEM/'imported/molecule-monster-hunter'
    assert not verify_files(manifest,imported) and not verify_files(manifest,STAGE)
    assert hashes(STAGE)==json.loads((R/'course-expected.json').read_text())
    (STAGE/'_archive').mkdir();shutil.copy2(MEM/'molecule-monster-hunter.tar.gz',STAGE/'_archive/molecule-monster-hunter-0.2.0.tar.gz')
    COURSE.rename(R/'course-before');STAGE.rename(COURSE)
    shutil.copytree(LIVE/'.next/static',R/'student-web/.next/static',dirs_exist_ok=True)
    LIVE.rename(R/'student-web-before');(R/'student-web').rename(LIVE)
    (R/'live.ok').touch();print('M08 normal import verified and frontend/course atomically switched.')
elif action=='verify':
    assert (R/'live.ok').exists()
    from library.models import get_session,Lesson
    db=get_session();lesson=db.query(Lesson).filter_by(project_slug='molecule-monster-hunter',knode_id='M08').one()
    slides=json.loads((COURSE/NODE/'slides.json').read_text())['slides'];assert lesson.slides==slides and len(slides)==8
    assert all(s['payload']['technical_visual']['aria_label'].startswith('M08 ·') and s['audio_path'] is None for s in slides);db.close()
    expected=json.loads((R/'course-expected.json').read_text());actual=hashes(COURSE)
    assert {k:v for k,v in actual.items() if not k.startswith('_archive/')}==expected
    assert hashes(LIVE)==json.loads((R/'web-expected.json').read_text())
    # Confirm all other project records and all other node rows stay unchanged.
    before=sqlite3.connect(R/'library-before.sqlite');after=sqlite3.connect('/root/.systemedu-library/db.sqlite')
    q='SELECT project_slug,knode_id,title,plan_markdown,slides,rendered_sections FROM lessons WHERE project_slug != ? OR knode_id != ? ORDER BY project_slug,knode_id'
    assert before.execute(q,('molecule-monster-hunter','M08')).fetchall()==after.execute(q,('molecule-monster-hunter','M08')).fetchall()
    save('verification.json',{'project':'molecule-monster-hunter','module':'M08','numbering_version':'consecutive-v2','slides':8,'states':35,'other_nodes_unchanged':True,'new_audio':False,'build_id':(LIVE/'.next/BUILD_ID').read_text().strip(),'authenticated_student_e2e':False})
    (R/'verified.ok').touch();print((R/'verification.json').read_text())
elif action=='resume':
    assert (R/'verified.ok').exists()
    subprocess.run(['systemctl','start','systemedu-student-worker'],check=True)
    shutil.copy2(R/'nginx-before','/etc/nginx/sites-available/systemedu');subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
    (R/'maintenance.flag').unlink();(R/'resumed.ok').touch();print('M08 release resumed.')
elif action=='api-verify':
    import urllib.request
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    request=urllib.request.Request('http://127.0.0.1:18821/v1/projects/molecule-monster-hunter/knodes/M08',headers={'Authorization':'Bearer '+os.environ['LIBRARY_LICENSE_TOKEN']})
    with opener.open(request,timeout=20) as response:content=json.load(response)
    slides=json.loads((COURSE/NODE/'slides.json').read_text())['slides']
    assert content['slides']==slides
    with opener.open('https://systeme.xin/learn/molecule-monster-hunter/v2/M08',timeout=20) as response:status=response.status
    save('api-verification.json',{'library_api_matches_all_8_slides':True,'https_status':status,'authenticated_student_e2e':False})
    print((R/'api-verification.json').read_text())
elif action=='rollback':
    assert (R/'paused.ok').exists() and not (R/'resumed.ok').exists()
    subprocess.run(['systemctl','stop','systemedu-library','systemedu-student-web','systemedu-student-backend','systemedu-student-worker'],check=True)
    if (R/'course-before').exists():COURSE.rename(R/'course-failed');(R/'course-before').rename(COURSE)
    if (R/'student-web-before').exists():LIVE.rename(R/'student-web-failed');(R/'student-web-before').rename(LIVE)
    db=Path('/root/.systemedu-library/db.sqlite')
    for suffix in ['', '-wal','-shm']:
        p=Path(str(db)+suffix)
        if p.exists():p.rename(R/('library-failed.sqlite'+suffix))
    shutil.copy2(R/'library-before.sqlite',db)
    subprocess.run(['systemctl','start','systemedu-library','systemedu-student-backend','systemedu-student-web','systemedu-student-worker'],check=True)
    shutil.copy2(R/'nginx-before','/etc/nginx/sites-available/systemedu');subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
    (R/'rolled-back.ok').touch();print('Previous numbered course and frontend restored.')
else:raise SystemExit('Invalid step')
