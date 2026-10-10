"""Record actual deployment receipts without relabeling historical legacy releases."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'artifacts/molecule-m08-20260914';receipt=json.loads((ART/'production-verification.json').read_text())
assert receipt['module']=='M08' and receipt['build_id']=='wePmenNJ5nB7jso6BM2a9'
COURSE=ROOT.parent/'systemeduidea/projects_data/molecule-monster-hunter'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
fixture=ROOT/'course_factory/fixtures/molecule-monster-hunter/M08-variable-consecutive-v2.json'
registry={'project':'molecule-monster-hunter','numbering_version':'consecutive-v2','module':'M08','legacy_module':'M24','node':'M08-w0-smiles','slides':[{'slide_id':s['slide_id'],'renderer':'code-trace','route':'PythonVariableVisual','states':len(s['payload']['technical_visual']['steps'])} for s in json.loads(fixture.read_text())['slides']],'source_sha256':{p.name:sha(p) for p in (ART/'before').iterdir() if p.is_file()},'deployed_sha256':{name:sha(COURSE/'knodes/M08-w0-smiles'/name) for name in ['slides.json','audio_scripts.json','lesson.md','assignment.md']},'fixture_sha256':sha(fixture),'production_deployed':True,'build_id':receipt['build_id'],'new_audio':False,'decision_record':'docs/slide-image-prompts/molecule-monster-hunter-M08-variable-v2.md'}
fixture.with_suffix('.registry.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
p=ROOT/'docs/slide-image-prompts/molecule-monster-hunter-progress.json';d=json.loads(p.read_text())
d.setdefault('historical_production_batches',[]).append(d['last_production_batch'])
current={**receipt,'modules':['M08'],'production_deployed':True,'status':'production-verified','generated_raster_images':0,'interactive_3d_pages':{},'stepwise_playback_pages':{'M08':list(range(1,9))},'record':'docs/deployments/2026-09-14-m08-variable.md'}
d['current_batch']=current;d['last_production_batch']=current;d['next_recommended_nodes']=['M09'];d['updated']='2026-09-14'
d['entries'].append({'module':'M08','numbering_version':'consecutive-v2','legacy_module':'M24','node':'M08-w0-smiles','slides':8,'status':'production-verified','production_deployed':True,'draft':str(fixture.relative_to(ROOT)),'draft_sha256':sha(fixture),'deployment':current['record'],'note':'8 页 / 35 个精确 Python 状态；浅色 HTML 动态，无新增图片/3D，新讲稿未配音。'})
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
generation=json.loads((ART/'generation.json').read_text());generation.update(production_deployed=True,build_id=receipt['build_id']);(ART/'generation.json').write_text(json.dumps(generation,ensure_ascii=False,indent=2)+'\n')
(ART/'browser-verification.json').write_text(json.dumps({'slides':8,'viewports':['default desktop','520x850'],'checks':['all final outputs','no horizontal overflow','NameError CCO','NameError Smiles','reassignment intermediate state','play to completion','pause','reset'],'console_errors':0,'authenticated_production_e2e':False},ensure_ascii=False,indent=2)+'\n')
print('M08 registry, production ledger and next consecutive node M09 recorded.')
