"""One-shot local M05 lecture alignment; no production operations."""
import copy
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
COURSE=ROOT.parent/'systemeduidea/projects_data/molecule-monster-hunter'
NODE=COURSE/'knodes/M05-w0-module'
OUT=ROOT/'artifacts/readonly-m05-20260915'
FILES=['slides.json','audio_scripts.json','lesson.md','assignment.md','theories.json','sections.json']
TITLES=[
 '字符、连接、结构图：同一份输入的三种表达',
 '三个写法并排核对：同分子，还是异构体？',
 '完整符号与原子账本：Cl、氢数和电荷',
 '自动显示隐式氢：画面变了，分子没有变',
 '四组结构对照：双键、分支、闭环与芳香',
 '三种结果并排看：失败、非目标、目标一致',
 '自动读取苯酚：环标记加键，不增加碳',
 '读懂制图证据：目标结构、代码与纠错示例',
 'M04 → M05 → M06：从比较到结构表达，再到总装',
]
SCRIPTS=[
 '接续 M04 的结构比较，观察 CCO 的字符、邻接账本和实际 RDKit 结构图。索引零和一是碳，索引二是氧，三者形成两条重原子间连接。字符串不是照片，不直接含三维坐标；二维图也不是空间构象。完整示例帮助理解输入如何变成可核对的结构，不读取或判定个人作业。',
 'CCO、OCC 与 COC 同时展示。前两个从不同方向遍历同一乙醇结构，规范写法一致；COC 合法，但氧连接两个碳，是二甲醚。三者分子式相同仍不能说明连接相同。页面核对同一版本 RDKit 的实际解析，不需要切换输入，也不保证不同软件的规范字符串完全一样。',
 '三个固定例子的分词、精确结构和完整原子表同时可读。Cl 是一个氯的完整符号，ClC 只有两个重原子。[NH4+] 表示一个氮带四个氢和正一电荷，不是五个重原子。原子索引从零开始；附带氢和形式电荷另列。教学分词不是完整 SMILES 校验器，连接和数量由 RDKit 核对。',
 '固定乙醇模型先只显示三个重原子，再自动显示全部氢，最后改变观察方向。可见球数从三变九，但分子始终有两个碳、六个氢和一个氧，总数一直为九。模型是已有 PubChem 计算构象，不是输入字符串即时预测的坐标。旁边完整含氢二维图和四个简单中性例子的账本始终可读。带电、芳香、方括号例子不能无条件照套常见价态补氢。',
 '四组对照同时展开。CC 与 C=C 的碳数不变，键级和氢数改变；CCCC 与 CC(C)C 的分子式相同，分支改变邻接。链与环的对照说明成对数字闭合键，不添加碳。环己烷与芳香小写写法的苯氢数、芳香环属性不同。键的数量不等于键级，这些规则也不构成完整的 SMILES 语法。',
 '目标固定为乙醇。C1CC 的环标记没有配对，RDKit 解析失败，不显示成功分子图，也不进入目标判定。COC 能解析但不是目标；CCO 能解析且规范结构与目标相同。三种结果并排保留，不需要选择，也不会把上一张成功图留在失败输入下面。结构验证不能推出药效、安全或合成可行性。',
 '苯酚 Oc1ccccc1 按九个字符自动读取，完整十行账本从零步开始一直可见。第一个数字一只保存环端点，不加原子；第二个数字一闭合一条连接，最终七个重原子、七条重原子间连接和一个环。精确图始终由完整有效输入生成，高亮只标出已读原子。外层可以暂停或重播；这不是 RDKit 内部录像，也不是分子形成的化学反应。',
 '咖啡因和阿司匹林的来源输入、精确结构及计数并排展示。下方完整 Python 模板示范可复算绘图；旁边是明确标记的构造纠错示例，以乙醇为目标区分解析失败、合法非目标和目标一致。这里不是你的运行记录，不执行本机 Python，不保存或下载个人成果。课后用自己的环境、实际输出、SVG 和自己的修正说明形成证据。',
 'M04 留下结构与性质的计算比较；M05 进一步保留目标来源、可解析输入、规范结构、版本和纠错依据；M06 将这些知识组合成阶段识读小工作台。参考字段表帮助理解成果需要什么，不读取本机记录，也不自动表示完成。软件结构证据与药效、安全性是不同问题；所有学习任务仅在软件中完成。',
]
OLD_TASK='先用乙醇练习，再从咖啡因或阿司匹林选择一个目标。第 8 页实际输入 SMILES 并运行核对，保留一次解析或目标核对失败的尝试，以及自己至少 12 字的修正说明。下载实际 RDKit 结构 SVG、个人记录 JSON，可另行运行完整 Python 模板。第 9 页重新核验本机保存记录。请备份个人成果；不在软件外制备、服用或测试这些物质。'
NEW_TASK='先用乙醇练习，再从咖啡因或阿司匹林选择一个目标，在 M02 已确认的 Python 环境运行下方模板。保存本人实际输入、RDKit 版本、规范结构、生成的 SVG 和运行输出；保留一次解析或目标核对失败的尝试，以及至少 12 字的个人修正说明。第 8、9 页仅展示只读参考，不保存或核验个人记录；参考内容不算个人成果。请备份自己的文件，不在软件外制备、服用或测试这些物质。'

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,value):p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def replace(value,pairs):
 if isinstance(value,str):
  for old,new in pairs:value=value.replace(old,new)
  return value
 if isinstance(value,list):return [replace(v,pairs) for v in value]
 if isinstance(value,dict):return {k:replace(v,pairs) for k,v in value.items()}
 return value

