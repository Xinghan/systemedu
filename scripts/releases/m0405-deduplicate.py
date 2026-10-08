"""Hash-identical immutable media only; preserve all paths, modes and owners."""
import hashlib,json,os,sys
from pathlib import Path
base=Path('/opt/systemedu/releases')
roots=[Path('/root/.systemedu-library/media/projects/molecule-monster-hunter')]+[base/p for p in [
 'slides-20260908/course/molecule-monster-hunter','m0203-evidence-20260910/course/molecule-monster-hunter','m0203-evidence-20260910/course-before','m81-evidence-20260908/course/molecule-monster-hunter','m87-m89-evidence-20260909/course/molecule-monster-hunter','m01-evidence-20260910/course/molecule-monster-hunter','m01-evidence-20260910/course-before']]
extensions={'.wav','.mp3','.ogg','.png','.jpg','.jpeg','.webp','.mp4'}
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
groups={};inodes={};paths={}
for root in roots:
 assert root.is_dir(),str(root)
 for p in root.rglob('*'):
  if not p.is_file() or p.is_symlink() or p.suffix.lower() not in extensions:continue
  s=p.stat();inode=(s.st_dev,s.st_ino)
  if inode not in inodes:inodes[inode]={'hash':digest(p),'stat':s,'paths':[]}
  inodes[inode]['paths'].append(p);paths[str(p)]=inodes[inode]['hash']
for inode,v in inodes.items():
 s=v['stat'];key=(v['hash'],s.st_dev,s.st_size,s.st_mode,s.st_uid,s.st_gid)
 groups.setdefault(key,[]).append(inode)
plan=[];reclaim=0
for key,ids in groups.items():
 if len(ids)<2:continue
 source=inodes[ids[0]]['paths'][0]
 for inode in ids[1:]:
  entry=inodes[inode]
  if entry['stat'].st_nlink==len(entry['paths']):reclaim+=entry['stat'].st_blocks*512
  for p in entry['paths']:plan.append((source,p,inode,key[0]))
report={'matching_paths':len(plan),'reclaimable_bytes_minimum':reclaim,'all_paths_retained':True,'mode':sys.argv[1]}
if sys.argv[1]=='apply':
 for source,p,inode,h in plan:
  stat=p.stat();assert (stat.st_dev,stat.st_ino)==inode,'Concurrent replacement'
  assert digest(source)==h and digest(p)==h
  temp=p.with_name(p.name+'.m0405-dedup');assert not temp.exists()
  os.link(source,temp);os.replace(temp,p)
 assert all(digest(Path(p))==h for p,h in paths.items()),'Post-dedup content mismatch'
 report['free_bytes']=os.statvfs(base).f_bavail*os.statvfs(base).f_frsize
 Path('/tmp/m0405-dedup-result.json').write_text(json.dumps(report))
elif sys.argv[1]!='audit':raise SystemExit('audit or apply')
print(json.dumps(report))
