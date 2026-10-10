"""Real generated laboratory speaking shot + three synchronized instructional sequences."""
import argparse
import hashlib
import json
import math
import re
import subprocess
from generate import HERE, PUBLIC, SCRIPTS, ffmpeg, save

OUT=PUBLIC/'mission/biomedicine/video'
def timestamp(t):
    ms=round(t*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
def captions(text,start,duration):
    # Measured segment start; short-phrase positions estimated within that audio.
    parts=[p for p in re.split(r'(?<=[。；，：？])',text) if p]
    total=sum(map(len,parts));result=[]
    for part in parts:
        end=start+duration*len(part)/total
        result.append(f'{timestamp(start)} --> {timestamp(end)}\n{part}\n');start=end
    return result
def compose(item):
    folder=HERE/f"stage-{item['level']}"
    audio=json.loads((folder/'audio.json').read_text())
    timing=json.loads((folder/'demo-timing.json').read_text())
    character=math.ceil(min(10,audio['speech_end']+.4)*30)/30;demo=timing['duration']
    frame='scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30'
    filters=[f'[0:v]{frame},trim=duration={character},setpts=PTS-STARTPTS[v0]',
        f'[0:a]aresample=48000,apad,atrim=duration={character},asetpts=PTS-STARTPTS[a0]',
        f'[1:v]{frame},trim=duration={demo},setpts=PTS-STARTPTS,fade=t=in:d=0.2[v1]']
    for i,length in enumerate(timing['lengths']):
        filters.append(f'[{i+2}:a]aresample=48000,adelay=350:all=1,apad,atrim=duration={length},asetpts=PTS-STARTPTS[s{i}]')
    filters.extend(['[s0][s1][s2]concat=n=3:v=0:a=1[a1]','[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'])
    target=OUT/f"{item['station']}-v2.mp4"
    inputs=['-i',folder/'source.mp4','-i',folder/'demo.mp4']
    for i in range(1,4):inputs+=['-i',folder/f'step{i}.mp3']
    ffmpeg(*inputs,'-filter_complex',';'.join(filters),'-map','[v]','-map','[a]',
        '-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k','-movflags','+faststart',target)
    cues=captions(item['dialogue'],.5,audio['speech_end']-.5)
    start=character
    for i,step in enumerate(item['steps']):
        cues+=captions(step['voice'],start+.35,audio['step_seconds'][i]);start+=timing['lengths'][i]
    (OUT/f"{item['station']}-zh-v2.vtt").write_text('WEBVTT\n\n'+'\n'.join(cues))
    probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate,duration','-of','json',str(target)]))
    save(folder/'final-probe.json',{'station':item['station'],'character_seconds':character,'demo_seconds':demo,
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),**probe})
    ffmpeg('-i',target,'-vf','fps=1/3,scale=480:270,tile=3x3','-frames:v','1',folder/'contact-sheet.jpg')
    print(json.dumps({'station':item['station'],'seconds':character+demo,'bytes':target.stat().st_size}),flush=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--level',type=int);args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    for item in SCRIPTS:
        if args.level and args.level!=item['level']:continue
        compose(item)
