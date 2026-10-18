"""Verify real presenter media, preserved briefings, captions and untouched lab backgrounds."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess
H=Path(__file__).resolve().parent;R=H.parents[1];P=R/'packages/student-web/public'
parser=argparse.ArgumentParser();parser.add_argument('--partial',action='store_true');args=parser.parse_args()
items=json.loads((H/'scripts.json').read_text());report={'passed':False,'films':[]};tasks=set()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def seconds(t):h,m,s=map(float,t.split(':'));return h*3600+m*60+s
try:
 for f in items:
  d=H/f['line']/f['station']
  if args.partial and not (d/'final-probe.json').exists():continue
  state=json.loads((d/'task.json').read_text());probe=json.loads((d/'final-probe.json').read_text())
  assert state['status']=='SUCCEEDED' and state['task_id'] not in tasks;tasks.add(state['task_id'])
  video=P/f"mission/{f['line']}/video/{f['station']}-v2.mp4"
  p=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_streams','-show_format','-of','json',video]));duration=float(p['format']['duration'])
  v=next(s for s in p['streams'] if s['codec_type']=='video');a=next(s for s in p['streams'] if s['codec_type']=='audio')
  assert (v['codec_name'],v['width'],v['height'],v['r_frame_rate'])==('h264',1920,1080,'24/1') and a['codec_name']=='aac'
  assert sha(video)==probe['sha256'] and .5<probe['speech_end']<probe['character_seconds']<=10
  assert abs(duration-probe['duration'])<.05
  captions=video.with_name(f"{f['station']}-zh-v2.vtt").read_text();assert captions.startswith('WEBVTT')
  cues=re.findall(r'(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})',captions)
  assert all(0<=seconds(s)<seconds(e)<=duration+.05 for s,e in cues)
  assert all(seconds(cues[i][1])<=seconds(cues[i+1][0])+.002 for i in range(len(cues)-1))
  plain=lambda s:''.join(x for x in s if not x.isspace())
  assert plain(f['dialogue']) in plain(re.sub(r'.*-->.*','',captions))
  old=video.with_name(f"{f['station']}-zh-v1.vtt").read_text()
  old_text=plain(re.sub(r'.*-->.*','',old).replace('WEBVTT',''))
  assert old_text in plain(re.sub(r'.*-->.*','',captions))
  report['films'].append({'line':f['line'],'station':f['station'],'seconds':duration,'speaker_seconds':probe['character_seconds'],'bytes':video.stat().st_size,'captions':len(cues)})
 background=json.loads((H/'unchanged-backgrounds.json').read_text())
 # The manifest records exact root-relative paths; stage presenter art is separate.
 for name,value in background.items():
  assert sha(R/name)==value, f'Background changed: {name}'
 assert args.partial or len(tasks)==40
 report.update(passed=True,partial=args.partial,unique_video_tasks=len(tasks),backgrounds_preserved=len(background))
finally:
 (H/('media-partial-verification.json' if args.partial else 'media-verification.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='films'}))
