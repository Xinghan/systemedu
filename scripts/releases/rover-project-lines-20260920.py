"""有哈希约束的增量发布；以生产源码为基线，回退代码时保留学习数据库。"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
from pathlib import Path

ROOT=Path('/opt/systemedu')
R=ROOT/'releases/rover-project-lines-20260920'
UP=Path('/tmp/rover-project-lines-20260920')
WEB='packages/student-web'; APP='packages/student-app'
E=json.loads((UP/'expected.json').read_text())
R.mkdir(mode=0o700,exist_ok=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name,data): (R/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def run(*args,**kwargs): return subprocess.run(args,check=True,**kwargs)
def hashes(root):
 return {str(p.relative_to(root)):sha(p) for p in root.rglob('*') if p.is_file() and not any(x in p.parts for x in ['node_modules','.next','__pycache__']) and p.name!='tsconfig.tsbuildinfo'}
def check_baseline():
 assert (ROOT/WEB/'.next/BUILD_ID').read_text().strip()==E['expected_build']
 for rel,digest in E['baseline'].items():
  path=ROOT/rel
  assert (sha(path) if path.exists() else None)==digest,rel
def wait_url(url):
 for attempt in range(30):
  try:
   with urllib.request.urlopen(url,timeout=5) as response:
    if response.status==200: return
  except Exception: pass
  time.sleep(1)
 raise RuntimeError('健康检查失败: '+url)
action=sys.argv[1]
if action=='stage':
 assert not (R/'stage.ok').exists()
 check_baseline(); assert shutil.disk_usage(R).free>3_000_000_000
 save('web-before.json',hashes(ROOT/WEB)); save('backend-before.json',hashes(ROOT/APP))
 shutil.copytree(ROOT/WEB,R/WEB,ignore=shutil.ignore_patterns('node_modules','.next','public','tsconfig.tsbuildinfo'))
 run('cp','-al',str(ROOT/WEB/'public'),str(R/WEB/'public'))
 run('cp','-al',str(ROOT/WEB/'node_modules'),str(R/WEB/'node_modules'))
 shutil.copytree(ROOT/APP,R/APP,ignore=shutil.ignore_patterns('__pycache__'))
 with tarfile.open(UP/'delta.tar.gz') as tar:
  assert set(tar.getnames())==set(E['files'])
  assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in tar.getmembers())
  for rel in E['files']:
   dest=R/rel
   if dest.exists(): dest.unlink()
  tar.extractall(R)
 for rel,digest in E['files'].items(): assert sha(R/rel)==digest,rel
 for prefix,name in [(WEB,'web'),(APP,'backend')]:
  before=json.loads((R/(name+'-before.json')).read_text()); after=hashes(R/prefix)
  changed={prefix+'/'+p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}
  assert changed=={p for p in E['files'] if p.startswith(prefix+'/')},changed
  save(name+'-expected.json',after)
 shutil.copy2(UP/'expected.json',R/'expected.json')
 (R/'stage.ok').touch();print('255 个文件已隔离暂存；线上源码未修改。')
elif action=='refresh':
 assert not (R/'live.ok').exists()
 old=json.loads((R/'expected.json').read_text())
 rel=WEB+'/src/lib/api/learning-records.ts'
 assert {p for p in old['files'].keys()|E['files'].keys() if old['files'].get(p)!=E['files'].get(p)}=={rel}
 assert old['baseline']==E['baseline'] and sha(R/rel)==old['files'][rel]
 assert sha(UP/'learning-records.ts')==E['files'][rel]
 run('systemctl','stop','systemedu-rover-preview-web')
 shutil.copy2(UP/'learning-records.ts',R/rel)
 save('expected.json',E);save('web-expected.json',hashes(R/WEB))
 (R/'build.ok').unlink(missing_ok=True)
 print('候选记录客户端已补课程编号标识，等待重新构建与验证。')
elif action=='build':
 assert (R/'stage.ok').exists() and not (R/'build.ok').exists()
 if (R/WEB/'node_modules').is_symlink():
  (R/WEB/'node_modules').unlink()
  run('cp','-al',str(ROOT/WEB/'node_modules'),str(R/WEB/'node_modules'))
 env={**os.environ,'NEXT_PUBLIC_STUDENT_API_URL':'','NEXT_PUBLIC_GATEWAY_URL':''}
 with (R/'build.log').open('w') as log:
  run('npm','run','build',cwd=R/WEB,env=env,stdout=log,stderr=subprocess.STDOUT)
 assert (R/WEB/'.next/BUILD_ID').is_file();check_baseline()
 (R/'build.ok').touch();print('隔离构建通过:',(R/WEB/'.next/BUILD_ID').read_text().strip())
elif action=='migrate':
 assert (R/'build.ok').exists() and not (R/'migrate.ok').exists()
 from sqlalchemy import create_engine,text
 engine=create_engine(os.environ['STUDENT_DB_URL'])
 with engine.connect() as conn:
  revisions=list(conn.execute(text('select version_num from alembic_version')).scalars())
  assert revisions==['045_add_invite_codes'],revisions
 save('migration-before.json',{'revisions':revisions})
 with (R/'student-before.dump').open('wb') as backup:
  run('docker','exec','systemedu-postgres','pg_dump','-U','systemedu','-d','student','-Fc',stdout=backup)
 os.chmod(R/'student-before.dump',0o600)
 assert (R/'student-before.dump').stat().st_size>1000
 env={**os.environ,'PYTHONPATH':str(R/APP/'src')}
 run(str(ROOT/'.venv/bin/alembic'),'upgrade','047_learning_records',cwd=R/APP,env=env)
 with engine.connect() as conn:
  assert list(conn.execute(text('select version_num from alembic_version')).scalars())==['047_learning_records']
  for table in ['learning_drafts','learning_submissions']: assert conn.execute(text(f'select count(*) from {table}')).scalar()==0
 (R/'migrate.ok').touch();print('学生数据库备份已保存；仅新增草稿和提交记录两张表。')
elif action=='preview':
 assert (R/'migrate.ok').exists()
 if subprocess.run(['systemctl','is-active','--quiet','systemedu-rover-preview-web']).returncode:
  run('systemd-run','--unit=systemedu-rover-preview-web','--property=WorkingDirectory='+str(R/WEB),'/usr/bin/node',str(R/WEB/'node_modules/next/dist/bin/next'),'start','-p','14000','-H','127.0.0.1')
 if (R/'preview-backend.pid').exists():
  old_pid=int((R/'preview-backend.pid').read_text())
  if Path(f'/proc/{old_pid}/cmdline').exists():
   assert b'systemedu.student.server' in Path(f'/proc/{old_pid}/cmdline').read_bytes()
   os.kill(old_pid,15);time.sleep(2)
 env={**os.environ,'PYTHONPATH':str(R/APP/'src'),'STUDENT_PORT':'18823','STUDENT_BIND_HOST':'127.0.0.1','STUDENT_SKIP_TUTOR_PRELOAD':'1','STUDENT_MOLECULE_NUMBERING':'consecutive-v2'}
 log=(R/'preview-backend.log').open('a')
 p=subprocess.Popen([str(ROOT/'.venv/bin/python'),'-m','systemedu.student.server'],cwd=R,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 (R/'preview-backend.pid').write_text(str(p.pid))
 wait_url('http://127.0.0.1:18823/api/health'); wait_url('http://127.0.0.1:14000/library?view=lines')
 print('候选前后端可供验证：仅监听服务器本机 14000 / 18823。')
elif action=='publish':
 assert (R/'migrate.ok').exists() and (UP/'preview-verified.json').exists() and not (R/'live.ok').exists()
 verified=json.loads((UP/'preview-verified.json').read_text()); assert verified['passed'] and verified['files']==E['files']
 check_baseline()
 for prefix,name in [(WEB,'web'),(APP,'backend')]: assert hashes(ROOT/prefix)==json.loads((R/(name+'-before.json')).read_text())
 # 只替换源码和构建；新表为兼容性新增，失败回退也不删除任何学习数据。
 shutil.copytree(ROOT/WEB/'.next/static',R/WEB/'.next/static',dirs_exist_ok=True)
 run('systemctl','stop','systemedu-rover-preview-web','systemedu-student-web','systemedu-student-backend')
 (R/'switch-started.ok').touch()
 (ROOT/WEB).rename(R/'student-web-before');(R/WEB).rename(ROOT/WEB)
 for rel in E['files']:
  if rel.startswith(APP+'/'):
   src=R/rel;dst=ROOT/rel;backup=R/'backend-files-before'/rel
   if dst.exists(): backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dst,backup)
   dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
 run('systemctl','start','systemedu-student-backend','systemedu-student-web')
 wait_url('http://127.0.0.1:18820/api/health');wait_url('http://127.0.0.1:4000/library?view=lines')
 for rel,digest in E['files'].items(): assert sha(ROOT/rel)==digest,rel
 (R/'live.ok').touch();print('生产已切换:',(ROOT/WEB/'.next/BUILD_ID').read_text().strip())
elif action=='rollback':
 assert (R/'switch-started.ok').exists()
 run('systemctl','stop','systemedu-student-web','systemedu-student-backend')
 if (R/'student-web-before').exists():
  if (ROOT/WEB).exists(): (ROOT/WEB).rename(R/'student-web-failed')
  (R/'student-web-before').rename(ROOT/WEB)
 for rel in E['files']:
  if rel.startswith(APP+'/') and not rel.endswith('047_learning_records.py'):
   backup=R/'backend-files-before'/rel
   if backup.exists(): shutil.copy2(backup,ROOT/rel)
 # 迁移定义必须保留，使旧服务可以识别新增且无破坏性的数据库 revision。
 run('systemctl','start','systemedu-student-backend','systemedu-student-web')
 wait_url('http://127.0.0.1:18820/api/health');wait_url('http://127.0.0.1:4000/')
 (R/'rolled-back.ok').touch();print('旧版本已恢复；数据库记录和新增表均保留。')
elif action=='finish':
 assert (R/'live.ok').exists()
 if subprocess.run(['systemctl','is-active','--quiet','systemedu-rover-preview-web']).returncode==0:
  run('systemctl','stop','systemedu-rover-preview-web')
 if (R/'preview-backend.pid').exists():
  pid=int((R/'preview-backend.pid').read_text())
  if Path(f'/proc/{pid}/cmdline').exists():
   assert b'systemedu.student.server' in Path(f'/proc/{pid}/cmdline').read_bytes()
   os.kill(pid,15)
 (R/'finished.ok').touch()
 print('候选服务已停止；前端、源码、数据库备份仍保留。')
else: raise SystemExit('stage | build | migrate | preview | publish | rollback | finish')
