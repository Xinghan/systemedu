"""Check delivered streams, captions, faststart and preservation of authored speech."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
import numpy as np

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'packages/student-web/public/mission/biomedicine/video'
def pcm(path,limit):
    return np.frombuffer(subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',str(path),'-t',str(limit),'-f','s16le','-ac','1','-ar','16000','-']),dtype=np.int16).astype(float)
def seconds(t):
    h,m,s=t.split(':');return int(h)*3600+int(m)*60+float(s)
scripts=json.loads((HERE/'scripts.json').read_text())
manifest=json.loads((HERE.parents[1]/'packages/student-web/src/lib/project-lines/biomed-stage-films.json').read_text())
assert manifest==[{k:v for k,v in item.items() if k!='gesture'} for item in scripts]
results=[]
for item in json.loads((HERE/'scripts.json').read_text()):
    n=item['level'];station=item['station']
    folder=HERE/f'stage-{n}';path=OUT/f'{station}-v1.mp4'
    probe=json.loads((folder/'final-probe.json').read_text())
    duration=float(probe['format']['duration']);streams=probe['streams']
    assert 18<duration<40 and streams[0]['width']==1920 and streams[0]['height']==1080
    assert streams[0]['codec_name']=='h264' and streams[1]['codec_name']=='aac'
    raw=path.read_bytes();assert 0<raw.index(b'moov')<raw.index(b'mdat')
    cues=re.findall(r'(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})',(OUT/f'{station}-zh-v1.vtt').read_text())
    previous=0
    for start,end in cues:
        start,end=seconds(start),seconds(end)
        assert previous<=start<end<=duration;previous=end
    assert len(cues)>=6
    authored=pcm(folder/'input-10s.mp3',probe['character_seconds'])
    delivered=pcm(path,probe['character_seconds'])
    length=min(len(authored),len(delivered));correlation=float(np.corrcoef(authored[:length],delivered[:length])[0,1])
    assert correlation>.95, (n,correlation)
    results.append({'station':station,'seconds':duration,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
        'captions':len(cues),'speech_waveform_correlation':correlation,'faststart':True,'streams':'1920x1080 H.264 + AAC'})
assert len({r['sha256'] for r in results})==8
(HERE/'media-verification.json').write_text(json.dumps({'passed':True,'videos':results},indent=2)+'\n')
print(json.dumps({'passed':True,'videos':results},indent=2))
