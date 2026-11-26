"""Build the reviewed, lesson-aligned student route without deleting old nodes.

Default builds a reviewable Notebook and lesson patches locally. --apply writes
canonical authoring/content files and an additive practice-package update.
"""
from pathlib import Path
import argparse, ast, copy, hashlib, json, re, shutil, zipfile

HERE = Path(__file__).resolve().parent
SOURCE = Path('/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective')
REVISION = 'guided-20261126-r2'
BASE = '/api/library/projects/lightkurve-transit-detective/files/'

def read(path): return json.loads(path.read_text())
def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def normalize(text):
    # Chinese punctuation adjacent to strong delimiters needs a word boundary.
    return re.sub(r'[ \t]*\*\*(.+?)\*\*[ \t]*', r' **\1** ', text).strip()

SETUP = '''from pathlib import Path
from datetime import datetime, timezone
import csv, json, uuid, os, hashlib, copy
import numpy as np
import matplotlib.pyplot as plt
import lightkurve as lk
from astropy.io import fits
from IPython.display import display, Image
from analyze import CONFIG, ROOT, plain

# Each execution starts an independent persistent folder. Existing runs remain.
RUN = Path(os.environ.get('SYSTEMEDU_GUIDE_OUTPUT',
    str(ROOT / 'student-runs' / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:8]))))
RUN.mkdir(parents=True, exist_ok=False)
def output_path(name):
    path = (RUN / name).resolve()
    if not path.is_relative_to(RUN.resolve()):
        raise ValueError('Output must stay in this run folder')
    path.parent.mkdir(parents=True, exist_ok=True)
    return path
def save_json(name, value):
    path = output_path(name)
    path.write_text(json.dumps(plain(value), ensure_ascii=False, indent=2, allow_nan=False) + '\\n')
    return path
def save_csv(name, headers, rows):
    path = output_path(name)
    with path.open('w', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row.get(key, '') for key in headers] if isinstance(row, dict) else row)
    return path
def save_plot(name):
    path = output_path(name)
    plt.gcf().savefig(path, dpi=150, bbox_inches='tight')
    return path
def load_json(name):
    return json.loads((RUN / name).read_text())
print('原始材料目录:', ROOT)
print('本次成果目录（请记下）:', RUN)
assert (ROOT / 'raw').is_dir(), 'Notebook must be beside analyze.py and raw/'
student_input = ROOT / 'student-input'
student_input.mkdir(exist_ok=True)
window_input = student_input / 'candidate-window.json'
if not window_input.exists():
    window_input.write_text(json.dumps({'start_bkjd':None,'end_bkjd':None,
        'boundary':'[start,end)','cadenceno':[],'observation':''},ensure_ascii=False,indent=2))
'''

INTRO = '''# Kepler-10：逐节学习与操作手册

这份学习版按 M01–M32 与课文逐节对应，保留每次处理的中间结果。
原 kepler10-reproduction.ipynb 是汇总复现版，适合理解各步以后核对整条程序；两本 Notebook 的章节编号不能混用。

M01–M05 先在课堂完成观察、表格和纸笔记录；从 M06 开始才需要电脑 Python 环境。
每节先读说明、预测一个小例子的结果，再运行对应单元、查看真实输出，并写自己的解释。
构造例、参考程序、本人测量三者分别标明；输出文件存在不代表已经理解或通过评分。

从不含输出的本文件开始；旁边已执行版本和 audit 文件是验收参考，不能抄作本人首次结果。
首次学习不要“全部运行”。M25 的 Q4_REVEAL 默认为 False，只有完成方法记录和预测后，才由你改为 True。
已经看过 Q4 的人如实记录既往访问，不把复跑称作新的盲测。

环境：按 STUDENT-START.md 安装 requirements-classroom.txt 并启动 JupyterLab。Notebook 与 analyze.py、manifest.json、raw/ 放在同一目录。
从 M06 的准备单元启动；上次内核关闭后，要按前置顺序重新计算变量。每次准备单元会创建新的 student-runs 子目录，不覆盖旧成果。
'''

def cell(kind, text, ident):
    value = {'id': ident, 'cell_type': kind, 'metadata': {}, 'source': text.splitlines(keepends=True)}
    if kind == 'code': value.update(execution_count=None, outputs=[])
    return value

