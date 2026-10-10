"""One-way, versioned course candidate builder. Never edits its input or production."""
from __future__ import annotations
import argparse, copy, hashlib, html, json, os, re, subprocess
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CANONICAL=ROOT.parent/"systemeduidea/projects_data/molecule-monster-hunter"
MAP_FILE=ROOT/"packages/student-web/src/lib/data/molecule-numbering-v2.json"
SPEC=json.loads(MAP_FILE.read_text())
SLUG=SPEC["project"]
VERSION=SPEC["version"]
ID_MAP={m["old"]:m["new"] for m in SPEC["modules"]}
PATH_MAP={m["old_dir"]:m["old_dir"].replace("/"+m["old"]+"-","/"+m["new"]+"-",1) for m in SPEC["modules"]}
REF_MAP={old:ID_MAP[parent] for old,parent in (SPEC["merged_references"]|SPEC.get("retired_reference_redirects",{})).items()}|ID_MAP
TOKEN=re.compile(r"(?<![A-Za-z0-9])M\d{2,3}b?(?![A-Za-z0-9])")
TEXT_EXT={".json",".md",".html",".txt"}
PROTECTED_KEYS={"image_path","image_url","svg","svg_content","d","slide_id","idea_id","theory_id","hash","sha256","smiles","SMILES","canonical_smiles","source_url","sourceUrl","audio_path"}
def sha(data:bytes)->str:return hashlib.sha256(data).hexdigest()
def rewrite_text(text:str)->str:return TOKEN.sub(lambda m:REF_MAP.get(m.group(),m.group()),text)
def rewrite_path(text:str)->str:
    for old,new in PATH_MAP.items():
        if text==old or text.startswith(old+"/"):return new+text[len(old):]
    return text
@lru_cache(maxsize=256)
def rewrite_script(source):
    if not TOKEN.search(source):return source
    return subprocess.run(["node",str(ROOT/"scripts/course_migrations/rewrite_script.cjs")],input=source,text=True,capture_output=True,check=True).stdout
class VisibleHTML(HTMLParser):
    def __init__(self,source):
        super().__init__(convert_charrefs=False);self.source=source;self.edits=[];self.hidden=0;self.script=False
        self.lines=[0]
        for m in re.finditer("\n",source):self.lines.append(m.end())
    def absolute_pos(self):
        line,col=self.getpos();return self.lines[line-1]+col
    def handle_starttag(self,tag,attrs):
        if tag in {"script","style"}:self.hidden+=1
        if tag=="script":self.script=True
        raw=self.get_starttag_text();start=self.absolute_pos()
        # SVG geometry, DOM IDs, hashes and script bodies are never text-replaced.
        for match in re.finditer(r'''([\w:-]+)\s*=\s*(["'])(.*?)\2''',raw,re.S):
            key,value=match.group(1).lower(),match.group(3);new=value
            if key in {"title","alt","aria-label"}:new=rewrite_text(value)
            elif key in {"href","src"} and not re.match(r"[a-z]+:|//",value,re.I):new=rewrite_path(value)
            if new!=value:self.edits.append((start+match.start(3),start+match.end(3),new))
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag in {"script","style"}:self.hidden=max(0,self.hidden-1)
    def handle_endtag(self,tag):
        if tag in {"script","style"}:self.hidden=max(0,self.hidden-1)
        if tag=="script":self.script=False
    def handle_data(self,data):
        if self.script or not self.hidden:
            new=rewrite_script(data) if self.script else rewrite_text(data)
            if new!=data:self.edits.append((self.absolute_pos(),self.absolute_pos()+len(data),new))
def rewrite_html(source:str)->str:
    p=VisibleHTML(source);p.feed(source);p.close();out=source
    for a,b,new in sorted(p.edits,reverse=True):out=out[:a]+new+out[b:]
    return out
