"""Execute the learning route with a fresh kernel and untouched source data.

QA reveals Q4 explicitly only in an execution copy. The student download keeps
Q4_REVEAL=False. Unfilled student judgements must remain pending.
"""
from pathlib import Path
import argparse, hashlib, json, os, shutil, sys, tempfile, time
import nbformat
from nbclient import NotebookClient

HERE=Path(__file__).resolve().parent
SOURCE=Path('/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/practice')
p=argparse.ArgumentParser();p.add_argument('--reveal',action='store_true');args=p.parse_args()
work=Path(tempfile.mkdtemp(prefix='systemedu-guide-qa-'))
for name in ['analyze.py','manifest.json','requirements.txt']:
    shutil.copy2(SOURCE/name,work/name)
(work/'raw').symlink_to(SOURCE/'raw',target_is_directory=True)
kernel=work/'kernels/course-guide';kernel.mkdir(parents=True)
(kernel/'kernel.json').write_text(json.dumps({'argv':[sys.executable,'-m','ipykernel_launcher','-f','{connection_file}'],'display_name':'Course guide QA','language':'python'}))
os.environ['JUPYTER_PATH']=str(work)
os.environ['IPYTHONDIR']=str(work/'ipython')
os.environ['MPLCONFIGDIR']=str(work/'matplotlib')
os.environ['PYTHONDONTWRITEBYTECODE']='1'
os.environ['SYSTEMEDU_GUIDE_OUTPUT']=str(work/'student-output')
book=nbformat.read(HERE/'junior-guide.ipynb',as_version=4)
changes=0
if args.reveal:
    for c in book.cells:
        if c.cell_type=='code' and 'Q4_REVEAL = False' in c.source:
            c.source=c.source.replace('Q4_REVEAL = False','Q4_REVEAL = True # QA only; prior known-data reproduction')
            changes+=1
    assert changes==1, 'The student reveal control must have exactly one explicit default'
started=time.monotonic()
mode='revealed' if args.reveal else 'guarded'
client=NotebookClient(book,timeout=240,kernel_name='course-guide',resources={'metadata':{'path':str(work)}})
try:
    client.execute()
except BaseException:
    nbformat.write(book,HERE/f'guide-{mode}-failed.ipynb')
    raise
nbformat.write(book,HERE/f'guide-{mode}-executed.ipynb')
output=work/'student-output'
files=sorted(str(x.relative_to(output)) for x in output.rglob('*') if x.is_file())
report={'status':'pass','qa_reveal':args.reveal,'is_student_work':False,'notebook_sha256':hashlib.sha256((HERE/'junior-guide.ipynb').read_bytes()).hexdigest(),'working_directory':str(work),'output':str(output),'elapsed_seconds':time.monotonic()-started,'code_cells':sum(c.cell_type=='code' for c in book.cells),'files':files,'errors':[]}
(HERE/f'execution-{mode}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False))