def build(apply=False):
    drafts = [x for name in ['M01-M11','M12-M22','M23-M32'] for x in read(HERE / ('draft-' + name + '.json'))]
    assert [x['module'] for x in drafts] == [f'M{i:02}' for i in range(1,33)]
    assert read(SOURCE / 'manifest.json')['content_revision'] == 'beginner-20261126', 'Start from the reviewed first revision'
    nb = {'nbformat':4,'nbformat_minor':5,'metadata':{'kernelspec':{'display_name':'SystemEdu · Python 3.12','language':'python','name':'systemedu-junior'},'language_info':{'name':'python','version':'3.12'},'systemedu_revision':REVISION},'cells':[cell('markdown', INTRO, 'guide-introduction')]}
    previews = HERE / 'preview'; previews.mkdir(exist_ok=True)
    coverage = []
    for item in drafts:
        mid = item['module']; directory = SOURCE / f'knodes/{mid}-w0-module'
        original = (directory / 'lesson.md').read_text()
        title = original.splitlines()[0].lstrip('# ')
        teaching = normalize(item['teaching'])
        assert len(teaching) > 150
        entry = (f'## 本节的材料与操作位置\n\n本节准备：{item["prerequisite"]}\n\n'
                 f'本节对应[逐节学习 Notebook 的 {mid}]({BASE}downloads/junior-guide.ipynb)，'
                 f'也可从[完整实践包]({BASE}downloads/lightkurve-practice-kit.zip)解压后打开 `junior-guide.ipynb`。'
                 '旧版 `kepler10-reproduction.ipynb` 仍保留为汇总复现参考；下文涉及旧版数字章节的说明，不能当作学习版的单元位置。\n\n'
                 '在 iPad 可阅读材料、计算小例子并写笔记；Python 单元需要配套电脑运行，未运行的实践继续记为待完成。\n\n')
        revised = original
        author_path = SOURCE / f'authoring/nodes/{mid}.json'; author = read(author_path)
        author_text = author['plan_markdown']
        changes = []
        for change in item.get('corrections', []):
            old,new = change['old'],change['new']
            assert revised.count(old) == 1, (mid, 'correction anchor', old)
            assert author_text.count(old) == 1, (mid, 'author correction anchor', old)
            revised = revised.replace(old,new,1); author_text = author_text.replace(old,new,1)
            changes.append(change)
        # Concepts precede hands-on instructions. Insert the guided sequence at
        # a reviewed lesson-specific location, never before prerequisite terms.
        anchor = item['insertion_before']
        assert revised.count(anchor) == 1, (mid, 'teaching insertion', anchor)
        assert author_text.count(anchor) == 1, (mid, 'author insertion', anchor)
        revised = revised.replace(anchor, teaching + '\n\n' + anchor, 1)
        author_text = author_text.replace(anchor, teaching + '\n\n' + anchor, 1)
        first, rest = revised.split('\n',1)
        revised = first + '\n\n' + entry + rest.lstrip('\n')
        first_author, rest_author = author_text.split('\n',1)
        author_text = first_author + '\n\n' + entry + rest_author.lstrip('\n')
        assignment = (directory/'assignment.md').read_text()
        for change in item.get('assignment_corrections', []):
            old,new = change['old'],change['new']
            assert assignment.count(old) == 1, (mid, 'assignment anchor', old)
            assert author['assignment'].count(old) == 1, (mid, 'author assignment anchor', old)
            assignment = assignment.replace(old,new,1)
            author['assignment'] = author['assignment'].replace(old,new,1)
        instructions = (f'本节配套操作位于 `junior-guide.ipynb` 的 {mid}。'
                        '按课文完成对应单元后，检查下列文件或记录：'
                        + '、'.join(f'`{s}`' for s in item['outputs'])
                        + '。程序输出、空表与本人解释分别保存；尚未完成的判断请标明待完成。\n\n')
        first,rest = assignment.split('\n',1)
        assignment = first + '\n\n' + instructions + rest.lstrip('\n')
        first,rest = author['assignment'].split('\n',1)
        author['assignment'] = first + '\n\n' + instructions + rest.lstrip('\n')
        (previews/(mid+'.assignment.md')).write_text(assignment)
        (previews / (mid+'.md')).write_text(revised)
        author['plan_markdown'] = author_text
        dump(previews / (mid+'.authoring.json'),author)
        markers = lambda s: re.findall(r'\[\[[A-Z0-9_]+:[^\]]+\]\]',s)
        assert markers(original) == markers(revised), (mid,'media markers changed')
        if mid == 'M06':
            nb['cells'].append(cell('markdown','## M06 准备：输出文件怎样保存\n\n`RUN` 是本次新建的成果目录，`ROOT` 是原始材料目录。下面三个保存工具只负责把表、文字和图片写入文件，不替你进行科学分析。后续每个保存调用都会给出文件名；打开打印出的 RUN 目录即可找到。重新运行准备单元会另建目录，因此要记下本次路径。', 'runtime-explanation'))
            nb['cells'].append(cell('code',SETUP,'runtime-setup'))
        nb['cells'].append(cell('markdown',f'## {mid} · {title}\n\n{teaching}',mid.lower()+'-lesson'))
        for i,c in enumerate(item.get('cells', [])):
            kind = c.get('type',c.get('cell_type'))
            assert kind in ['markdown','code']
            if kind == 'code': ast.parse(c['source'])
            nb['cells'].append(cell(kind,c['source'],f'{mid.lower()}-step-{i:02}'))
        nb['cells'].append(cell('markdown','本节输出或记录：'+ '、'.join(f'`{s}`' for s in item['outputs'])+'。检查内容与来源后再继续；空模板不是完成的作业。',mid.lower()+'-handoff'))
        coverage.append({'module':mid,'destination':f'knodes/{mid}-w0-module/lesson.md','activity_id':f'course:lightkurve-transit-detective:0.2.0:{mid}','before_sha256':sha(directory/'lesson.md'),'after_sha256':hashlib.sha256(revised.encode()).hexdigest(),'prerequisite':item['prerequisite'],'outputs':item['outputs'],'corrections':changes,'assignment_corrections':item.get('assignment_corrections',[]),'insertion_before':anchor,'media_markers_retained':True})
    dump(HERE/'junior-guide.ipynb',nb); dump(HERE/'node-coverage.json',coverage)
    if not apply:
        print(f'Prepared {len(coverage)} lessons and {len(nb["cells"])} Notebook cells; source unchanged'); return
    audit = SOURCE/'audit'/REVISION
    assert not audit.exists(), 'Never overwrite a previous snapshot'
    audit.mkdir(parents=True)
    shutil.copy2(SOURCE/'manifest.json',audit/'previous-manifest.json')
    changed=[]
    for item in drafts:
        mid=item['module']; directory=SOURCE/f'knodes/{mid}-w0-module'; old=audit/'previous'/mid;old.mkdir(parents=True)
        author_path=SOURCE/f'authoring/nodes/{mid}.json'
        for path,name in [(directory/'lesson.md','lesson.md'),(directory/'assignment.md','assignment.md'),(author_path,'authoring.json'),(directory/'content-history.json','content-history.json')]:shutil.copy2(path,old/name)
        shutil.copy2(previews/(mid+'.md'),directory/'lesson.md');shutil.copy2(previews/(mid+'.authoring.json'),author_path)
        shutil.copy2(previews/(mid+'.assignment.md'),directory/'assignment.md')
        history=read(directory/'content-history.json')
        historic_keys={x['key'] for x in history['questions']}
        for q in list(history['questions']):
            if ':0.2.0:' in q['key']:
                key=q['key'].replace(':0.2.0:',':beginner-20261126:')
                if key not in historic_keys:
                    history['questions'].append(dict(q,key=key));historic_keys.add(key)
        history.update(title='历次修订前的学习记录',notice='本次补齐逐节材料、操作和交接。原有笔记、答案、实验作品及旧完成记录保留；新增内容需重新核对。')
        dump(directory/'content-history.json',history)
        changed += [directory/'lesson.md',directory/'assignment.md',author_path,directory/'content-history.json']
    for p in [HERE/'junior-guide.ipynb']:
        for dest in [SOURCE/'practice'/p.name,SOURCE/'downloads'/p.name]:shutil.copy2(p,dest);changed.append(dest)
    dump(audit/'node-coverage.json',coverage);dump(audit/'teaching-and-cells.json',drafts)
    manifest=read(SOURCE/'manifest.json');manifest['content_revision']=REVISION;manifest['status']='guided-course-local-review';manifest['updated_at']='2026-11-26'
    changed += [p for p in audit.rglob('*') if p.is_file()]
    entries={x['path']:x for x in manifest['files']}
    for p in changed:
        rel=str(p.relative_to(SOURCE));entries[rel]=dict(entries.get(rel,{}),path=rel,sha256=sha(p),size=p.stat().st_size)
    manifest['files']=[entries[k] for k in sorted(entries)];manifest['total_size_bytes']=sum(x['size'] for x in manifest['files'])
    dump(SOURCE/'manifest.json',manifest)
    print('Applied reviewed lesson route; packaging/final manifest refresh remains required.')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');build(p.parse_args().apply)
