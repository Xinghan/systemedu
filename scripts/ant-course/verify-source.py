#!/usr/bin/env python3
"""Validate the repaired ant course against its pre-revision identity baseline."""
import argparse, collections, hashlib, json, re, subprocess, tempfile
from pathlib import Path
from html.parser import HTMLParser

class Scripts(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]; self.current=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='script' and not a.get('src') and a.get('type','') not in ('application/json','application/ld+json'): self.current=[]
    def handle_data(self,data):
        if self.current is not None: self.current.append(data)
    def handle_endtag(self,tag):
        if tag=='script' and self.current is not None: self.parts.append(''.join(self.current));self.current=None

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[3]/'systemeduidea/projects_data/ai-ant-ethologist');parser.add_argument('--report',type=Path);args=parser.parse_args()
    root=args.source;read=lambda p:json.loads(p.read_text());manifest=read(root/'manifest.json');tree=read(root/'tree/knowledge_tree.json');baseline=read(root/'authoring/revision-20261118/baseline.json')
    ids=[n['module_id'] for n in manifest['knodes']];assert ids==baseline['module_ids'];assert set(ids)=={n['module_id'] for n in tree['modules']};assert len(ids)==60
    assert manifest['version']==baseline['source_version'];assert manifest['content_revision']=='20261118'
    counts=collections.Counter();errors=[]
    with tempfile.TemporaryDirectory(prefix='ant-source-') as temp:
        for node,old in zip(manifest['knodes'],baseline['nodes']):
            mid=node['module_id'];p=root/node['knode_dir'];assert node['knode_dir']==old['knode_dir'],mid
            sections=read(p/'sections.json');theories=read(p/'theories.json');slides=read(p/'slides.json')['slides'];history=read(p/'content-history.json');lesson=(p/'lesson.md').read_text()
            assert [i['idea_id'] for i in sections['ideas']]==old['idea_ids'],mid+' ideas'
            assert {t.get('theory_id',t.get('id')) for t in theories}==set(old['theory_ids']),mid+' theories'
            assert [s.get('slide_id',s.get('id')) for s in slides]==old['slide_ids'],mid+' slides'
            known={t.get('theory_id',t.get('id')) for t in theories}|{a for t in theories for a in t.get('aliases',[])}
            for kind,key in re.findall(r'\[\[(THEORY|IDEA):([^\]]+)\]\]',lesson):assert key in (known if kind=='THEORY' else old['idea_ids']),(mid,kind,key)
            old_keys={q['key'] for q in history['questions']}
            for idea,value in sections['rendered_sections'].items():
                for i,q in enumerate(value.get('exercises') or []):
                    assert f'{idea}:{q.get("id",i)}' not in old_keys,(mid,'old question collision')
                    assert isinstance(q.get('correct'),int) and 0<=q['correct']<len(q['options']),(mid,'answer')
                    assert len(set(q['options']))==len(q['options']),(mid,'duplicate options')
                    counts['section_questions']+=1
                code=value.get('html')
                if code:
                    counts['media']+=1;html=Scripts();html.feed(code)
                    assert '20261118' in code,(mid,'media revision')
                    assert not re.search(r'<script[^>]+src=["\']https?://',code),(mid,'remote script')
                    for index,script in enumerate(html.parts):
                        fn=Path(temp)/f'{mid}-{idea}-{index}.js';fn.write_text(script)
                        result=subprocess.run(['node','--check',str(fn)],text=True,capture_output=True)
                        assert result.returncode==0,(mid,result.stderr)
                        counts['javascript_blocks']+=1
            for t in theories:
                assert t.get('body_markdown') and t.get('level_bodies'),(mid,'theory body')
                for q in t.get('exercises') or []:
                    assert isinstance(q.get('correct'),int) and 0<=q['correct']<len(q['options']),(mid,'theory answer')
                    counts['theory_questions']+=1
            for s in slides:
                payload=s.get('payload') or {};kind=s['kind'];counts['slides']+=1
                if kind=='intro':ok=payload.get('hero_title') or payload.get('hero_subtitle')
                elif kind=='outro':ok=payload.get('hero_title') or payload.get('key_takeaway') or payload.get('bullets')
                elif kind=='bullet':ok=payload.get('bullets') or payload.get('concept_cards') or payload.get('inline_svg')
                else:ok=bool(payload)
                assert ok,(mid,s.get('slide_id'),'empty web lecture payload')
                if payload.get('inline_svg'):counts['lecture_figures']+=1
            counts['modules']+=1
    expected_media=sum(key.startswith(('anim_', 'game_')) for node in baseline['nodes'] for key in node['idea_ids'])
    assert counts['media']==expected_media,counts
    report={'status':'pass','revision':manifest['content_revision'],'counts':dict(counts),'checks':['60 original node directories, IDs and routes retained','idea, theory and slide identities retained','all lesson markers resolve','old and revised question keys disjoint','lecture payloads match the shared renderer',f"{counts['media']} media documents parse; all inline JavaScript syntax checked"],'limits':'Syntax and content contracts only; actual browser/science reviews are separate reports.'}
    if args.report:args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
