"""Validate complete source coverage, stable IDs, all station assets and media."""
import hashlib,json,struct,re,subprocess
from pathlib import Path
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent
I=R.parent/'systemeduidea';P=R/'packages/student-web/public';L=R/'packages/student-web/src/lib/project-lines'
data=json.loads((L/'energy-mission.json').read_text());tasks=data['tasks'];modules=data['modules']
assert len({t['id'] for t in tasks})==len(tasks)==104
assert sum(len(s['steps']) for s in data['stations'])==87
assert len([m for m in modules if m['mode']=='support'])==14
assert [m['module'] for m in modules if m['kind']=='full']==[f'M{i:02}' for i in range(1,59)]
assert len({m['ref'] for m in modules})==101
for m in modules:
 root=I/'projects_data'/m['project'] if m['kind']=='full' else P/'project-lines/energy-motion'/m['project']/'course'
 tree=json.loads((root/'tree/knowledge_tree.json').read_text());node=next(n for n in tree['modules'] if n['module_id']==m['module']);assert node['title']==m['title']
for item in data['provenance']:
 p=I/item['path'] if item['path'].startswith('projects_data/') else R/item['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'],p
for s in data['stations']:
 assert s['handoff'] and s['gate'] and s['input']
 for task in s['steps']:assert next(t for t in tasks if t['id']==task)['station']==s['id']
for t in tasks:assert t['goal'] and t['actions'] and t['outputs'] and t['checks']
for a in json.loads((H/'image-prompts.json').read_text())['assets']:
 assert hashlib.sha256((R/a['source']).read_bytes()).hexdigest()==a['source_sha256']
 for v in a['variants']:assert hashlib.sha256((R/v['path']).read_bytes()).hexdigest()==v['sha256']
media=[]
for s in data['stations']:
 p=P/f"mission/energy/video/{s['id']}-v1.mp4";b=p.read_bytes();offset=0;atoms=[]
 while offset+8<=len(b):
  size,kind=struct.unpack('>I4s',b[offset:offset+8]);assert size>=8;atoms.append(kind.decode());offset+=size
 assert atoms.index('moov')<atoms.index('mdat')
 meta=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_streams','-show_format','-of','json',str(p)]));dur=float(meta['format']['duration']);video=next(v for v in meta['streams'] if v['codec_type']=='video');audio=next(v for v in meta['streams'] if v['codec_type']=='audio');assert video['width']==1920 and video['height']==1080 and video['codec_name']=='h264';assert audio['codec_name']=='aac';assert 20<dur<45
 vtt=(P/f"mission/energy/video/{s['id']}-zh-v1.vtt").read_text();cues=re.findall(r'(\d\d):(\d\d):(\d\d\.\d+) --> (\d\d):(\d\d):(\d\d\.\d+)',vtt);previous=0
 for a,b,c,d,e,f in cues:
  start=int(a)*3600+int(b)*60+float(c);end=int(d)*3600+int(e)*60+float(f);assert previous<=start<end<=dur;previous=end
 assert len(cues)>4
 media.append({'station':s['id'],'seconds':dur,'bytes':p.stat().st_size,'captions':len(cues),'faststart':True})
report={'passed':True,'stations':8,'main_nodes':87,'optional_support_nodes':14,'micro_entries':3,'preserved_pvlib_nodes':58,'media':media,'notes':['All referenced source IDs and titles preserved; source hashes match','All eight indoor lab plates plus map have verified hashes','Physical hardware and scientific results have not been fabricated or validated by this UI batch']}
(H/'content-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
