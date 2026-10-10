"""Mux measured narration segments and captions; preserve the full spoken sentences."""
import hashlib,json,re,subprocess
from pathlib import Path
H=Path(__file__).resolve().parent;R=H.parents[1];OUT=R/'packages/student-web/public/mission/energy/video';OUT.mkdir(parents=True,exist_ok=True)
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
reports=[]
for item in json.loads((H/'scripts.json').read_text()):
 f=H/f"stage-{item['level']}";audio=json.loads((f/'audio.json').read_text());args=['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(f/'silent.mp4')];filters=[]
 for i,length in enumerate(audio['lengths']):
  args+=['-i',str(f/f'voice-{i}.mp3')];filters.append(f'[{i+1}:a]aresample=48000,adelay=200:all=1,apad,atrim=duration={length},asetpts=PTS-STARTPTS[a{i}]')
 filters.append('[a0][a1][a2][a3]concat=n=4:v=0:a=1[a]');target=OUT/f"{item['station']}-v1.mp4"
 subprocess.run(args+['-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart',str(target)],check=True)
 cues=[];start=0
 for text,duration,length in zip([item['dialogue']]+[s['voice'] for s in item['steps']],audio['seconds'],audio['lengths']):
  words=[p for p in re.split(r'(?<=[。；，？])',text) if p];total=sum(map(len,words));t=start+.2
  for part in words:
   end=t+duration*len(part)/total;cues.append(f'{stamp(t)} --> {stamp(end)}\n{part}\n');t=end
  start+=length
 (OUT/f"{item['station']}-zh-v1.vtt").write_text('WEBVTT\n\n'+'\n'.join(cues))
 probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate','-of','json',str(target)]))
 report={'station':item['station'],'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'narration_seconds':audio['seconds'],**probe};reports.append(report);print(json.dumps({'station':item['station'],'seconds':probe['format']['duration'],'bytes':target.stat().st_size}),flush=True)
(H/'media-verification.json').write_text(json.dumps(reports,indent=2)+'\n')
