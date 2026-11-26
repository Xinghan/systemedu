"""Add the reviewed student materials; preserve all existing archive members."""
from pathlib import Path
import csv, hashlib, json, math, shutil, zipfile
from astropy.io import fits

HERE=Path(__file__).resolve().parent
SOURCE=Path('/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective')
REVISION='guided-20261126-r2'
PRACTICE=SOURCE/'practice'
AUDIT=SOURCE/'audit'/REVISION

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write_json(p,obj):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')

assert AUDIT.is_dir(), 'Apply reviewed course first'
assert not (AUDIT/'package-preservation.json').exists(), 'This reviewed package was already applied; do not append instructions twice'
changed=[]
def update(relative,text):
    p=SOURCE/relative
    before=AUDIT/'previous-package'/relative
    if p.exists() and not before.exists():
        before.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,before)
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    changed.append(p)

for name in ['STUDENT-START.md','requirements-classroom.txt']:
    update('practice/'+name,(HERE/name).read_text())
update('practice/START-HERE.md','''# 从这里开始

第一次操作请打开 [STUDENT-START.md](STUDENT-START.md)。它从解压、选择目录、安装 JupyterLab，到运行第一格逐步说明。本包已包含原始观测，不需要购买望远镜。

1. M01–M05：先在课堂观察、读表、记录问题。`templates/first-observation-card-template.html` 可直接填写观察卡；不要求会写 HTML。
2. M06–M22：打开 `junior-guide.ipynb` 中同名课节。代码、表、图和文件位置逐节对应；按 `requirements-classroom.txt` 安装完整学习环境。不要先运行全部。
3. M23–M24：保存刚刚实际使用的方法，核对原预测。M25 才由自己打开 `Q4_REVEAL`；此前的记录和解释要实际填写。
4. M26–M32：按原预测逐项比较，保留缺测和未知；保存固定方法的复现入口、实际运行日志以及自己的解释。

`kepler10-reproduction.ipynb` 和 `analyze.py --stage develop` 仍是汇总复现参考，会合并执行多个步骤，不对应学习版的逐节单元。原始数据与原参考程序均保留。

学生从不含输出的学习本开始。每次创建的 `student-runs/日期-编号` 保留各次输出，个人判断不会由程序自动填好。iPad 课堂记录与电脑文件分别保存；这里没有已接入的云计算或 iPad Python 内核。
''')
readme=(PRACTICE/'README.md').read_text()
readme=readme.replace('## 准备 Python 环境','''## 逐节学习入口

本轮课堂使用 `junior-guide.ipynb`，M01–M32 与课文一一对应。第一次安装与点击操作见 [STUDENT-START.md](STUDENT-START.md)，安装 `requirements-classroom.txt` 才包含 JupyterLab 前端。以下汇总命令保留作参考，不能在 M17 或 M23 替代自己的逐节中间结果。

## 准备 Python 环境''',1)
readme=readme.replace('已验证的环境为 Python 3.12.8、macOS arm64。','原汇总复现验收使用 Python 3.12.8、macOS arm64；本轮逐节学习本实际验收使用 Python 3.12.7、macOS arm64。',1)
readme=readme.replace('.venv/bin/python -m pip install -r requirements.txt','.venv/bin/python -m pip install -r requirements-classroom.txt',1)
readme=readme.replace('## 按课程进度运行','## 汇总复现参考（理解逐节过程之后再使用）',1)
old='从 M06 开始逐个阅读和运行 `kepler10-reproduction.ipynb` 的相应单元。Notebook、`analyze.py`、`manifest.json` 和 `raw/` 应位于同一目录。先完成 Q3 部分，暂不运行读取 Q4 的单元，也不要提前使用“全部运行”。'
assert old in readme
readme=readme.replace(old,'学习时从 M06 开始阅读和运行 `junior-guide.ipynb` 的同名单元。Notebook、`analyze.py`、`manifest.json` 和 `raw/` 放在同一目录。原 `kepler10-reproduction.ipynb` 是汇总复现版，数字章节与学习本不同。以下 CLI 命令也属于汇总路径，另选目录，不与学习本的 RUN 混用。')
readme=readme.replace('到 M23，运行 Q3 分析并保存配置与预测：','仅在核对完整参考算法时，以下命令会一次运行 Q3 分析、保存配置与预测。逐节路径的 M23 直接保存 M22 已有结果，不重新搜索：')
readme=readme.replace('完成这些记录后，到 M25 再运行：','参考路径在方法与预测保存后，可使用下列命令检验。学习本的 M25 使用显式 Q4_REVEAL 开关：')
readme=readme.replace('## 已执行的检查','## 原参考程序的教师验收记录',1)
readme=readme.replace('`audit/notebook-execution.json` 记录一次空内核按顺序执行：','以下文件与脚本保存在课程源仓库，学生下载包不含教师执行结果，也不要求运行这些 QA 脚本。\n\n`audit/notebook-execution.json` 记录原汇总本一次空内核按顺序执行：',1)
update('practice/README.md',readme)
b02=(PRACTICE/'foundations/B02.md').read_text()
b02=b02.replace('完成时保存 Notebook，再重启并运行全部；若依赖顺序清晰，结果应能重新出现。','完成时保存这个只有基础练习的小 Notebook，再重启并运行其中两格。回到课程学习本，只按顺序重跑到已经学习的课节，不选择整本“运行全部”，也不因此提前打开 Q4。')
update('practice/foundations/B02.md',b02)
update('practice/student-input/candidate-window.json',json.dumps({'start_bkjd':None,'end_bkjd':None,'boundary':'[start,end)','cadenceno':[],'observation':''},ensure_ascii=False,indent=2)+'\n')
template=(HERE/'materials/first-observation-card-template.html').read_text()
update('practice/templates/first-observation-card-template.html',template)
update('downloads/first-observation-card-template.html',template)
raw=PRACTICE/'raw/kplr011904151-2009350155506_llc.fits'
csv_path=SOURCE/'downloads/kepler10-q3-validity-input.csv'
with fits.open(raw,memmap=False) as hdul, csv_path.open('w',newline='') as stream:
    writer=csv.writer(stream,lineterminator='\n')
    writer.writerow(['ROW_INDEX','CADENCENO','TIME_BKJD','PDCSAP_FLUX','PDCSAP_FLUX_ERR','SAP_QUALITY'])
    for i,row in enumerate(hdul[1].data):
        values=[float(row[k]) for k in ['TIME','PDCSAP_FLUX','PDCSAP_FLUX_ERR']]
        writer.writerow([i,int(row['CADENCENO']),*[x if math.isfinite(x) else '' for x in values],int(row['SAP_QUALITY'])])
