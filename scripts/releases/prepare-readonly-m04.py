"""One-shot M04 read-only content alignment; local course only, never deploy."""
import copy
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COURSE = ROOT.parent/'systemeduidea/projects_data/molecule-monster-hunter'
NODE = COURSE/'knodes/M04-w0-module'
OUT = ROOT/'artifacts/readonly-m04-20260914'
FILES = ['slides.json','audio_scripts.json','lesson.md','assignment.md','theories.json','sections.json']
TITLES = [
    '保留两碳骨架：把局部结构变化说清楚',
    '输入、方法、输出、边界：一条完整证据链',
    '自动观察羟基：连接关系与空间折角',
    '两组对照并排看：碳链变化有没有混入？',
    '气相与均一液体：先分清物态，再读计算值',
    '四步自动讲解：两个输入、两个值、一个差值',
    '四种固定结构：同一算法下的完整计算对照',
    '读懂参考报告：可复算代码与有限结论',
    'M03 → M04 → M05：让证据连续递进',
]
SCRIPTS = [
    '接续 M03 的骨架识读，并排比较乙烷 CC 与乙醇 CCO。两碳之间的连接保留，一个 C–H 位点与 C–O–H 对照，后者多一个氧，但氢的总数仍是六。原子账本和结构式完整可读。这是两个给定结构的比较，不是现场合成反应。本页不读取个人报告。',
    '从结构输入到有限结论，要保留四段证据：CC 与 CCO、相同 Crippen 方法、两个计算值与后减前差值，以及哪些问题尚未回答。CC 的参考 cLogP 为 1.0262，CCO 为负 0.0014，差值为负 1.0276；网页会核对实际浏览器计算。这些无量纲数字不是水中溶解度、毒性或药效。',
    '乙醇计算构象按预设顺序展示整体、定位氧，再检查相邻氢与空间折角。氧连接一个碳和一个氢，右侧二维结构和下方邻接、距离、C–O–H 夹角始终可读。羟基与氨基的元素和连接不同，R 表示相连的分子部分而非元素。预设视角不改变坐标，也不是分子动力学。无需操作模型；几何本身不能证明溶解度或药效。',
    '同时观察乙烷、乙醇和 1-丙醇。CC 与 CCO 保留两碳连接，局部原子组改变；CC 与 CCCO 的碳数也从二变三，因此不能把所有差异单独归给 OH。变量账本把两组比较并排列出，不需要选择对象。固定计算方法不等于已经控制真实溶液的全部条件。',
    '左侧示意气相位于水面上方：乙烷在常温常压下是气体，不是浮在水面的油珠。右侧示意乙醇与水形成均一液体。已有生成图片不是实拍，点的数量不表示精确浓度或真实分子。相态示意与 cLogP 数值承担不同任务，都不能代替指定条件下的实测溶解度。不要照图自行开展化学实验。',
    '四步自动高亮依次说明准备 CC 和 CCO、计算基线、计算比较项，最后取后值减前值。四行完整轨迹和结果表从开始就全部可读，暂停时不会丢失证据。网页核对真实 RDKit 结果，播放只控制讲解顺序，不伪装 Python 执行速度，也不表示乙烷变成乙醇或正在溶解。',
    '四种固定结构和完整计算表同时展示。乙烷作为基线，乙醇和中性乙胺保留两碳连接，1-丙醇还改变碳链长度。浏览器用相同 RDKit 描述符核对各自的 cLogP 与平均摩尔质量，单位分开列出。乙胺采用中性写法；电离和指定 pH 下的分布需要另行研究，不能任意设一个溶解度通过线。',
    '完整 Python 示例保留两个结构输入、RDKit 版本、Crippen 方法和差值。右侧参考报告示范怎样表述有限结论：在这一方法下，CCO 的 cLogP 比 CC 低 1.0276，但不能据此推出实测溶解度、毒性或药效。本页不是你的运行记录，不执行本机 Python，不保存个人成果。课后再用本人环境和实际输出形成独立证据。',
    'M03 的骨架报告帮助识别结构变化，M04 的输入、方法、数值和边界形成可复算比较，M05 继续学习明确的 SMILES 写法，为后续数据输入打基础。三节成果有递进，但参考表并不自动证明个人任务完成。真实条件下的行为、模型适用性、毒性和药效仍需要独立证据。',
]

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, value): p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def replace_strings(value, replacements):
    if isinstance(value,str):
        for old,new in replacements: value=value.replace(old,new)
        return value
    if isinstance(value,list): return [replace_strings(x,replacements) for x in value]
    if isinstance(value,dict): return {k:replace_strings(v,replacements) for k,v in value.items()}
    return value