def rewrite_json(value,key=""):
    if isinstance(value,list):return [rewrite_json(v,key) for v in value]
    if isinstance(value,dict):
        out={k:rewrite_json(v,k) for k,v in value.items()}
        if "audio_script" in value and value.get("audio_script")!=out.get("audio_script"):
            if "audio_path" in out:out["audio_path"]=None
        return out
    if isinstance(value,str):
        if key in {"svg","svg_content","inline_svg"}:return rewrite_html(value)
        if key in PROTECTED_KEYS:return rewrite_path(value) if value.startswith("knodes/") else value
        if key in {"html","body_html"}:return rewrite_html(value)
        if re.search(r"<(?:svg|script|path)\b",value):return rewrite_html(value)
        if key in {"knode_dir","path"}:return rewrite_path(value)
        if key in {"id","anchor_id"}:return value
        return rewrite_text(value)
    return value
def rewrite_tree(tree):
    if tree.get("numbering_version"):raise ValueError("Already versioned; refusing ambiguous second conversion")
    ordered=sorted(tree["modules"],key=lambda m:m.get("sequence_order",0))
    if [m["module_id"] for m in ordered]!=list(ID_MAP):raise ValueError("Course graph changed since mapping review")
    out=rewrite_json(tree);by_id={m["module_id"]:m for m in out["modules"]}
    out["modules"]=[by_id[ID_MAP[m["module_id"]]] for m in ordered]
    for i,(old,node) in enumerate(zip(ordered,out["modules"]),1):
        node["sequence_order"]=i
        guide=node.get("generation_guide",{})
        if "merged_from" in guide:guide.pop("merged_from")
        # Old merge bookkeeping remains only in immutable source snapshots.
        if old.get("generation_guide",{}).get("merged_from"):
            guide["rationale"]="已合并理论要点；本节以当前教学目标和可验收产出组织。"
    out["numbering_version"]=VERSION
    ids=set(ID_MAP.values())
    for m in out["modules"]:
        if not set(m.get("depends_on",[]))<=ids:raise ValueError("Dangling dependency")
    for s in out["stages"]:
        if s.get("closing_capstone_module_id") not in ids:raise ValueError("Dangling stage capstone")
    return out