changed.append(csv_path)
write_json(AUDIT/'validity-input-provenance.json',{'source':str(raw.relative_to(SOURCE)), 'sha256':sha(raw),
    'output':str(csv_path.relative_to(SOURCE)), 'output_sha256':sha(csv_path),'rows':4370,
    'row_index':'zero-based original FITS row','time_unit':'BKJD days','flux_and_error_unit':'electron / second',
    'nonfinite':'empty CSV cell; never zero','filtering':'none'})

archive=SOURCE/'downloads/lightkurve-practice-kit.zip'
additions=['junior-guide.ipynb','STUDENT-START.md','requirements-classroom.txt','START-HERE.md','README.md',
           'foundations/B02.md','student-input/candidate-window.json','templates/first-observation-card-template.html']
prefix='lightkurve-practice/'
old_entries={}
with zipfile.ZipFile(archive) as existing:
    old_entries={n:existing.read(n) for n in existing.namelist()}
new_archive=archive.with_suffix('.zip.tmp')
replaced={prefix+s for s in additions}
with zipfile.ZipFile(new_archive,'w',zipfile.ZIP_DEFLATED) as output:
    for name,content in old_entries.items():
        if name not in replaced:output.writestr(name,content)
    for name in additions:output.write(PRACTICE/name,prefix+name)
with zipfile.ZipFile(new_archive) as output:
    assert set(old_entries)<=set(output.namelist())
    for name,content in old_entries.items():
        if name not in replaced:assert output.read(name)==content
    for name in additions:assert output.read(prefix+name)==(PRACTICE/name).read_bytes()
new_archive.replace(archive);changed.append(archive)
write_json(AUDIT/'package-preservation.json',{'status':'pass','all_original_entries_preserved':True,
    'old_entry_count':len(old_entries),'added_or_refreshed':additions,'original_analyze_and_raw_unchanged':True,
    'student_notebook_has_outputs':False})
manifest=json.loads((SOURCE/'manifest.json').read_text())
entries={e['path']:e for e in manifest['files']}
changed.extend(p for p in AUDIT.rglob('*') if p.is_file())
for p in changed:
    rel=str(p.relative_to(SOURCE));entries[rel]=dict(entries.get(rel,{}),path=rel,size=p.stat().st_size,sha256=sha(p))
manifest['files']=[entries[k] for k in sorted(entries)]
manifest['total_size_bytes']=sum(x['size'] for x in manifest['files'])
write_json(SOURCE/'manifest.json',manifest)
write_json(HERE/'refresh-assets.json',sorted(set([str(p.relative_to(SOURCE)) for p in changed if not p.is_relative_to(AUDIT)] +
    ['practice/junior-guide.ipynb','downloads/junior-guide.ipynb'])))
print('Updated student package; every original archive member retained, original science code and raw data unchanged.')
