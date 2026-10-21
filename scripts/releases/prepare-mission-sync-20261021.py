"""Export only committed frontend files differing from the observed server."""
import hashlib, io, json, subprocess, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=Path('/private/tmp/systemedu-sync-20261021')
BASE=json.loads((OUT/'production-baseline.json').read_text())
REF=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
PREFIX='packages/student-web/'
CONFIG=['package.json','package-lock.json','tsconfig.json','next.config.ts','postcss.config.mjs','eslint.config.mjs']
files={}; total=0
process=subprocess.Popen(['git','archive',REF,'packages/student-web'],cwd=ROOT,stdout=subprocess.PIPE)
with tarfile.open(fileobj=process.stdout,mode='r|') as src, tarfile.open(OUT/'frontend.tar.gz','w:gz') as dst:
    for member in src:
        if not member.isfile():continue
        rel=member.name.removeprefix(PREFIX)
        if not rel.startswith(('src/','public/')) and rel not in CONFIG:continue
        if '/._' in rel or '.pre-image-backfill-' in rel:continue
        data=src.extractfile(member).read(); digest=hashlib.sha256(data).hexdigest()
        if BASE['files'].get(rel)==digest:continue
        info=tarfile.TarInfo(rel);info.size=len(data);info.mode=0o644
        dst.addfile(info,io.BytesIO(data));files[rel]=digest;total+=len(data)
assert process.wait()==0
request={'source_commit':REF,'baseline_build':BASE['build'],'config_files':CONFIG,'files':files,'archive_sha256':hashlib.sha256((OUT/'frontend.tar.gz').read_bytes()).hexdigest()}
(OUT/'request.json').write_text(json.dumps(request,indent=2)+'\n')
print(json.dumps({'source_commit':REF,'files':len(files),'uncompressed_mb':round(total/1e6,1),'archive_mb':round((OUT/'frontend.tar.gz').stat().st_size/1e6,1)}))
