"""Generated speaking footage followed by existing mission scenery and authored narration."""
import argparse
import hashlib
import json
import re
import subprocess
from generate import HERE, PUBLIC, SCRIPTS, ffmpeg, save

OUT = PUBLIC / 'mission/biomedicine/video'

def timestamp(t):
    ms=round(t*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'

def captions(text,start,duration):
    # Phrase timing is estimated from character count, not forced word alignment.
    parts=[p for p in re.split(r'(?<=[。；，：？])',text) if p]
    total=sum(map(len,parts)); result=[]
    for part in parts:
        end=start+duration*len(part)/total
        result.append(f'{timestamp(start)} --> {timestamp(end)}\n{part}\n'); start=end
    return result

def compose(item):
    folder=HERE/f"stage-{item['level']}"
    audio=json.loads((folder/'audio.json').read_text())
    character=min(10,audio['speech_end']+0.4)
    still=audio['brief_seconds']+0.9
    visual=PUBLIC/f"mission/biomedicine/stations/{item['station']}-v1-1536.webp"
    frame='scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x101e24,setsar=1,fps=30'
    filters=[f'[0:v]{frame},trim=duration={character},setpts=PTS-STARTPTS[v0]',
        f'[0:a]aresample=48000,apad,atrim=duration={character},asetpts=PTS-STARTPTS[a0]',
        f'[1:v]{frame},trim=duration={still},setpts=PTS-STARTPTS[v1]',
        f'[2:a]aresample=48000,adelay=350:all=1,apad,atrim=duration={still},asetpts=PTS-STARTPTS[a1]',
        '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]']
    target=OUT/f"{item['station']}-v1.mp4"
    ffmpeg('-i',folder/'source.mp4','-loop','1','-i',visual,'-i',folder/'brief.mp3',
        '-filter_complex',';'.join(filters),'-map','[v]','-map','[a]',
        '-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k','-movflags','+faststart',target)
    cues=captions(item['dialogue'],0.5,audio['speech_end']-0.5)+captions(item['brief'],character+0.35,audio['brief_seconds'])
    (OUT/f"{item['station']}-zh-v1.vtt").write_text('WEBVTT\n\n'+'\n'.join(cues))
    probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate,duration','-of','json',str(target)]))
    save(folder/'final-probe.json',{'station':item['station'],'character_seconds':character,'static_seconds':still,
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),**probe})
    ffmpeg('-i',target,'-vf','fps=1/4,scale=480:270,tile=3x3','-frames:v','1',folder/'contact-sheet.jpg')
    print(json.dumps({'station':item['station'],'seconds':character+still,'bytes':target.stat().st_size}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--level',type=int);args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    for item in SCRIPTS:
        if args.level and args.level!=item['level']:continue
        compose(item)
