"""Author the eight M08 replacements and verify their exact Python traces."""
import ast,contextlib,copy,hashlib,io,json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
COURSE=ROOT.parent/'systemeduidea/projects_data/molecule-monster-hunter'
NODE=COURSE/'knodes/M08-w0-smiles'
OUT=ROOT/'artifacts/molecule-m08-20260914'
OUT.mkdir(exist_ok=True)
assert not (OUT/'before').exists(),'Already authored; do not overwrite original snapshot'
shutil.copytree(NODE,OUT/'before')
shutil.copy2(COURSE/'manifest.json',OUT/'manifest-before.json')
original=json.loads((NODE/'slides.json').read_text())
assert len(original['slides'])==8
A='CC(=O)OC1=CC=CC=C1C(=O)O'
def trace(code,labels):
    lines=ast.parse(code).body;env={};output=io.StringIO()
    steps=[{'title':labels[0][0],'detail':labels[0][1],'active_lines':[],'variables':[]}]
    for i,line in enumerate(lines):
        # Only this repository-authored assignment/print syntax is evaluated.
        assert isinstance(line,(ast.Assign,ast.Expr))
        for call in ast.walk(line):
            if isinstance(call,ast.Call):assert isinstance(call.func,ast.Name) and call.func.id=='print'
        error=None
        try:
            with contextlib.redirect_stdout(output):exec(compile(ast.Module(body=[line],type_ignores=[]),'<M08 verified example>','exec'),{'__builtins__':{'print':print}},env)
        except NameError as e:error='NameError: '+str(e)
        title,detail=labels[i+1]
        step={'title':title,'detail':detail,'active_lines':[line.lineno],'variables':[{'name':k,'value':repr(v)} for k,v in env.items()],'output':output.getvalue().rstrip('\n')}
        if error:step['error']=error
        steps.append(step)
        if error:break
    return steps
base='smiles = "CCO"\nprint(smiles)'
basic=[('先预测：两行之后打印什么？','程序尚未执行。请区分代码中的名字、文字值和输出。'),('执行赋值：smiles → CCO','右侧的字符串值与名字 smiles 绑定。赋值本身没有标准输出。'),('执行 print：输出 CCO','print 按名字取值并输出；不是把变量名 smiles 打印出来。')]
specs=[
('让程序记住一个值，再按名字取回',base,basic,'变量是名字与值的绑定。先执行赋值，再执行打印；请同时观察源代码、当前绑定和终端输出。'),
('M07 的字符串，成为 M08 的程序输入',f'smiles = "{A}"\nprint(smiles)',[('课文固定样例：阿司匹林','这是课文提供的阿司匹林 SMILES，不是自动读取的个人取数卡。请与 M07 自己记录的来源核对。'),('只写一次完整字符串','引号内的字符被原样保存为文字值，包括括号、数字和等号。'),('按名字取回完整值','输出与输入逐字一致。这只证明文字读写，不证明结构有效、药效或安全性。')],'把 M07 的来源记录保留好。本页用课文中的阿司匹林作为固定样例：名字相同，值可以很长；原样打印不能代替化学结构校验。'),
('名字、赋值符号、文字值，各负其责','smiles = "CCO"\ncopy = smiles\nprint(copy)',[('先分开看名字与值','左边 smiles 是名字，右边带引号的 CCO 是字符串。此例只演示名称绑定。'),('= 是赋值，不是化学双键','代码中的 = 绑定名字和值；引号内 SMILES 的 = 若出现，才是结构记号。'),('右侧 smiles 没有引号：按名字取值','copy 绑定到与 smiles 相同的字符串值。这里没有把单词 smiles 当值保存。'),('copy 也能取回 CCO','变量只在当前程序运行环境中保留。退出后重新运行，需要重新执行赋值。')],'Python 的赋值先读取右边的值，再把名字与值绑定。名字不是实体盒子。copy 等于 smiles 会取出已有值；这不会把单词 smiles 存进去。'),
('加不加引号，print 的结果不同','smiles = "CCO"\nprint(smiles)\nprint("smiles")',[('预测两个 print 的差别','第二行读取变量；第三行直接给出文字。先猜，再逐行查看。'),('当前绑定建立','smiles 当前对应 CCO，赋值还没有输出。'),('不加引号：读取名字','print(smiles) 查找变量并输出 CCO。'),('加引号：直接输出文字','print("smiles") 输出单词 smiles。终端现在保留两行不同的结果。')],'引号告诉 Python 这是文字值。不带引号的 smiles 要按名字查找；带引号的 smiles 直接是一段文字。所以两行 print 得到不同结果。'),
('重新赋值，当前值改变，旧输出保留',f'smiles = "CCO"\nprint(smiles)\nsmiles = "{A}"\nprint(smiles)',[('观察同一个名字的两次赋值','点击播放，跟踪 smiles 的当前值和终端历史。'),('第一次赋值：CCO','变量当前绑定到乙醇样例字符串。'),('第一次打印','终端留下 CCO；这是一条已经发生的输出。'),('第二次赋值：阿司匹林样例','同一个名字改为新字符串。赋值不会删除终端已经打印的 CCO。'),('第二次打印：新值','输出新增阿司匹林字符串。当前变量只有新值，终端保留先后两条输出。')],'重新赋值改变当前名字的绑定，但不会把终端历史改掉。播放时请区分当前值和已经打印的结果：二者记录的是不同东西。'),
('定位错误，再在新运行中验证修复',base,[], '本页比较三次彼此独立的运行。缺引号会查找不存在的 CCO；大小写写错会查找不存在的 Smiles。修复后重新运行，才能得到 CCO。'),
('交付脚本和真实运行证据，不只交一张勾',f'smiles = "{A}"\nprint(smiles)',[('下载或抄写两行脚本','准备记录：运行环境、实际代码、实际输出和你的解释。参考轨迹不等于本人实机完成。'),('在 Python 环境中执行赋值','请在自己的环境运行。若报错，记录原文并先核对引号与名字。'),('对照输出，保存证据','这里是核验过的预期输出。你需另附自己的运行结果，并说明名字和字符串的区别。')],'下载本页代码并在自己的 Python 环境运行，记录环境、实际代码和实际输出，再解释变量与文字值的区别。本页展示预期结果，不会自动声明你已完成真实运行。'),
('从一个值到一组值：下一节 M09','smiles = "CCO"\nsmiles_list = ["CCO", "O"]\nprint(smiles)\nprint(smiles_list)',[('M08 终点：一个名字、一个字符串','先巩固当前课节，再预览 M09 的列表。'),('单个字符串','smiles 是一个字符串，表示课文中的乙醇样例。'),('M09 预告：列表保留两个字符串','smiles_list 是列表，里面是 CCO 与 O 两个独立字符串。不是把两个分子拼成一个分子。'),('打印一个字符串','单个字符串的 print 不显示包围它的引号。'),('打印一个列表','列表输出显示方括号和各字符串的表示。下一节 M09 学列表，再到 M10 学循环逐个处理。')],'下一节 M09 把多个字符串放入列表。列表不是一个新分子，而是多个值的集合。然后 M10 才用循环逐个处理，学习编号保持连续。'),
]
bad1='smiles = CCO\nprint(smiles)'
bad2='smiles = "CCO"\nprint(Smiles)'
error_cases=[(bad1,[('运行 A：缺少引号','本次从空环境开始，CCO 没有提前定义。'),('A 停止：CCO 被当作名字','第一行触发 NameError，第二行不执行；并未建立 smiles。')]),(bad2,[('运行 B：修复引号，但写错大小写','这是独立的新运行，不能沿用 A 的状态。'),('B 的赋值成功','smiles 已存在，但 Smiles 是另一个名称。'),('B 停止：Smiles 不存在','Python 区分大小写。打印语句报错，不会产生标准输出。')]),(base,[('运行 C：两处都修正','再次从空环境开始，使用一致的 smiles 和成对引号。'),('C 赋值成功','smiles 绑定 CCO。'),('C 验证成功：输出 CCO','修复后得到预期输出；错误原因和修复措施需要分别记录。')])]
slides=[]
for i,(title,code,labels,narration) in enumerate(specs):
    old=original['slides'][i];payload={k:v for k,v in old['payload'].items() if k in {'theory_id','idea_id'}}
    steps=trace(code,labels) if i!=5 else [{**s,'code':c} for c,ls in error_cases for s in trace(c,ls)]
    payload['technical_visual']={'renderer':'code-trace','language':'python','code':code,'aria_label':f'M08 · s{i+1} · {title}','steps':steps}
    payload['bullets']=[narration]
    if old['kind']=='intro':payload['hero_subtitle']='8 页新制 · 逐行执行 / 名称绑定 / 终端证据'
    slides.append({**old,'title':title,'audio_script':narration,'audio_path':None,'payload':payload})
