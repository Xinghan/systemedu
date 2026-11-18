#!/usr/bin/env python3
"""Export the SAME course sources into an offline, versioned mobile catalog.
No content generation. Missing nodes/files fail the build. Generated output is ignored.
"""
from pathlib import Path
import argparse, hashlib, json, os, re, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor
from catalog_presentation import prepare_presentations
from ios_media import read_variants

REPO = Path(__file__).resolve().parents[3]
PUBLIC = REPO / 'packages/student-web/public'
LIB = REPO / 'packages/student-web/src/lib/project-lines'

def read(p, default=None):
    return json.loads(p.read_text()) if p.is_file() else default

def digest(b): return hashlib.sha256(b).hexdigest()
def write(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')))
def zh(value): return value.get('zh', '') if isinstance(value, dict) else value or ''
def safe(root, relative):
    p = (root / relative).resolve()
    if not p.is_relative_to(root.resolve()) or not p.is_file(): raise ValueError(f'Missing/unsafe content: {p}')
    return p

def export(source, out, *, preview_ios_drafts=False):
    courses, source_files, gaps = [], {}, []
    ios_coverage = []
    ios_assets = set()
    # Narration WAVs are derived into AAC, not copied as multi-gigabyte studio masters.
    cache=REPO/'packages/ios-app/build/narration-cache';cache.mkdir(parents=True,exist_ok=True)
    audio={}
    def transcode(p):
        signature=digest(p.read_bytes());target=cache/(signature+'.m4a')
        if not target.exists():
            temporary=cache/(signature+'.tmp.m4a')
            subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(p),'-vn','-ac','1','-c:a','aac','-b:a','64k',str(temporary)],check=True)
            temporary.replace(target)
        return p,target
    narration=list(source.glob('*/knodes/*/audio/*.wav'))
    if narration:
        if not shutil.which('ffmpeg'): raise ValueError('ffmpeg is required to prepare mobile narration')
        with ThreadPoolExecutor(max_workers=6) as workers:
            audio=dict(workers.map(transcode,narration))
        print(f'Prepared {len(audio)} AAC narration files',flush=True)
    def track(p):
        b=p.read_bytes(); source_files[str(p.relative_to(source)) if p.is_relative_to(source) else str(p.relative_to(REPO))]=digest(b)
        return b
    def copy(p, rel):
        target=out/rel; target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(p,target)
        return '/'+rel
    lines=read(LIB/'taxonomy-lines.json'); taxonomy=read(LIB/'project-taxonomy.json')
    def line(slug, fallback):
        field=taxonomy.get(slug,{}).get('primary')
        return next((x['id'] for x in lines if x['fieldId']==field), fallback)
    def finish(slug,title,version,line_id,kind,stages,modules,root,source_route,revision=None):
        if not modules: raise ValueError(f'Empty course {slug}')
        if len({m['module_id'] for m in modules})!=len(modules): raise ValueError(f'Duplicate nodes {slug}')
        index=[]
        for m in modules:
            m.update(course_id=slug,content_version=str(version))
            # Source IDs are retained; content version isolates changed numbering/meaning.
            activity=f'course:{slug}:{version}:{m["module_id"]}'
            if not re.fullmatch(r'[A-Za-z0-9_.:-]+',activity): raise ValueError(activity)
            path=f'content/modules/{digest(activity.encode())[:24]}.json'
            write(out/path,m)
            index.append(dict(id=activity,moduleId=m['module_id'],title=m['title'],stage=m.get('stage_id',''),path='/'+path,minutes=m.get('estimated_minutes') or 0,dependsOn=m.get('depends_on',[])))
        c=dict(id=slug,title=title,version=str(version),lineId=line_id,kind=kind,stages=[dict(id=s.get('stage_id',s.get('id','')),title=s.get('title','')) for s in stages],modules=index,sourceRoute=source_route)
        if revision: c['contentRevision']=revision
        courses.append(c)
    def assets(root, slug):
        # Only curriculum artifacts: never build caches, credentials, tooling or private files.
        allowed={'.md','.json','.html','.css','.js','.png','.jpg','.jpeg','.webp','.svg','.glb','.gltf','.bin','.wasm','.woff','.woff2','.ttf','.mp3','.m4a','.wav','.mp4','.vtt','.pdf','.csv','.ipynb','.py','.scad','.stl','.zip','.txt'}
        for p in root.rglob('*'):
            if not p.is_file() or p.suffix.lower() not in allowed: continue
            rel=p.relative_to(root)
            if any(x.startswith('.') or x in {'authoring','archive','archives','node_modules','__pycache__','build','dist','verification','_review'} for x in rel.parts): continue
            if any(rel.parts[i:i+2] == ('mobile','ios') for i in range(len(rel.parts)-1)) and p not in ios_assets: continue
            if p.is_symlink(): raise ValueError(f'Symlink not allowed: {p}')
            copy(audio.get(p,p),f'content/assets/{slug}/{rel.with_suffix(".m4a") if p in audio else rel}')
    def family(line_id, slug):
        return {'space-exploration':'space','biomedicine':'biomed','neuro-bionics':'bionics','earth-discovery':'earth'}.get(line_id, 'energy' if slug in {x['id'] for x in read(LIB/'energy-courses.json')} else 'renewable')
    # Full courses use current trees, not stale discovery counts or filenames inferred from IDs.
    for tree_path in sorted(source.glob('*/tree/knowledge_tree.json')):
        root=tree_path.parent.parent; slug=root.name; tree=read(tree_path); manifest=read(root/'manifest.json')
        if not manifest: raise ValueError(f'Manifest missing: {slug}')
        track(tree_path);track(root/'manifest.json')
        mapping={x['module_id']:x for x in manifest['knodes']}; modules=[]
        for node in tree['modules']:
            mid=node['module_id']; info=mapping.get(mid)
            if not info: raise ValueError(f'No manifest mapping: {slug}/{mid}')
            directory=root/info['knode_dir']; lesson=directory/'lesson.md'; assignment=safe(directory,'assignment.md')
            if not lesson.is_file(): gaps.append(dict(course=slug,module=mid,kind='assignment_only',detail='源节点只有作业，保留为实践任务，不编造课文'))
            m=dict(node,lesson=track(lesson).decode() if lesson.is_file() else track(assignment).decode(),assignment=track(assignment).decode(),content_status='lesson' if lesson.is_file() else 'assignment_only',asset_base=f'/content/assets/{slug}/{info["knode_dir"]}/',resources=[],interactions=[])
            for name in ['theories','slides','audio_scripts']:
                p=directory/f'{name}.json'; m[name]=read(p,[])
                if p.is_file(): track(p)
            # Historic course sources use both id and theory_id. Keep their stable
            # identity while presenting one shape to the shared mobile reader.
            for theory in m['theories']:
                theory['theory_id'] = theory.get('theory_id') or theory.get('id')
                if not theory['theory_id']:
                    raise ValueError(f'Missing theory ID: {slug}/{mid}')
            history_path = directory/'content-history.json'
            if history_path.is_file():
                m['content_history'] = read(history_path)
                track(history_path)
            # A source revision alone is descriptive metadata. Reset completion
            # only when an authored history explicitly preserves the old edition.
            if manifest.get('content_revision') and history_path.is_file():
                m['content_revision'] = manifest['content_revision']
            if isinstance(m['slides'],dict): m['slides']=m['slides'].get('slides',[])
            for slide in m['slides']:
                audio_path=slide.get('audio_path')
                if audio_path and ((root/audio_path) in audio or (directory/audio_path) in audio): slide['audio_path']=audio_path.removesuffix('.wav')+'.m4a'
            sections=read(directory/'sections.json',{})
            if (directory/'sections.json').is_file(): track(directory/'sections.json')
            ios_variants, ios_sources, ios_status = read_variants(directory, sections, slug, mid, preview=preview_ios_drafts)
            for p in ios_sources: track(p)
            for variant in ios_variants.values(): ios_assets.update(directory/'mobile/ios'/relative for relative in variant['files'])
            ios_coverage.extend(dict(course=slug,module=mid,idea_id=key,status=status) for key,status in ios_status.items())
            for key, item in sections.get('rendered_sections',{}).items():
                entry=dict(id=key,title=next((i.get('topic') for i in sections.get('ideas',[]) if i.get('idea_id')==key),item.get('caption') or '互动学习'),mode=item.get('mode'),exercises=item.get('exercises') or [])
                html=item.get('html')
                if html:
                    filename=f'content/assets/{slug}/{info["knode_dir"]}/mobile-{key}.html'
                    target=out/filename;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(html.replace('<head>', '<head><script src="/content-frame.js"></script>',1) if '<head>' in html else '<script src="/content-frame.js"></script>'+html)
                    entry['path']='/'+filename
                elif item.get('html_path'): entry['path']=m['asset_base']+item['html_path']
                if key in ios_variants:
                    variant=ios_variants[key]
                    entry.update(path=m['asset_base']+variant['path'],presentation_platform='ios',presentation_revision=variant['revision'],state_key=variant['state_key'])
                m['interactions'].append(entry)
            m['external_resources']=sections.get('external_resources',{})
            record_path=directory/'learning-record.json'
            if record_path.exists():
                record=read(record_path);track(record_path)
                m['response_prompts']=record.get('response_prompts',[])
                m['foundations']=record.get('foundations',[])
                m['resources']+=record.get('resources',[])
                m['assessments']=[dict(id='quiz',title='理解自测',questions=record.get('quiz',[])),dict(id='exam',title='阶段检验',questions=record.get('exam',[]))]
            m['downloads']=[dict(title=p.name,url=f'/content/assets/{slug}/'+str(p.relative_to(root))) for p in sorted((root/'downloads').glob('*')) if p.is_file()]
            modules.append(m)
        assets(root,slug)
        # Preserve formal source downloads and all module files; generated HTML avoids JSON copies in runtime memory.
        revision=manifest.get('content_revision') if any(m.get('content_history') for m in modules) else None
        finish(slug,tree.get('title') or manifest.get('title_zh') or manifest['title'],manifest['version'],line(slug,'earth-discovery'),'full',tree['stages'],modules,root,f'/projects/{slug}',revision)
    # Guided courses include retained v1 routes as their own edition, never overwrite current nodes.
    for tree_path in sorted(PUBLIC.glob('project-lines/*/*/course*/tree/knowledge_tree.json')):
        root=tree_path.parent.parent;tree=read(tree_path);track(tree_path)
        slug=tree['id']+('-legacy-v1' if root.name=='course-v1' else '');modules=[]
        for node in tree['modules']:
            m=dict(node)
            for name in ['lesson','assignment']:
                p=safe(root,node[name]);m[name]=track(p).decode()
            resource=safe(root,node['resources']);m['resources']=read(resource,[]);track(resource)
            if isinstance(m['resources'],dict): m['resources']=m['resources'].get('resources',[])
            m.update(asset_base=f'/project-lines/{tree_path.parts[-5]}/{tree["id"]}/{root.name}/',theories=[],slides=[],interactions=[dict(id='workspace',title='本节实验工作台',mode='lab',exercises=[],path=f'/embedded.html?project={slug}&family={family(tree_path.parts[-5],tree["id"])}&node={node["module_id"]}&version={tree["version"]}')],lab_url=None)
            modules.append(m)
        finish(slug,tree['title']+('（旧版）' if root.name=='course-v1' else ''),tree['version'],line(tree['id'],tree_path.parts[-5]),'guided',tree['stages'],modules,root,f'/explore/{tree_path.parts[-5]}/{tree["id"]}')
    # Independent professional course stays separate from SystemEdu project lines.
    root=REPO/'standalone-courses/llm-post-training';d=read(root/'course.json');modules=[]
    for node in d['modules']:
        p=root/'nodes'/f'{node["id"]}.md';track(p)
        modules.append(dict(node,module_id=node['id'],stage_id='course',lesson=p.read_text(),assignment='',asset_base='/standalone/post-training/',theories=[],interactions=[dict(id=k,title=k+' · 算法推演',mode='lab',exercises=[],path=f'/embedded.html?family=post-training&algorithm={k}') for k in re.findall(r'\[\[LAB:([a-z0-9]+)\]\]',p.read_text())],resources=node.get('videos',[])+node.get('reading',[])))
    finish(d['id'],d['title'],d['version'],'independent','standalone',[dict(stage_id='course',title='专业课程')],modules,root,'/standalone/post-training')
    micro_projects=[]
    for name in ['renewable','energy','bionics','earth','biomed']:
        micro_projects += [x for x in read(LIB/f'{name}-courses.json',[]) if x['kind']=='micro']
    micro_projects += [dict(id=id,lineId='space-exploration',title=title,action=action,outcome=outcome) for id,title,action,outcome in [
        ('spot-a-world','我的第一张星球照片','移动望远镜，选择月球或火星，拍下属于你的构图。','一张星球照片与观测记录'),
        ('land-a-probe','把探测器稳稳送下去','改变制动时机，观察下降、重试并比较两次着陆。','自己的着陆轨迹与对比记录'),
        ('drive-and-frame','开车找到观察点','驾驶探测车绕过岩石，调整镜头拍下地形。','自己驾驶的路线与地形照片')]]
    for project in micro_projects:
        slug=project['id'];lid=project['lineId'];title=zh(project['title'])
        lab=f'/project-lines/{lid}/{slug}/index.html' if lid=='space-exploration' else f'/embedded.html?project={slug}&family={family(lid,slug)}&micro=1'
        node=dict(module_id='M01',title=title,stage_id='try',lesson=f'# {title}\n\n{zh(project.get("action"))}\n\n[[IDEA:workspace]]\n\n## 我的作品\n\n{zh(project.get("outcome"))}',assignment='',asset_base=f'/project-lines/{lid}/{slug}/',resources=[],theories=[],slides=[],interactions=[dict(id='workspace',title=title,mode='lab',path=lab,exercises=[])])
        finish(slug,title,'1.0',line(slug,lid),'micro',[dict(stage_id='try',title='动手探索')],[node],PUBLIC,f'/explore/{lid}/{slug}')
    finish('transformer-lab','Transformer · 交互模型实验室','1.0','independent','standalone',[dict(stage_id='model',title='从模型理解算法')],[dict(module_id='M01',title='从总览到 Transformer 的内部计算',stage_id='model',lesson='# Transformer 交互模型实验室\n\n从整体结构图开始，点击各个模块，逐步理解张量、注意力和前馈网络。模型内保留数学下钻、概念练习与 Python 实验。\n\n[[IDEA:model]]',assignment='',asset_base='/standalone/transformer-lab/',theories=[],slides=[],resources=[dict(title='课后编程项目',url='/standalone/transformer-lab/attention-project.zip')],interactions=[dict(id='model',title='打开 Transformer 交互模型',mode='lab',path='/embedded.html?family=transformer',exercises=[])])],PUBLIC,'/standalone/transformer-lab')
    # Preserve static labs, official kits, covers and mission arrival films verbatim.
    for directory in ['project-lines','project-covers','mission','vendor','standalone']:
        if (PUBLIC/directory).exists(): shutil.copytree(PUBLIC/directory,out/directory,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.DS_Store'))
    for html in out.rglob('*.html'):
        if html.name in {'index.html','embedded.html'} and html.parent==out: continue
        text=html.read_text(errors='replace')
        if '/content-frame.js' not in text:
            script='<script src="/content-frame.js"></script>'
            html.write_text(text.replace('<head>', '<head>'+script,1) if '<head>' in text else script+text)
    lines=[dict(id=x['id'],title=zh(x['title']),description=zh(x['description'])) for x in lines]+[dict(id='independent',title='独立专业课程',description='后训练与 Transformer 学习')]
    film_groups={}
    for f in ['robotics','energy','biomed']:
        film_groups[f]=read(LIB/f'{f}-stage-films.json',[])
    film_groups.update(read(LIB/'remaining-stage-films.json',{}))
    films=[]
    for folder in sorted((PUBLIC/'mission').glob('*/video')):
        current={}
        for p in sorted(folder.glob('*.mp4')):
            stem=re.sub(r'-v[0-9]+$', '',p.stem);current[stem]=p
        for stem,p in current.items():
            item=next((x for x in film_groups.get(folder.parent.name,[]) if x.get('station')==stem or 'stage-'+str(x.get('level'))==stem),{})
            films.append(dict(id=f'{folder.parent.name}:{stem}',lineId={'space':'space-exploration','rover':'space-exploration','energy':'energy-motion','earth':'earth-discovery','biomed':'biomedicine','brain':'neuro-bionics','computing':'computing-ai','robotics':'robotics'}.get(folder.parent.name,folder.parent.name),title=item.get('title') or stem.replace('stage-','阶段 '),caption=item.get('brief') or item.get('dialogue',''),path='/'+str(p.relative_to(PUBLIC))))
    prepare_presentations(REPO,source,out,courses)
    catalog=dict(schemaVersion=1,lines=lines,courses=courses,films=films)
    write(out/'content/catalog.json',catalog)
    report=dict(schema_version=1,courses=len(courses),nodes=sum(len(c['modules']) for c in courses),coverage=[dict(id=c['id'],version=c['version'],nodes=[m['moduleId'] for m in c['modules']]) for c in courses],source_files=source_files,gaps=gaps)
    write(out/'content/coverage.json',report)
    write(out/'content/ios-media-coverage.json',dict(schema_version=1,preview=preview_ios_drafts,resources=ios_coverage))
    print(f'Exported {len(courses)} courses / {report["nodes"]} nodes')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=Path(os.environ.get('SYSTEMEDU_CONTENT_SOURCE',str(REPO.parent/'systemeduidea/projects_data'))));parser.add_argument('--out',type=Path,default=REPO/'packages/learning-runtime/dist')
    parser.add_argument('--preview-ios-drafts',action='store_true',help='Select draft variants for local testing only; requires a separate --out directory')
    args=parser.parse_args()
    if not args.source.is_dir(): parser.error('Set SYSTEMEDU_CONTENT_SOURCE to the shared projects_data directory')
    if args.preview_ios_drafts and (args.out.resolve()==(REPO/'packages/learning-runtime/dist').resolve() or args.out.resolve().is_relative_to((REPO/'packages/ios-app/SystemEdu/Resources').resolve())):
        parser.error('Draft previews must use a separate output directory, not production runtime or App resources')
    export(args.source,args.out,preview_ios_drafts=args.preview_ios_drafts)
