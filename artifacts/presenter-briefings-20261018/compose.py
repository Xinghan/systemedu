"""Prepend the actual generated speaking shot; preserve the existing stage explanation."""
from pathlib import Path
import argparse,hashlib,json,math,re,subprocess
H=Path(__file__).resolve().parent;R=H.parents[1];P=R/'packages/student-web/public';ITEMS=json.loads((H/'scripts.json').read_text())
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
def parse(t):h,m,s=map(float,t.split(':'));return h*3600+m*60+s
def ff(*args):subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error',*map(str,args)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def compose(f):
 d=H/f['line']/f['station'];audio=json.loads((d/'audio.json').read_text());task=json.loads((d/'task.json').read_text());assert task['status']=='SUCCEEDED'
 out=P/f"mission/{f['line']}/video";target=out/f"{f['station']}-v2.mp4";char=math.ceil(min(10,audio['speech_end']+.4)*24)/24
 if target.exists() and (d/'final-probe.json').exists():return
 frame='scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=24'
 graph=f'[0:v]{frame},trim=duration={char},setpts=PTS-STARTPTS[v0];[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={char},asetpts=PTS-STARTPTS[a0];[2:v]{frame},setpts=PTS-STARTPTS[v1];[2:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'
 ff('-i',d/'source.mp4','-i',d/'input-10s.mp3','-i',out/f"{f['station']}-v1.mp4",'-filter_complex',graph,'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',target)
 lines=[s for s in re.split(r'(?<=[，。？；])',f['dialogue'])if s];start=.5;cues=[]
 for line in lines:
  end=start+(audio['speech_end']-.5)*len(line)/len(f['dialogue']);cues.append(f'{stamp(start)} --> {stamp(end)}\n{line}\n');start=end
 old=(out/f"{f['station']}-zh-v1.vtt").read_text().replace('WEBVTT','',1).strip()
 shifted=re.sub(r'(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})',lambda m:stamp(parse(m[1])+char)+' --> '+stamp(parse(m[2])+char),old)
 (out/f"{f['station']}-zh-v2.vtt").write_text('WEBVTT\n\n'+'\n'.join(cues)+'\n'+shifted+'\n')
 probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_streams','-show_format','-of','json',target]));report={**f,'character_seconds':char,'speech_start':.5,'speech_end':audio['speech_end'],'duration':float(probe['format']['duration']),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'video':[{k:s.get(k)for k in ['codec_type','codec_name','width','height','r_frame_rate']}for s in probe['streams']]}
 (d/'final-probe.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');ff('-i',d/'source.mp4','-vf','fps=1/2,scale=480:270,tile=3x2','-frames:v','1',d/'contact-sheet.jpg')
 print(json.dumps({'line':f['line'],'station':f['station'],'character_seconds':char,'duration':report['duration'],'bytes':report['bytes']}),flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--line');parser.add_argument('--station');args=parser.parse_args()
 for f in ITEMS:
  if(args.line and f['line']!=args.line)or(args.station and f['station']!=args.station):continue
  compose(f)
