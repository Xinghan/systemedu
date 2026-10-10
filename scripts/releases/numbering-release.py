"""Server-side explicit steps for the approved v2 course cutover."""
import hashlib,json,os,shutil,sqlite3,subprocess,sys,tarfile
from pathlib import Path
R=Path('/opt/systemedu/releases/numbering-v2-20260914')
ROOT=Path('/opt/systemedu')
LIVE=ROOT/'packages/student-web'
COURSE=Path('/root/.systemedu-library/media/projects/molecule-monster-hunter')
STAGE=R/'candidate/molecule-monster-hunter'
META=json.loads((R/'scope.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,data):(R/p).write_text(json.dumps(data,ensure_ascii=False,indent=2))
def hashes(root):return {str(p.relative_to(root)):sha(p) for p in root.rglob('*') if p.is_file() and not any(x in p.parts for x in ['node_modules','.next','__pycache__']) and p.name!='tsconfig.tsbuildinfo'}
action=sys.argv[1]
if action=='stage':
    assert not (R/'stage.ok').exists()
    for p,h in META['before'].items():assert sha(ROOT/p)==h,p
    assert (LIVE/'.next/BUILD_ID').read_text().strip()=='0u-EnD5pJHxgXjTM4fNPa'
    save('web-before.json',hashes(LIVE))
    subprocess.run(['cp','-a',str(ROOT/'packages/student-app'),str(R/'student-app-before')],check=True)
    subprocess.run(['cp','-al',str(COURSE),str(R/'course-before')],check=True)
    subprocess.run(['cp','-al',str(LIVE),str(R/'student-web')],check=True)
    # New build must never mutate shared old .next files.
    shutil.rmtree(R/'student-web/.next')
    with tarfile.open('/tmp/numbering-code.tar.gz') as tar:tar.extractall(R/'code')
    for p in META['expected']:
        assert sha(R/'code'/p)==META['expected'][p]
        if p.startswith('packages/student-web/'):
            dest=R/'student-web'/Path(p).relative_to('packages/student-web')
            dest.parent.mkdir(parents=True,exist_ok=True)
            if dest.exists():dest.unlink()
            shutil.copy2(R/'code'/p,dest)
    STAGE.mkdir(parents=True)
    with tarfile.open('/tmp/numbering-course-text.tar.gz') as tar:tar.extractall(STAGE)
    spec=json.loads((R/'code/packages/student-web/src/lib/data/molecule-numbering-v2.json').read_text())
    reverse={m['old_dir'].replace('/'+m['old']+'-','/'+m['new']+'-',1):m['old_dir'] for m in spec['modules']}
    manifest=json.loads((STAGE/'manifest.json').read_text())
    for item in manifest['files']:
        dst=STAGE/item['path']
        if not dst.exists():
            old=item['path']
            for new,prior in reverse.items():
                if old.startswith(new+'/'):old=prior+old[len(new):];break
            src=COURSE/old
            assert sha(src)==item['sha256'],old
            dst.parent.mkdir(parents=True,exist_ok=True);os.link(src,dst)
        assert sha(dst)==item['sha256'] and dst.stat().st_size==item['size'],str(dst)
    save('course-before.json',hashes(COURSE))
    with tarfile.open(R/'molecule-monster-hunter.tar.gz','w:gz') as tar:tar.add(STAGE,arcname='molecule-monster-hunter')
    (R/'stage.ok').touch()
    print('Scoped frontend and exact 47-node candidate staged; live services unchanged.')
elif action=='backup':
    assert (R/'stage.ok').exists() and not (R/'backup.ok').exists()
    with sqlite3.connect('file:/root/.systemedu-library/db.sqlite?mode=ro',uri=True) as src,sqlite3.connect(R/'library-before.sqlite') as dst:src.backup(dst)
    with (R/'student-before.dump').open('wb') as f:subprocess.run(['docker','exec','systemedu-postgres','pg_dump','-U','systemedu','-d','student','-Fc'],stdout=f,check=True)
    assert (R/'student-before.dump').stat().st_size>1000
    subprocess.run(['docker','exec','-i','systemedu-postgres','pg_restore','-l'],stdin=(R/'student-before.dump').open('rb'),stdout=subprocess.DEVNULL,check=True)
    shutil.copy2('/root/.systemedu-student-secrets',R/'student-secrets-before')
    shutil.copytree('/etc/systemd/system',R/'systemd-before',symlinks=True)
    shutil.copy2('/etc/nginx/sites-available/systemedu',R/'nginx-before')
    (R/'backup.ok').touch();print('Root-only PostgreSQL, library, code, course and service backups verified.')
elif action=='prepare-memory':
    target=Path('/dev/shm/systemedu-numbering-20260914');target.mkdir(mode=0o700,exist_ok=True)
    assert shutil.disk_usage(target).free>2_000_000_000
    shutil.move(str(R/'molecule-monster-hunter.tar.gz'),target/'molecule-monster-hunter.tar.gz')
    assert shutil.disk_usage(R).free>1_300_000_000
    print('Generated import tar moved to private memory staging; disk rollback copies retained.')
elif action=='pause':
    assert (R/'build.ok').exists() and not (R/'paused.ok').exists()
    conf=Path('/etc/nginx/sites-available/systemedu');original=conf.read_text()
    shutil.copy2(conf,R/'nginx-original')
    marker='server {';assert original.count(marker)>=1
    conf.write_text(original.replace(marker,marker+'\n  # Temporary coordinated course cutover\n  if (-f /opt/systemedu/releases/numbering-v2-20260914/maintenance.flag) { return 503; }'))
    subprocess.run(['nginx','-t'],check=True)
    (R/'maintenance.flag').touch();subprocess.run(['systemctl','reload','nginx'],check=True)
    subprocess.run(['systemctl','stop','systemedu-student-worker','systemedu-student-backend','systemedu-student-web'],check=True)
    (R/'paused.ok').touch();print('Public maintenance and student write freeze active; old WebSockets closed.')
elif action=='publish':
    assert (R/'paused.ok').exists() and (R/'backup.ok').exists()
    assert hashes(COURSE)==json.loads((R/'course-before.json').read_text())
    assert os.environ.get('TMPDIR','').startswith('/dev/shm/'), 'Use checked memory staging to avoid disk exhaustion'
    from library.importer import import_tarball
    package=Path('/dev/shm/systemedu-numbering-20260914/molecule-monster-hunter.tar.gz')
    m=import_tarball(package)
    assert m.version=='0.2.0' and m.knode_count==47
    # Reuse immutable staged media after the normal verified importer succeeds.
    for item in m.files:
        dest=COURSE/item.path;src=STAGE/item.path
        if dest.suffix.lower() not in {'.wav','.mp3','.ogg','.png','.jpg','.jpeg','.webp','.mp4'}:continue
        assert sha(dest)==item.sha256==sha(src)
        temp=dest.with_name(dest.name+'.rn2');os.link(src,temp);os.replace(temp,dest)
    archive=COURSE/'_archive/molecule-monster-hunter-0.2.0.tar.gz'
    assert sha(archive)==sha(package)
    os.link(archive,R/'molecule-monster-hunter.tar.gz')
    (R/'course-live.ok').touch();print('Normal manifest-verified importer completed; content 0.2.0 / 47 nodes.')
elif action=='switch-code':
    assert (R/'paused.ok').exists() and (R/'course-live.ok').exists() and (R/'build.ok').exists()
    assert hashes(LIVE)==json.loads((R/'web-before.json').read_text())
    for p,h in META['before'].items():assert sha(ROOT/p)==h,p
    for p in META['expected']:
        if p.startswith('packages/student-app/'):
            dest=ROOT/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(R/'code'/p,dest)
    for service in ['systemedu-student-backend','systemedu-student-worker']:
        d=Path('/etc/systemd/system')/(service+'.service.d');d.mkdir(exist_ok=True)
        assert not (d/'numbering-v2.conf').exists()
        (d/'numbering-v2.conf').write_text('[Service]\nEnvironment=STUDENT_MOLECULE_NUMBERING=consecutive-v2\n')
    # Keep immutable JS from the previous build available to already-open pages.
    shutil.copytree(LIVE/'.next/static',R/'student-web/.next/static',dirs_exist_ok=True)
    LIVE.rename(R/'student-web-before');(R/'student-web').rename(LIVE)
    (R/'code-live.ok').touch();print('Versioned frontend/backend staged live; services remain paused.')
elif action=='verify':
    assert (R/'code-live.ok').exists()
    from library.manifest import load_manifest,verify_files
    from library.models import get_session,Project,Lesson
    from systemedu.student.course_numbering import verify_numbering_activation
    from systemedu.student.db import _ensure_engine
    verify_numbering_activation(_ensure_engine())
    manifest=load_manifest(COURSE/'manifest.json');assert not verify_files(manifest,COURSE)
    assert sha(COURSE/'manifest.json')=='1344a66c8f3a50b3268b9d980c8a243896b6d7b49a17b92061112e102a91d330'
    db=get_session();project=db.query(Project).filter_by(slug='molecule-monster-hunter').one()
    assert project.status.value=='published' and project.version=='0.2.0'
    lessons=db.query(Lesson).filter_by(project_slug=project.slug).all()
    assert sorted(l.knode_id for l in lessons)==[f'M{i:02}' for i in range(1,48)]
    for lesson in lessons:
        assert lesson.slides==json.loads((COURSE/lesson.knode_dir/'slides.json').read_text())['slides']
    assert sum(len(l.slides) for l in lessons)==437
    db.close()
    for p,h in META['expected'].items():assert sha(ROOT/p)==h,p
    # Other published projects and their lesson rows are byte-for-byte unchanged in SQLite.
    before=sqlite3.connect(R/'library-before.sqlite');after=sqlite3.connect('/root/.systemedu-library/db.sqlite')
    for table,col in [('projects','slug'),('lessons','project_slug')]:
        query=f'SELECT * FROM {table} WHERE {col} != ? ORDER BY 1'
        assert before.execute(query,('molecule-monster-hunter',)).fetchall()==after.execute(query,('molecule-monster-hunter',)).fetchall(),table
    save('verification.json',{'project':'molecule-monster-hunter','version':'0.2.0','numbering_version':'consecutive-v2','nodes':47,'slides':437,'other_projects_unchanged':True,'student_associations_changed':0,'build_id':(LIVE/'.next/BUILD_ID').read_text().strip(),'authenticated_student_e2e':False})
    (R/'verified.ok').touch();print((R/'verification.json').read_text())
elif action=='resume':
    assert (R/'verified.ok').exists() and (R/'maintenance.flag').exists()
    subprocess.run(['systemctl','start','systemedu-student-worker'],check=True)
    shutil.copy2(R/'nginx-original','/etc/nginx/sites-available/systemedu')
    subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
    (R/'maintenance.flag').unlink();(R/'resumed.ok').touch();print('Verified production resumed.')
elif action=='rollback':
    assert (R/'backup.ok').exists() and (R/'paused.ok').exists() and not (R/'resumed.ok').exists(), 'Rollback only inside retained write freeze'
    subprocess.run(['systemctl','stop','systemedu-student-worker','systemedu-student-backend','systemedu-student-web','systemedu-library'],check=True)
    sys.path.insert(0,str(R/'code/scripts/course_migrations'))
    from migrate_student_numbering import rollback,AUDIT,MIGRATION
    from systemedu.student.db import _ensure_engine
    from sqlalchemy import inspect,text
    engine=_ensure_engine()
    with engine.connect() as conn:
        applied=AUDIT in inspect(conn).get_table_names() and conn.execute(text('SELECT count(*) FROM course_numbering_migrations WHERE migration_id=:id'),{'id':MIGRATION}).scalar()>0
    if applied:rollback(engine)
    COURSE.rename(R/'course-failed');subprocess.run(['cp','-al',str(R/'course-before'),str(COURSE)],check=True)
    library_db=Path('/root/.systemedu-library/db.sqlite')
    for suffix in ['', '-wal','-shm']:
        p=Path(str(library_db)+suffix)
        if p.exists():p.rename(R/('library-failed.sqlite'+suffix))
    shutil.copy2(R/'library-before.sqlite',library_db)
    app=ROOT/'packages/student-app';app.rename(R/'student-app-failed');shutil.copytree(R/'student-app-before',app)
    if (R/'student-web-before').exists():LIVE.rename(R/'student-web-failed');(R/'student-web-before').rename(LIVE)
    for service in ['systemedu-student-backend','systemedu-student-worker']:
        p=Path('/etc/systemd/system')/(service+'.service.d/numbering-v2.conf')
        if p.exists():p.rename(R/(service+'-failed-numbering.conf'))
    shutil.copy2(R/'nginx-original','/etc/nginx/sites-available/systemedu')
    subprocess.run(['systemctl','daemon-reload'],check=True)
    subprocess.run(['systemctl','start','systemedu-library','systemedu-student-backend','systemedu-student-web','systemedu-student-worker'],check=True)
    subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
    (R/'rolled-back.ok').touch();print('Exact course/DB/code rollback restored under write freeze.')
else:raise SystemExit('Unknown explicit release step')
