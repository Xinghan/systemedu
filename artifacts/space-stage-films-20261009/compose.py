"""Actual generated character shot + existing static course visuals; no new image calls."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from generate import HERE, PUBLIC, SCRIPTS, ffmpeg, save

OUT=PUBLIC/'mission/space/video'
OUT.mkdir(parents=True,exist_ok=True)

def timestamp(t):
    ms=round(t*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'

def captions(text,start,duration):
    parts=[p for p in re.split(r'(?<=[。；，])',text) if p]
    total=sum(map(len,parts))
    result=[]
    for p in parts:
        end=start+duration*len(p)/total
        result.append(f'{timestamp(start)} --> {timestamp(end)}\n{p}\n')
        start=end
    return result

def compose(item):
    level=item['level'];folder=HERE/f'stage-{level}'
    audio=json.loads((folder/'audio.json').read_text())
    # Cut the generated talking shot shortly after all narration ends.
    character=min(10,audio['speech_end']+0.4)
    still=audio['brief_seconds']+0.9
    total=character+still
    visual=HERE/'stills/printable-rover.png' if level==3 else PUBLIC/item['image']
    inputs=['-i',folder/'source.mp4','-loop','1','-i',visual,'-i',folder/'brief.mp3']
    frame='scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x101e24,setsar=1,fps=30'
    filters=[f'[0:v]{frame},trim=duration={character},setpts=PTS-STARTPTS[v0]',
             f'[0:a]aresample=48000,apad,atrim=duration={character},asetpts=PTS-STARTPTS[a0]']
    if level==5:
        inputs+=['-loop','1','-i',HERE/'stills/lightcurve-development.png']
        # Narration changes to the research direction after the first 30 characters.
        turn=0.35+audio['brief_seconds']*item['brief'].index('行星研究路线')/len(item['brief'])
        filters.extend([f'[1:v]{frame},trim=duration={turn},setpts=PTS-STARTPTS[b0]',
            f'[3:v]{frame},trim=duration={still-turn},setpts=PTS-STARTPTS[b1]',
            '[b0][b1]concat=n=2:v=1:a=0[v1]'])
    else:
        filters.append(f'[1:v]{frame},trim=duration={still},setpts=PTS-STARTPTS[v1]')
    filters.extend([f'[2:a]aresample=48000,adelay=350:all=1,apad,atrim=duration={still},asetpts=PTS-STARTPTS[a1]',
        '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'])
    target=OUT/f'stage-{level}-v1.mp4'
    ffmpeg(*inputs,'-filter_complex',';'.join(filters),'-map','[v]','-map','[a]',
        '-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k','-movflags','+faststart',target)
    cues=captions(item['dialogue'],0.5,audio['speech_end']-0.5)+captions(item['brief'],character+0.35,audio['brief_seconds'])
    (OUT/f'stage-{level}-zh.vtt').write_text('WEBVTT\n\n'+'\n'.join(cues))
    probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_entries',
        'format=duration,size:stream=codec_name,width,height,r_frame_rate,duration','-of','json',str(target)]))
    save(folder/'final-probe.json',{'stage':level,'character_seconds':character,'static_seconds':still,
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),**probe})
    # Contact sheet for temporal inspection. This does not replace watching playback.
    ffmpeg('-i',target,'-vf',f'fps=1/4,scale=480:270,tile=3x2','-frames:v','1',folder/'contact-sheet.jpg')
    print(json.dumps({'stage':level,'seconds':total,'bytes':target.stat().st_size}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--level',type=int);args=parser.parse_args()
    for item in SCRIPTS:
        if args.level and args.level!=item['level']:continue
        compose(item)