def main():
    assert not OUT.exists(), 'Preserve original snapshot; do not rerun'
    OUT.mkdir()
    before={str(p.relative_to(COURSE)):sha(p) for p in COURSE.rglob('*') if p.is_file()}
    snapshot=OUT/'M04'; snapshot.mkdir()
    for name in FILES: shutil.copy2(NODE/name,snapshot/name)
    shutil.copy2(COURSE/'manifest.json',OUT/'manifest-before.json')
    old=json.loads((NODE/'slides.json').read_text()); new=copy.deepcopy(old)
    assert len(old['slides'])==9
    replacements=[]
    for previous,slide,title,narration in zip(old['slides'],new['slides'],TITLES,SCRIPTS,strict=True):
        replacements += [(previous['audio_script'],narration),(previous['title'],title)]
        slide.update(title=title,audio_script=narration,audio_path=None)
        slide['payload']['technical_visual']['aria_label']=title
    old_task='在第 8 页写出自己的有限结论并确认计算边界，保存并下载个人对照记录；可下载完整 Python 模板在已有环境中复算。'
    new_task='第 8 页只读展示代码和参考报告。课后在已有 Python 环境中复算，保留本人实际输出，并写出自己的有限结论及计算边界；参考值不算个人成果。'
    replacements += [(old_task,new_task),
        ('正文静态参考；可操作的模型、状态变化和个人记录在“老师讲课”对应幻灯片中。','正文为静态参考；“老师讲课”展示只读模型和自动过程。个人复算与证据整理属于课后任务。'),
        ('正文静态参考，交互位于老师讲课。','正文静态参考，老师讲课为只读预设演示。'),
        ('浏览器计算记录不冒充本人 Python 输出。','浏览器计算或参考示例不冒充本人 Python 输出。')]
    for name in ['lesson.md','assignment.md']:
        original=(snapshot/name).read_text()
        updated=replace_strings(original,replacements)
        assert updated!=original and old_task not in updated
        (NODE/name).write_text(updated)
    for name in ['theories.json','sections.json']:
        original=json.loads((snapshot/name).read_text())
        updated=replace_strings(original,replacements)
        assert updated!=original
        write(NODE/name,updated)
    write(NODE/'slides.json',new)
    write(NODE/'audio_scripts.json',[{'section_title':s['title'],'audio_script':s['audio_script']} for s in new['slides']])
    write(ROOT/'course_factory/fixtures/molecule-monster-hunter/M04-readonly-v1.json',new)
    sys.path.insert(0,str(ROOT/'tools/content-pipeline/src'))
    from content_pipeline.manifest import regenerate_manifest
    from library.manifest import load_manifest,verify_files
    regenerate_manifest(COURSE)
    assert not verify_files(load_manifest(COURSE/'manifest.json'),COURSE)
    changed=sorted(p for p,h in before.items() if sha(COURSE/p)!=h)
    assert changed==sorted(['manifest.json']+[f'knodes/M04-w0-module/{name}' for name in FILES])
    registry={'project':'molecule-monster-hunter','numbering_version':'consecutive-v2','module':'M04','slides':9,
              'presentation_mode':'readonly','status':'local-integrated','production_deployed':False,
              'generated_raster_images':0,'reused_raster_images':1,'readonly_3d_pages':[3],'automatic_process_pages':[3,6],
              'source_sha256':{name:sha(snapshot/name) for name in FILES},
              'course_sha256':{p:sha(COURSE/p) for p in changed},'changed_course_files':changed}
    write(OUT/'candidate.json',registry)
    print(json.dumps(registry,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