def dump(value):return (json.dumps(value,ensure_ascii=False,indent=2)+"\n").encode()
def build(source:Path,output:Path):
    source=source.resolve();output=output.resolve()
    if output.exists() or source==output or source in output.parents:raise ValueError("Output must be a fresh directory outside source")
    manifest=json.loads((source/"manifest.json").read_text())
    if manifest["slug"]!=SLUG or manifest["version"]!=SPEC["source_version"]:raise ValueError("Unexpected project/version")
    tree=json.loads((source/"tree/knowledge_tree.json").read_text())
    new_tree=rewrite_tree(tree)
    output.mkdir(parents=True)
    source_hashes={};target_hashes={};renamed={};audio_unbound=[];unresolved={}
    files=[]
    for entry in manifest["files"]:
        old=entry["path"]
        if old.startswith("_archive/"):continue
        rel=Path(old)
        if rel.is_absolute() or ".." in rel.parts:raise ValueError("Unsafe manifest path")
        src=source/old
        if src.is_symlink() or not src.is_file():raise ValueError("Missing or linked source: "+old)
        data=src.read_bytes()
        if entry["sha256"]!=sha(data) or entry["size"]!=len(data):raise ValueError("Source manifest mismatch: "+old)
        source_hashes[old]=sha(data);new=rewrite_path(old);target=output/new;target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists():raise ValueError("Destination collision: "+new)
        if old=="tree/knowledge_tree.json":changed=dump(new_tree)
        elif src.suffix in TEXT_EXT:
            text=data.decode("utf8")
            if src.suffix==".json":
                doc=json.loads(text);converted=rewrite_json(doc);changed=dump(converted)
                if src.name=="slides.json":
                    a=doc.get("slides",[]) if isinstance(doc,dict) else doc;b=converted.get("slides",[]) if isinstance(converted,dict) else converted
                    if len(a)!=len(b):raise ValueError("Slides dropped")
                    for before,after in zip(a,b):
                        if before.get("slide_id")!=after.get("slide_id") or before.get("lesson_anchor")!=after.get("lesson_anchor"):raise ValueError("Slide identity changed")
                        if before.get("audio_path") and not after.get("audio_path"):audio_unbound.append(new+":"+str(after.get("slide_id")))
            elif src.suffix==".html":changed=rewrite_html(text).encode()
            else:
                if old=="knodes/M44-w0-8/lesson.md":
                    text=text.replace('下一节(M45)你就拿两行数**比一比**, 看两个分子像不像; 再往后会发现光这八个总数还不够细, 需要更会“看片段”——一步步走向 Morgan 指纹和真正喂模型。','下一节(M49)学习 Morgan 指纹：用局部结构片段补充总量描述符表达不了的连接细节；后续再比较指纹相似度。')
                    text=text.replace('**下一节(M45)**, 你就拿**两行数比一比**——看两个分子的这一行数接不接近, 接近就说明两个分子像。再往后, 你会发现光这八个总数还不够细, 有时两个不一样的分子拼出来的一行数却差不多——那时就需要更会“看片段”, 一步步走向把分子变成一长串 0 和 1 的 Morgan 指纹, 和真正喂给 AI 模型。','**下一节(M49)**学习 Morgan 指纹。不同连接结构可能有相近的总量描述符，因此需要进一步记录局部结构片段，再在后续课程中比较指纹相似度。')
                if old=="knodes/M28-w0-canonical-smiles/lesson.md":
                    text=text.replace('从下一节起, S2 后半段我们要给这个干净库里的**每个分子算真属性了**: 先去 ChEMBL 拉来带“活性标签”的真分子(M29)、拉溶解度数据(M30)、毒性数据(M31), 再用 pandas 把它们拼成一张大表。','下一节(M32)学习 pandas 表格，把结构、属性和标签整理为清晰的列。活性、溶解度、毒性等数据需要分别保留来源和单位，不能互相当作同一种标签。')
                if old=="knodes/M52-w0-module/lesson.md":
                    text=text.replace("M45","逐位距离比较示例")
                changed=rewrite_text(text).encode()
        else:changed=data
        if src.suffix not in TEXT_EXT:os.link(src,target) # immutable media only
        else:target.write_bytes(changed)
        if old!=new:renamed[old]=new
        digest=sha(changed);target_hashes[new]=digest
        files.append({**entry,"path":new,"sha256":digest,"size":len(changed)})
        # Report unresolved tokens in authored plain prose, not SVG/JS internals.
        if src.suffix==".md":
            missing=sorted({m.group() for m in TOKEN.finditer(data.decode()) if m.group() not in REF_MAP})
            if missing:unresolved[old]=missing
    new_manifest=rewrite_json(manifest)
    new_manifest["version"]="0.2.0";new_manifest["version_tag"]="consecutive-v2"
    new_manifest["files"]=files;new_manifest["total_size_bytes"]=sum(f["size"] for f in files)
    new_manifest["knodes"]=[{**n,"module_id":ID_MAP[old["module_id"]],"knode_dir":rewrite_path(old["knode_dir"])} for old,n in zip(manifest["knodes"],new_manifest["knodes"])]
    if [n["module_id"] for n in new_manifest["knodes"]]!=list(ID_MAP.values()):raise ValueError("Manifest order mismatch")
    (output/"manifest.json").write_bytes(dump(new_manifest))
    report={"project":SLUG,"numbering_version":VERSION,"modules":47,"source_version":manifest["version"],"target_version":"0.2.0","source":str(source),"candidate":str(output),"source_sha256":source_hashes,"target_sha256":target_hashes,"renamed_files":renamed,"unbound_audio":audio_unbound,"unresolved_prose_references":unresolved,"production_migrated":False}
    (output.parent/"migration-report.json").write_bytes(dump(report))
    return report
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--source",type=Path,default=CANONICAL);p.add_argument("--output",type=Path,required=True);a=p.parse_args()
    r=build(a.source,a.output);print(json.dumps({k:r[k] for k in ["modules","target_version","candidate","unbound_audio","unresolved_prose_references","production_migrated"]},ensure_ascii=False,indent=2))
