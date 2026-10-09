"""Five authored briefings. One paid video submission per stage; fetch never resubmits."""
import argparse
import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from dashscope import VideoSynthesis
from systemedu.core.config import get_config
from systemedu.core.education import tts

logging.disable(logging.CRITICAL)  # Never log provider exceptions/URLs/credentials.
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PUBLIC = ROOT / 'packages/student-web/public'
SCRIPTS = json.loads((HERE / 'scripts.json').read_text())

def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *map(str, args)], check=True)

def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(path)]))

def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def voice(item):
    folder=HERE/f"stage-{item['level']}"
    folder.mkdir(exist_ok=True)
    tts.SYSTEMEDU_HOME=Path('/tmp/systemedu-space-stage-voices-20261009')
    for offset,part in enumerate(['dialogue','brief']):
        target=folder/f'{part}.mp3'
        if not target.exists():
            relative,_=tts.synthesize_speech(item[part],'space-stage-films',item['level']*2+offset,'voice.wav')
            ffmpeg('-i',tts.SYSTEMEDU_HOME/'media'/relative,'-c:a','libmp3lame','-b:a','128k',target)
    seconds=duration(folder/'dialogue.mp3')
    # Fit all spoken audio; reject overlong scripts instead of cutting words.
    speed=max(1,seconds/8.8)
    if speed>1.2:
        raise ValueError('Narration too long for natural ten-second delivery')
    ffmpeg('-i',folder/'dialogue.mp3','-af',f'atempo={speed},adelay=500:all=1,apad,atrim=duration=10','-c:a','libmp3lame','-b:a','128k',folder/'input-10s.mp3')
    save(folder/'audio.json',{'dialogue_seconds':seconds,'speed':speed,'speech_start':0.5,'speech_end':0.5+seconds/speed,'brief_seconds':duration(folder/'brief.mp3')})
    prompt=f"写实电影单镜头，延续首帧同一位中国女性工程师林岚的身份、面容、发型、夹克和控制室。第一人称视角，她向坐在对面的学生介绍任务。自然、专注、友好的表演。前0.5秒自然眨眼，之后严格跟随提供的中文音频讲话，台词为‘{item['dialogue']}’。{item['gesture']}。音频结束时合嘴，不添加额外台词。固定中景镜头，背景设备稳定，无切镜，无夸张运镜。真实皮肤与自然口型，手指正常。不要字幕、文字、额外人物、武器、太空服。"
    (folder/'prompt.txt').write_text(prompt+'\n')
    print(json.dumps({'stage':item['level'],'audio_ready':True,'seconds':seconds,'speed':speed}),flush=True)

def video(item, action):
    folder=HERE/f"stage-{item['level']}"
    state_path=folder/'task.json'
    target=folder/'source.mp4'
    key=get_config().tts.api_key or os.environ.get('DASHSCOPE_API_KEY')
    if not key: raise ValueError('Provider not configured')
    previous=json.loads(state_path.read_text()) if state_path.exists() else {}
    if action=='submit':
        if previous:
            print(json.dumps({'stage':item['level'],'skipped_existing_task':True}),flush=True)
            return
        # Save an intent BEFORE the remote mutation: a timeout requires human review,
        # never another automatic paid submission.
        save(state_path,{'stage':item['level'],'status':'SUBMITTING'})
        response=VideoSynthesis.async_call(model='wan2.6-i2v',api_key=key,
            img_url=(PUBLIC/'mission/rover/engineer-1920.webp').as_uri(),
            audio_url=(folder/'input-10s.mp3').as_uri(),prompt=(folder/'prompt.txt').read_text(),
            negative_prompt='换脸，人物变形，夸张笑容，嘴型不同步，机械动作，多余手指，融化的手，屏幕扭曲，镜头切换，字幕，文字，额外人物',
            resolution='1080P',duration=10,prompt_extend=False,watermark=False,seed=20261009+item['level'])
    else:
        if not previous.get('task_id'): raise ValueError('No accepted task to fetch')
        if previous.get('status')=='SUCCEEDED' and target.exists():
            print(json.dumps({'stage':item['level'],'already_downloaded':True}),flush=True)
            return
        response=VideoSynthesis.fetch(task=previous['task_id'],api_key=key)
    output=response.output or {}
    state={'stage':item['level'],'model':'wan2.6-i2v','resolution':'1080P','duration':10,
        'http_status':response.status_code,'task_id':output.get('task_id') or previous.get('task_id'),
        'status':output.get('task_status'),'code':response.code or output.get('code')}
    save(state_path,state)
    print(json.dumps(state),flush=True)
    if response.status_code!=200: raise ValueError('Provider request failed')
    if state['status']=='SUCCEEDED':
        url=output.get('video_url')
        parsed=urlparse(url or '')
        if parsed.scheme!='https' or not parsed.hostname: raise ValueError('No secure output URL')
        # Provider credential is never forwarded to the generated-media host.
        with requests.get(url,stream=True,timeout=(15,120)) as result:
            result.raise_for_status()
            temp=target.with_suffix('.download')
            with temp.open('wb') as stream:
                for chunk in result.iter_content(1024*1024): stream.write(chunk)
            temp.replace(target)
        state.update(local_video=str(target.relative_to(ROOT)),bytes=target.stat().st_size)
        save(state_path,state)
        print(json.dumps({'stage':item['level'],'downloaded_bytes':state['bytes']}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['voice','submit','fetch'])
    parser.add_argument('--level',type=int)
    args=parser.parse_args()
    failed=False
    for item in SCRIPTS:
        if args.level and item['level']!=args.level: continue
        try:
            with tts._without_proxy_env():
                voice(item) if args.action=='voice' else video(item,args.action)
        except Exception as exc:
            print(f"Stage {item['level']} failed: {type(exc).__name__}; no video resubmission.",file=sys.stderr)
            failed=True
    sys.exit(1 if failed else 0)
