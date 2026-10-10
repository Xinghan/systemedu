"""Compose the approved welcome, one static terrain shot, and one new handover."""
import json, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
MEDIA = ROOT / 'packages/student-web/public/mission/rover'
OUTPUT = MEDIA / 'video/rover-briefing-v1.mp4'
filters = ';'.join([
 '[0:v]scale=1920:1080,setsar=1,fps=30,trim=duration=8.6,setpts=PTS-STARTPTS[v0]',
 '[0:a]aresample=48000,apad,atrim=duration=8.6,asetpts=PTS-STARTPTS[a0]',
 '[1:v]scale=1920:1080,setsar=1,fps=30,trim=duration=10,setpts=PTS-STARTPTS[v1]',
 '[2:a]aresample=48000,adelay=400:all=1,apad,atrim=duration=10,asetpts=PTS-STARTPTS[a1]',
 '[3:v]scale=1920:1080,setsar=1,fps=30,trim=duration=10,setpts=PTS-STARTPTS[v2]',
 '[3:a]aresample=48000,apad,atrim=duration=10,asetpts=PTS-STARTPTS[a2]',
 '[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]',
])
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error',
 '-i',str(MEDIA/'video/lin-lan-welcome-v1.mp4'),
 '-loop','1','-i',str(MEDIA/'terrain-1920.webp'),
 '-i',str(MEDIA/'audio/mission.mp3'), '-i',str(HERE/'handover-source.mp4'),
 '-filter_complex',filters,'-map','[v]','-map','[a]',
 '-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p',
 '-c:a','aac','-b:a','128k','-movflags','+faststart',str(OUTPUT)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_entries',
 'format=duration,size:stream=codec_name,width,height,r_frame_rate,duration','-of','json',str(OUTPUT)]))
(HERE/'final-probe.json').write_text(json.dumps(probe,indent=2)+'\n')
print(json.dumps(probe))
