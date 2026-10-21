from pathlib import Path
import os
import json,subprocess,logging,re,shutil
from PIL import Image, ImageDraw, ImageFont

logging.disable(logging.CRITICAL)
r=Path(os.environ.get("SYSTEMEDU_ROOT", str(Path(__file__).resolve().parents[2])));pub=r/'packages/student-web/public';work=Path('/tmp/robot-mission-films-20261016');work.mkdir(exist_ok=True);out=pub/'mission/robotics/video';out.mkdir(exist_ok=True)
films=json.loads((r/'packages/student-web/src/lib/project-lines/robotics-stage-films.json').read_text())
def run(cmd):subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def stamp(t):return f'00:{int(t//60):02}:{t%60:06.3f}'
for f in films:
 folder=work/f['station'];folder.mkdir(exist_ok=True);audio=folder/'voice.wav'
 if not audio.exists():
  textfile=folder/'voice.txt';textfile.write_text(f['dialogue']);run(['say','-v','Tingting','-r','175','-f',str(textfile),'-o',str(folder/'voice.aiff')]);run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(folder/'voice.aiff'),str(audio)])
 seconds=float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(audio)]))+1
 font='/System/Library/Fonts/STHeiti Medium.ttc'
 # Deliberately quiet motion: slow camera drift on existing detailed bench imagery, readable mission labels.
 overlay=Image.new('RGBA',(1920,1080),(0,0,0,0));draw=ImageDraw.Draw(overlay)
 draw.rectangle((0,0,1920,180),fill=(8,21,28,210));draw.rectangle((0,770,1920,1080),fill=(8,21,28,220))
 for text,x,y,size,color in [(f"0{f['level']} / ROBOTICS RESEARCH",80,38,28,'#91c9c1'),(f['title'],80,96,44,'white'),('本次任务  /  '+f['action'],80,816,36,'white'),('带往下一站  /  '+f['output'],80,886,32,'#91c9c1'),('任务场景示意 · 原课堂完成制作与正式提交',80,1025,22,'#a7b7be')]:
  draw.text((x,y),text,font=ImageFont.truetype(font,size),fill=color)
 overlay.save(folder/'overlay.png')
 lines=[s for s in re.split('(?<=[。；])',f['dialogue']) if s.strip()];start=0;vtt=['WEBVTT','']
 for idx,line in enumerate(lines):
  end=start+(seconds-1)*len(line)/len(f['dialogue']);file=folder/f'sub-{idx}.txt';file.write_text(line)

  vtt.extend([str(idx+1),f'{stamp(start)} --> {stamp(end)}',line,'']);start=end
 graph=f"[0:v]scale=2200:-1,crop=1920:1080,zoompan=z='min(zoom+0.000035,1.04)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=24[bg];[bg][1:v]overlay=0:0,fade=t=in:st=0:d=0.6,fade=t=out:st={seconds-0.7:.3f}:d=0.7[v]"
 cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-loop','1','-framerate','24','-i',str(pub/f"mission/robotics/stations/{f['station']}-v1-1536.webp"),'-loop','1','-framerate','24','-i',str(folder/'overlay.png'),'-i',str(audio),'-t',str(seconds),'-filter_complex',graph,'-map','[v]','-map','2:a','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(out/f"{f['station']}-v1.mp4")]
 try:run(cmd)
 except subprocess.CalledProcessError as e:print(e.stderr.decode()[-1500:]);raise
 (out/f"{f['station']}-zh-v1.vtt").write_text('\n'.join(vtt));f['duration']=seconds
 print(f['station'],round(seconds,1),'seconds',flush=True)
(r/'artifacts/energy-robotics-integration-20261016/robotics-film-verification.json').write_text(json.dumps(films,ensure_ascii=False,indent=2)+'\n')
