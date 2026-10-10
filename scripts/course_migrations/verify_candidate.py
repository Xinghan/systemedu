"""Read-only candidate verification; writes a reproducible QA receipt, never production."""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from html.parser import HTMLParser
from molecule_numbering import ROOT, CANONICAL, ID_MAP, PATH_MAP, TOKEN, sha, rewrite_html

class Geometry(HTMLParser):
 def __init__(self):super().__init__();self.paths=[]
 def handle_starttag(self,tag,attrs):
  if tag=='path':self.paths.extend(v for k,v in attrs if k=='d')

def html_values(doc):
 if isinstance(doc,str) and ('<svg' in doc or '<script' in doc):yield doc
 elif isinstance(doc,dict):
  for value in doc.values():yield from html_values(value)
 elif isinstance(doc,list):
  for value in doc:yield from html_values(value)

def verify(candidate, source_root=CANONICAL):
 manifest=json.loads((candidate/'manifest.json').read_text());source=json.loads((source_root/'manifest.json').read_text())
 assert source['version']=='0.1.0','Pass --source pointing to the retained legacy-v1 snapshot after activation'
 assert manifest['version']=='0.2.0' and manifest['knode_count']==47
 assert [n['module_id'] for n in manifest['knodes']]==[f'M{i:02}' for i in range(1,48)]
 files={f['path']:f for f in manifest['files']};media_count=0;geometry_count=0;slides=0;per_node={}
 for old_entry in source['files']:
  old=old_entry['path']
  if old.startswith('_archive/'):continue
  src=source_root/old;raw=src.read_bytes();assert sha(raw)==old_entry['sha256'],('source changed',old)
  new=next((b+old[len(a):] for a,b in PATH_MAP.items() if old==a or old.startswith(a+'/')),old)
  dst=candidate/new;data=dst.read_bytes();assert sha(data)==files[new]['sha256'] and len(data)==files[new]['size'],new
  if src.suffix not in {'.json','.md','.html','.txt'}:assert raw==data,new;media_count+=1
  if src.suffix=='.json':
   before=json.loads(raw);after=json.loads(data)
   for a,b in zip(html_values(before),html_values(after),strict=True):
    ga,gb=Geometry(),Geometry();ga.feed(a);gb.feed(b);assert ga.paths==gb.paths,('geometry',new);geometry_count+=len(ga.paths)
   if src.name=='slides.json':
    a=before.get('slides',[]) if isinstance(before,dict) else before;b=after.get('slides',[]) if isinstance(after,dict) else after
    assert len(a)==len(b);slides+=len(b);per_node[new.split('/')[1].split('-')[0]]=len(b)
    for x,y in zip(a,b):
     assert x.get('slide_id')==y.get('slide_id') and x.get('lesson_anchor')==y.get('lesson_anchor'),new
     if x.get('audio_script')!=y.get('audio_script'):assert not y.get('audio_path'),new
     # Applying the HTML transform to the ORIGINAL must exactly match the candidate.
   # This verifies embedded animation text and geometry together, not global regex.
   for a,b in zip(html_values(before),html_values(after),strict=True):assert rewrite_html(a)==b,('html translation',new)
 tree=json.loads((candidate/'tree/knowledge_tree.json').read_text());ids=set(ID_MAP.values())
 for i,m in enumerate(tree['modules'],1):
  assert m['module_id']==f'M{i:02}' and m['sequence_order']==i
  assert set(m.get('depends_on',[]))<=ids
 assert len(per_node)==47
 receipt={'project':'molecule-monster-hunter','numbering_version':'consecutive-v2','candidate':str(candidate),'modules':47,'slides':slides,'slides_per_node':per_node,'immutable_media_verified':media_count,'svg_paths_unchanged':geometry_count,'manifest_sha256':sha((candidate/'manifest.json').read_bytes()),'source_untouched':True,'production_migrated':False}
 (candidate.parent/'verification.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
 return receipt
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('candidate',type=Path);p.add_argument('--source',type=Path,default=CANONICAL);a=p.parse_args();print(json.dumps(verify(a.candidate.resolve(),a.source.resolve()),ensure_ascii=False,indent=2))
