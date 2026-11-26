"""Generate authored anime briefings; persisted task IDs prevent duplicate submissions."""
import argparse, json, logging, os, re, subprocess, sys
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
import requests
from dashscope import VideoSynthesis
from systemedu.core.config import get_config
from systemedu.core.education import tts

logging.disable(logging.CRITICAL)
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PUBLIC = ROOT / 'packages/student-web/public'
MEDIA = PUBLIC / 'mission/space/expedition-v2'
STORY = json.loads((ROOT/'packages/ios-app/content/space-expedition.json').read_text())
ITEMS = [dict(id='welcome', title='欢迎加入远航队', dialogue='我是林岚，欢迎加入远航队。我们一起寻找证据，设计探测器，把你的发现交给下一班。', image=STORY['commanderImage'])] + STORY['chapters']

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
def ff(*args):
    subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error',*map(str,args)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(path)]))
def folder(item):
    p=HERE/'films'/item['id'];p.mkdir(parents=True,exist_ok=True);return p

def voice(item):
    d=folder(item);target=d/'dialogue.mp3'
    if not target.exists():
        relative,_=tts.synthesize_speech(item['dialogue'],'space-expedition-v2',ITEMS.index(item),'voice.wav')
        ff('-i',tts.SYSTEMEDU_HOME/'media'/relative,'-c:a','libmp3lame','-b:a','128k',target)
    seconds=duration(target);speed=max(1,seconds/8.8)
    if speed>1.22: raise ValueError('Narration too long for natural delivery')
    ff('-i',target,'-af',f'atempo={speed},adelay=400:all=1,apad,atrim=duration=10','-c:a','libmp3lame','-b:a','128k',d/'input-10s.mp3')
    save(d/'audio.json',dict(seconds=seconds,speed=speed,speech_start=.4,speech_end=.4+seconds/speed,voice='configured synthetic voice'))
    prompt=f"原创日式太空科幻动画，延续首帧同一位中国女性科研指挥官林岚：短深蓝黑发、海军蓝和象牙白制服、铜色星徽，保持同一面容、服装和画风。不是写实真人。她面对刚入队的学生，以自然温暖而坚定的语气讲话，严格跟随提供的中文配音，台词是：{item['dialogue']}。前0.4秒自然眨眼，讲话时有轻微点头和一次开放手势，嘴型随声音变化，结束时合嘴。镜头固定中景，背景是同一间太空科研指挥室，无切镜，细腻二维动画表演。不要字幕、文字、水印、额外人物或武器。"
    (d/'prompt.txt').write_text(prompt+'\n')
    print(json.dumps(dict(id=item['id'],audio_ready=True,seconds=round(seconds,2))),flush=True)

def video(item, action):
    d=folder(item);p=d/'task.json';target=d/'source.mp4'
    old=json.loads(p.read_text()) if p.exists() else {}
    key=get_config().tts.api_key or os.environ.get('DASHSCOPE_API_KEY')
    if not key: raise ValueError('Provider not configured')
    if action=='submit':
        if old: return print(json.dumps(dict(id=item['id'],existing_task=True)),flush=True)
        with p.open('x') as stream: json.dump(dict(id=item['id'],status='SUBMITTING'),stream)
        response=VideoSynthesis.async_call(model='wan2.6-i2v',api_key=key,img_url=(MEDIA/'art/commander.png').as_uri(),audio_url=(d/'input-10s.mp3').as_uri(),prompt=(d/'prompt.txt').read_text(),negative_prompt='真人摄影，真实皮肤，换脸，人物变形，嘴型不同步，多余手指，额外人物，字幕，文字，水印，镜头切换',resolution='1080P',duration=10,prompt_extend=False,watermark=False,seed=202611260+ITEMS.index(item))
    else:
        if not old.get('task_id'): raise ValueError('No accepted task ID; do not resubmit')
        if old.get('status')=='SUCCEEDED' and target.exists(): return
        response=VideoSynthesis.fetch(task=old['task_id'],api_key=key)
    out=response.output or {}
    state=dict(id=item['id'],model='wan2.6-i2v',http_status=response.status_code,task_id=out.get('task_id') or old.get('task_id'),status=out.get('task_status'),code=response.code or out.get('code'))
    save(p,state);print(json.dumps(state),flush=True)
    if response.status_code!=200: raise ValueError('Provider request failed')
    if state['status']=='SUCCEEDED':
        url=out.get('video_url');parsed=urlparse(url or '')
        if parsed.scheme!='https' or not parsed.hostname: raise ValueError('Invalid media URL')
        with requests.get(url,stream=True,timeout=(15,120)) as result:
            result.raise_for_status()
            with target.with_suffix('.download').open('wb') as stream:
                for chunk in result.iter_content(1024*1024): stream.write(chunk)
        target.with_suffix('.download').replace(target)
        state['bytes']=target.stat().st_size;save(p,state)

