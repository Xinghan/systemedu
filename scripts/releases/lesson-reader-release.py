"""Scoped reader deployment. Production code and content remain on server."""
import hashlib,json,re,subprocess,sys
from collections import Counter
from pathlib import Path
R=Path('/opt/systemedu/releases/lesson-reader-20260909')
LIVE=Path('/opt/systemedu/packages/student-web')
COURSE=Path('/root/.systemedu-library/media/projects/molecule-monster-hunter')
P=json.loads((R/'delta.json').read_text())
ALLOWED=set(P['files'])|{p['file'] for p in P['patches']}|{P['teacher']['file']}
def sha(b): return hashlib.sha256(b).hexdigest()
def hashes(root):
    return {p.relative_to(root).as_posix():sha(p.read_bytes()) for p in root.rglob('*') if p.is_file() and not {'node_modules','.next','.git'}.intersection(p.parts) and p.name!='tsconfig.tsbuildinfo'}
def save(name,obj): (R/name).write_text(json.dumps(obj,indent=2))
def changes(root):
    before=json.loads((R/'web-before.json').read_text());after=hashes(root)
    changed={p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}
    assert changed<=ALLOWED, 'Non-whitelisted frontend changes'
    return after,sorted(changed)
def verify_reader_source(root):
    course=(root/'src/components/learning/course-content-view.tsx').read_text()
    assert course.count('<LessonSlideCarousel />')==1,'Expected one carousel'
    assert all(name not in course for name in ['sceneMode','setSceneMode','onSwitchScene','LessonSlideSlot']),'Legacy scene binding remains'
    assert '<LessonSlideshowButton />' in course and 'max-w-6xl' in course
    assert 'slides: normalizeSlides(k.slides, k.knode_id)' in (root/'src/lib/api/gateway.ts').read_text()
action=sys.argv[1];root=Path(sys.argv[2]) if len(sys.argv)>2 else LIVE
if action=='baseline':
    assert not (R/'web-before.json').exists()
    save('web-before.json',hashes(LIVE));save('course-before.json',hashes(COURSE))
    save('build-before.json',{'id':(LIVE/'.next/BUILD_ID').read_text().strip()})
    print('Production baselines retained on server.')
elif action=='patch':
    for entry in P['patches']:
        file=root/entry['file'];s=file.read_text()
        duplicates=Counter(c['before'] for c in entry['chunks'])
        for i,c in enumerate(entry['chunks']):
            count=s.count(c['before'])
            if count:
                assert count<=duplicates[c['before']],f'Unexpected duplicate context: {entry["file"]} hunk {i}'
                s=s.replace(c['before'],c['after'])
            elif c['after'] in s: pass
            else: raise SystemExit(f'Patch context mismatch: {entry["file"]} hunk {i}')
        file.write_text(s)
    t=P['teacher'];f=root/t['file'];s=f.read_text();assert s.count(t['marker'])==1
    tail=t['marker']+s.split(t['marker'],1)[1]
    save('teacher-tail.json',{'sha256':sha(tail.encode()),'matches_local_review':sha(tail.encode())==P['expectedLocalTeacherTail']})
    f.write_text(t['prefix']+tail)
    for file,content in P['files'].items():
        f=root/file;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(content)
    verify_reader_source(root)
    after,changed=changes(root);save('web-expected.json',after);save('changed-files.json',changed)
    print(json.dumps({'changed_files':changed,'slide_body_preserved':True,'teacher_tail_matches_local':sha(tail.encode())==P['expectedLocalTeacherTail']}))
elif action=='pre-switch':
    verify_reader_source(root)
    assert hashes(LIVE)==json.loads((R/'web-before.json').read_text()),'Live frontend changed during build'
    assert hashes(COURSE)==json.loads((R/'course-before.json').read_text()),'Course changed during build'
    assert hashes(root)==json.loads((R/'web-expected.json').read_text()),'Staged sources changed during build'
    print('Pre-switch source and course checks passed.')
elif action=='types':
    diagnostics=[]
    for name,directory in [('before',LIVE),('after',R/'student-web')]:
        run=subprocess.run([str(directory/'node_modules/.bin/tsc'),'--noEmit','--pretty','false','--incremental','false'],cwd=directory,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        (R/f'types-{name}.log').write_text(run.stdout)
        assert run.returncode in (0,2),'Type checker execution failed'
        diagnostics.append(Counter(re.sub(r'\(\d+,\d+\)', '', line) for line in run.stdout.splitlines() if ': error TS' in line))
    added=list((diagnostics[1]-diagnostics[0]).elements())
    result={'baseline_diagnostics':sum(diagnostics[0].values()),'candidate_diagnostics':sum(diagnostics[1].values()),'new_diagnostics':added}
    save('types-comparison.json',result);print(json.dumps(result))
    assert not added,'New TypeScript diagnostics in candidate'
    (R/'types.ok').touch()
elif action=='verify':
    actual,changed=changes(root);assert actual==json.loads((R/'web-expected.json').read_text())
    assert hashes(COURSE)==json.loads((R/'course-before.json').read_text()),'Course changed'
    teacher=(root/P['teacher']['file']).read_text();tail=P['teacher']['marker']+teacher.split(P['teacher']['marker'],1)[1]
    assert sha(tail.encode())==json.loads((R/'teacher-tail.json').read_text())['sha256']
    verify_reader_source(root)
    result={'build_id':(root/'.next/BUILD_ID').read_text().strip(),'changed_files':changed,'course_unchanged':True,'existing_slide_renderers_unchanged':True,'single_carousel':True}
    save('verification.json',result);print(json.dumps(result))
else: raise SystemExit('Unknown action')