assert not OUT.exists(),'Snapshot already exists; do not rerun'
OUT.mkdir();snapshot=OUT/'M05';snapshot.mkdir()
before={str(p.relative_to(COURSE)):sha(p) for p in COURSE.rglob('*') if p.is_file()}
for name in FILES:shutil.copy2(NODE/name,snapshot/name)
shutil.copy2(COURSE/'manifest.json',OUT/'manifest-before.json')
old=json.loads((NODE/'slides.json').read_text());new=copy.deepcopy(old);assert len(new['slides'])==9
pairs=[]
for previous,slide,title,narration in zip(old['slides'],new['slides'],TITLES,SCRIPTS,strict=True):
 pairs.extend([(previous['audio_script'],narration),(previous['title'],title)])
 slide.update(title=title,audio_script=narration,audio_path=None)
 slide['payload']['technical_visual']['aria_label']=title
pairs.extend([(OLD_TASK,NEW_TASK),('正文静态参考，交互位于老师讲课。','正文静态参考，老师讲课为只读预设演示。'),('正文静态参考；可操作的模型、状态变化和个人记录在“老师讲课”对应幻灯片中。','正文为静态参考；老师讲课展示只读模型和自动过程。个人运行与证据整理属于课后任务。')])
for name in ['lesson.md','assignment.md']:
 text=(snapshot/name).read_text();updated=replace(text,pairs);assert updated!=text and OLD_TASK not in updated;(NODE/name).write_text(updated)
for name in ['theories.json','sections.json']:
 obj=json.loads((snapshot/name).read_text());updated=replace(obj,pairs);assert updated!=obj;save(NODE/name,updated)
save(NODE/'slides.json',new)
save(NODE/'audio_scripts.json',[{'section_title':s['title'],'audio_script':s['audio_script']} for s in new['slides']])
save(ROOT/'course_factory/fixtures/molecule-monster-hunter/M05-readonly-v1.json',new)
sys.path.insert(0,str(ROOT/'tools/content-pipeline/src'))
from content_pipeline.manifest import regenerate_manifest
from library.manifest import load_manifest,verify_files
regenerate_manifest(COURSE)
assert not verify_files(load_manifest(COURSE/'manifest.json'),COURSE)
changed=sorted(p for p,h in before.items() if sha(COURSE/p)!=h)
assert changed==sorted(['manifest.json']+[f'knodes/M05-w0-module/{n}' for n in FILES])
record={'project':'molecule-monster-hunter','numbering_version':'consecutive-v2','module':'M05','slides':9,'presentation_mode':'readonly','status':'local-integrated','production_deployed':False,'generated_raster_images':0,'reused_raster_images':0,'readonly_3d_pages':[4],'automatic_process_pages':[4,7],'source_sha256':{n:sha(snapshot/n) for n in FILES},'course_sha256':{p:sha(COURSE/p) for p in changed},'changed_course_files':changed}
save(OUT/'candidate.json',record)
print(json.dumps(record,ensure_ascii=False,indent=2))