def compose(item):
    d=folder(item);out=MEDIA/'video';out.mkdir(parents=True,exist_ok=True)
    if not (d/'source.mp4').is_file(): raise ValueError('No generated motion clip')
    ff('-i',d/'source.mp4','-vf','scale=1280:720,fps=24','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-b:a','128k',d/'character.mp4')
    # A genuine generated speaking shot, followed by an explicitly separate environment/evidence shot.
    if item['id']!='welcome':
        ff('-loop','1','-i',PUBLIC/item['image'].lstrip('/'),'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','4','-vf','scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=24','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k',d/'equipment.mp4')
        (d/'concat.txt').write_text("file 'character.mp4'\nfile 'equipment.mp4'\n")
        ff('-i',d/'character.mp4','-i',d/'equipment.mp4','-filter_complex','[0:v:0][0:a:0][1:v:0][1:a:0]concat=n=2:v=1:a=1[v][a]','-map','[v]','-map','[a]','-t','14','-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','-ar','48000','-movflags','+faststart',out/(item['id']+'.mp4'))
    else:
        ff('-i',d/'character.mp4','-c','copy','-movflags','+faststart',out/'welcome.mp4')
    audio=json.loads((d/'audio.json').read_text());parts=[s for s in re.split('(?<=[。？])',item['dialogue']) if s]
    time=.4;lines=['WEBVTT','']
    for i,part in enumerate(parts):
        end=time+(audio['speech_end']-.4)*len(part)/len(item['dialogue'])
        lines += [str(i+1),f'00:00:{time:06.3f} --> 00:00:{end:06.3f}',part,''];time=end
    if item['id']!='welcome': lines += ['scene', '00:00:10.000 --> 00:00:14.000', item['shot'], '']
    (out/(item['id']+'.vtt')).write_text('\n'.join(lines))
    ff('-ss','1.2','-i',d/'source.mp4','-frames:v','1','-vf','scale=960:-2',out/(item['id']+'-poster.jpg'))
    print(json.dumps(dict(id=item['id'],composed=True,seconds=duration(out/(item['id']+'.mp4')))),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['voice','submit','fetch','compose']);parser.add_argument('--id');parser.add_argument('--workers',type=int,default=1);args=parser.parse_args()
    tts.SYSTEMEDU_HOME=Path('/tmp/systemedu-expedition-voices-20261126')
    def work(item):
        try:
            if args.action=='voice': voice(item)
            elif args.action=='compose': compose(item)
            else: video(item,args.action)
            return True
        except Exception as exc:
            print(json.dumps(dict(id=item['id'],error_type=type(exc).__name__,no_automatic_resubmission=True)),flush=True);return False
    with tts._without_proxy_env(), ThreadPoolExecutor(max_workers=args.workers) as pool:
        results=list(pool.map(work,[i for i in ITEMS if not args.id or i['id']==args.id]))
    sys.exit(0 if all(results) else 1)