doc={**original,'slides':slides}
(NODE/'slides.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
(NODE/'audio_scripts.json').write_text(json.dumps([{'section_title':s['title'],'audio_script':s['audio_script']} for s in slides],ensure_ascii=False,indent=2)+'\n')
note='\n## 新版幻灯片的验证边界\n\n幻灯片展示经过 Python 核验的教学执行轨迹，不是在浏览器中运行任意 Python。请区分当前名称绑定与终端历史；程序退出后，变量不会自动写入永久存储。阿司匹林是课文固定样例，不冒充你在 M07 保存的个人来源卡。交付时仍需附本人实际运行的环境、两行脚本、终端输出，以及变量名和字符串值的区别。下一节为 M09（列表），随后 M10（循环）。\n'
for name in ['lesson.md','assignment.md']:
    p=NODE/name;p.write_text(p.read_text()+note)
fixture=ROOT/'course_factory/fixtures/molecule-monster-hunter/M08-variable-consecutive-v2.json';fixture.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
sys.path.insert(0,str(ROOT/'tools/content-pipeline/src'))
from content_pipeline.manifest import regenerate_manifest
from library.manifest import load_manifest,verify_files
regenerate_manifest(COURSE)
assert not verify_files(load_manifest(COURSE/'manifest.json'),COURSE)
assert [(s['slide_id'],s['kind']) for s in slides]==[(s['slide_id'],s['kind']) for s in original['slides']]
assert all(s['audio_path'] is None for s in slides)
assert slides[3]['payload']['technical_visual']['steps'][-1]['output']=='CCO\nsmiles'
assert slides[4]['payload']['technical_visual']['steps'][-1]['output']=='CCO\n'+A
result={'numbering_version':'consecutive-v2','module':'M08','slides':8,'states':sum(len(s['payload']['technical_visual']['steps']) for s in slides),'python_examples_verified':10,'raster_images':0,'interactive_3d':0,'new_audio':False,'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'production_deployed':False}
(OUT/'generation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
