"""Resumable multi-shot animation, sentence-aligned narration, and exact teaching motion."""
import argparse
import concurrent.futures
import importlib.util
import json
import logging
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

import dashscope
import requests
from dashscope import VideoSynthesis
from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer
from PIL import Image, ImageDraw, ImageFont
from systemedu.core.config import get_config
from systemedu.core.education.tts import _without_proxy_env

logging.disable(logging.CRITICAL)
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
WORK=Path('/tmp/systemedu-lesson-films-v2')
PUBLIC=ROOT/'packages/student-web/public'
MEDIA=PUBLIC/'mission/space/expedition-v2'
STORY=json.loads((HERE/'storyboards.json').read_text())
OLD=json.loads((HERE.parent/'lesson-summaries/dialogue.json').read_text())
VOICE='qwen-audio-3.1-tts-plus-vd-linlan-7a2e1e41aaad45129bea81dfa67553a1'
MODEL='qwen-audio-3.1-tts-plus'
MUSIC=HERE.parent/'completion-film-commander-voice/Firmament_Active.mp3'
CREDIT=json.loads((HERE.parent/'lesson-summaries/M01/composition.json').read_text())['musicCredit']

def save(path,obj): path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def ff(*args):
    subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-threads','2','-filter_complex_threads','1',*map(str,args)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(path)]))

def prepare_audio(ident):
    folder=HERE/ident;folder.mkdir(exist_ok=True)
    work=WORK/ident;work.mkdir(parents=True,exist_ok=True)
    item=STORY[ident];texts=[item['intro'],*item['narration'],*item['demo']]
    cues=[];cursor=.25
    for i,text in enumerate(texts):
        raw=folder/f'voice-{i+1}.mp3'; normalized=work/f'voice-{i+1}.wav'
        if not raw.exists():
            data=SpeechSynthesizer(model=MODEL,voice=VOICE,format=AudioFormat.MP3_48000HZ_MONO_256KBPS).call(text,timeout_millis=90000)
            if not data: raise ValueError('Empty TTS audio')
            raw.write_bytes(data)
        ff('-i',raw,'-af','loudnorm=I=-18:TP=-2:LRA=7','-ar','48000','-ac','2',normalized)
        length=duration(normalized)
        if i==3: cursor=15.25
        cues.append(dict(text=text,start=round(cursor,3),end=round(cursor+length,3),section='intro' if i==0 else ('scene' if i<3 else 'demo')))
        cursor+=length+.35
    if cues[2]['end']>14.7: raise ValueError(f'{ident}: head narration is too long; shorten text, never rush voice')
    total=round(cues[-1]['end']+1.8,3)
    inputs=[];filters=[]
    for i,cue in enumerate(cues):
        inputs+=['-i',work/f'voice-{i+1}.wav']
        filters.append(f'[{i}:a]adelay={round(cue["start"]*1000)}:all=1[a{i}]')
    filters.append(''.join(f'[a{i}]' for i in range(len(cues)))+f'amix=inputs={len(cues)}:normalize=0,apad,atrim=duration={total}[a]')
    ff(*inputs,'-filter_complex',';'.join(filters),'-map','[a]','-ar','48000','-ac','2',folder/'narration.wav')
    ff('-i',folder/'narration.wav','-t',15,'-c:a','libmp3lame','-b:a','160k',work/'head.mp3')
    first_cut=round(cues[0]['end']+.2,2)
    cuts=[0,first_cut,round(first_cut+(15-first_cut)/3,2),round(first_cut+2*(15-first_cut)/3,2),15]
    timeline=dict(voice=VOICE,model=MODEL,speed=1,pitch=1,cues=cues,scene_cuts=cuts,demo_start=15,seconds=total)
    save(folder/'timeline.json',timeline)
    return timeline

def generate(ident):
    timeline=prepare_audio(ident);folder=HERE/ident;work=WORK/ident
    item=STORY[ident];cuts=timeline['scene_cuts']
    prompt=f'原创日式太空科幻动画，精致二维动画作画，16:9。必须是四个清楚切换场景的分镜，不是一直拍人物，不是静态幻灯片。保持海军蓝、象牙白和琥珀金色调，但不同镜头的对象和机位必须明显变化。\n镜头1 [0-{cuts[1]}秒]：固定的中国科研指挥官林岚沿用首帧的面容、短深蓝黑发、海军蓝和象牙白制服与铜色星徽，沉稳坚定，直接对学生说：{item["intro"]}嘴型跟随提供音频，说完后镜头立即切走。'
    for i,shot in enumerate(item['shots']):
        prompt+=f'\n镜头{i+2} [{cuts[i+1]}-{cuts[i+2]}秒]：{shot} 此镜只保留林岚画外音，不再显示指挥室里的正面讲话人物。'
    prompt+='\n必须真正发生动作和镜头切换。所有后续画面为解释任务的卡通情境示意，不声称真实观测或学生已经交付。不生成文字、数字、字幕、水印、徽标或额外说话人物。不把静态画面缩放当作动作。'
    (folder/'prompt.txt').write_text(prompt+'\n')
    taskfile=folder/'task.json'
    state=json.loads(taskfile.read_text()) if taskfile.exists() else {}
    if not state:
        save(taskfile,{'status':'SUBMITTING','model':'wan2.6-i2v','shot_type':'multi','prompt_extend':True})
        response=VideoSynthesis.async_call(model='wan2.6-i2v',api_key=dashscope.api_key,img_url=(MEDIA/'art/commander.png').as_uri(),audio_url=(work/'head.mp3').as_uri(),prompt=prompt,negative_prompt='单一人物讲话镜头，始终同一场景，只有推拉镜头，静态图片缩放，真人摄影，写实皮肤，换脸，畸形手指，额外说话者，字幕，文字，数字，水印',resolution='1080P',duration=15,shot_type='multi',prompt_extend=True,watermark=False,seed=202611280+int(ident[1:]))
        result=response.output or {}
        state=dict(model='wan2.6-i2v',shot_type='multi',prompt_extend=True,task_id=result.get('task_id'),status=result.get('task_status'),http_status=response.status_code,code=response.code or result.get('code'))
        save(taskfile,state)
        if response.status_code!=200: raise ValueError(f'Submission failed: {state["code"]}')
    if not state.get('task_id'): raise ValueError('Unconfirmed submission: inspect before retrying')
    source=work/'source.mp4'
    while not source.exists():
        response=VideoSynthesis.fetch(task=state['task_id'],api_key=dashscope.api_key);result=response.output or {}
        state.update(status=result.get('task_status'),http_status=response.status_code,code=response.code or result.get('code'));save(taskfile,state)
        print(json.dumps({'lesson':ident,'status':state['status']},ensure_ascii=False),flush=True)
        if response.status_code!=200 or state['status'] in ['FAILED','CANCELED','UNKNOWN']: raise ValueError(f'Generation failed: {state["code"]}')
        if state['status']=='SUCCEEDED':
            url=result.get('video_url','');assert urlparse(url).scheme=='https'
            with requests.get(url,stream=True,timeout=(15,120)) as response:
                response.raise_for_status()
                with (work/'source.download').open('wb') as stream:
                    for block in response.iter_content(1024*1024):stream.write(block)
            (work/'source.download').replace(source)
        else: time.sleep(30)
    # Persist the actual animated scenes separately from the teaching diagram.
    ff('-i',source,'-t',15,'-vf','scale=1280:720,fps=24','-an','-c:v','libx264','-crf',20,'-pix_fmt','yuv420p',folder/'generated-scenes.mp4')
    print(json.dumps({'lesson':ident,'status':'SCENES_READY'}),flush=True)

def compose(ident):
    from visuals import render,render_insert
    folder=HERE/ident;work=WORK/ident;work.mkdir(parents=True,exist_ok=True)
    if not (folder/'narration.wav').exists(): prepare_audio(ident)
    timeline=json.loads((folder/'timeline.json').read_text())
    render(ident,STORY[ident],timeline,folder/'teaching-motion.mp4')
    detected=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-i',str(folder/'generated-scenes.mp4'),'-vf',"select='gt(scene,0.18)',showinfo",'-an','-f','null','-'],capture_output=True,text=True,check=True)
    cuts=[float(t) for t in re.findall(r'pts_time:([\d.]+)',detected.stderr)]
    edit_path=folder/'data-workbench-edit.json'
    edited=json.loads(edit_path.read_text())['cuts'] if edit_path.exists() else None
    assert len(cuts)>=(2 if edited else 3), f'{ident}: must visually review missing scene changes before composing'
    scene_cuts=edited or cuts
    display_cut=next(t for t in reversed(scene_cuts) if 9<t<13)
    render_insert(ident,15-display_cut,folder/'precision-insert.mp4')
    # Replace the AI-generated close-up containing unreliable glyphs and axes.
    ff('-i',folder/'generated-scenes.mp4','-i',folder/'precision-insert.mp4','-filter_complex',f'[0:v]trim=end={display_cut},setpts=PTS-STARTPTS[scene];[scene][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-t',15,'-an','-c:v','libx264','-crf',20,'-pix_fmt','yuv420p',work/'scenes-master.mp4')
    overlay=Image.new('RGBA',(1280,720));d=ImageDraw.Draw(overlay)
    d.rounded_rectangle((26,24,326,65),radius=9,fill=(2,12,23,185))
    font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',21)
    d.text((39,33),'情境示意 · 不按真实比例',font=font,fill='#d9edf5')
    overlay.save(work/'scene-label.png')
    duration_total=timeline['seconds']
    credit='Music: Firmament_Active by PeriTune. '+CREDIT['sourceURL']+' CC BY 4.0 '+CREDIT['licenseURL']+' Changes: excerpt, normalization, ducking, fades, voiceover mix.'
    filters=f'[0:v][1:v]concat=n=2:v=1:a=0[v0];[v0][4:v]overlay=0:0:enable=\'lt(t,15)\'[v];[2:a]atrim=duration={duration_total}[voice];[3:a]atrim=duration={duration_total},asetpts=PTS-STARTPTS,loudnorm=I=-24:TP=-3:LRA=7,aresample=48000,volume=0.398,afade=t=in:d=0.7,afade=t=out:st={duration_total-1.4}:d=1.4[bg];[voice][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891:level=0[a]'
    out=MEDIA/'video'/f'lesson-{ident.lower()}-summary'
    ff('-i',work/'scenes-master.mp4','-i',folder/'teaching-motion.mp4','-i',folder/'narration.wav','-i',MUSIC,'-loop',1,'-i',work/'scene-label.png','-filter_complex',filters,'-map','[v]','-map','[a]','-t',duration_total,'-c:v','libx264','-crf',21,'-pix_fmt','yuv420p','-r',24,'-c:a','aac','-b:a','192k','-ar',48000,'-movflags','+faststart','-metadata','comment='+credit,str(out)+'.mp4')
    ff('-ss',(scene_cuts[1]+display_cut)/2,'-i',str(out)+'.mp4','-frames:v',1,'-vf','scale=960:-2',str(out)+'-poster.jpg')
    cues=['WEBVTT','']
    def timestamp(t):
        ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
    for i,cue in enumerate(timeline['cues']):cues += [str(i+1),timestamp(cue['start'])+' --> '+timestamp(cue['end']),cue['text'],'']
    cues += ['next',timestamp(timeline['cues'][-1]['end']+.1)+' --> '+timestamp(duration_total),STORY[ident]['next'],'']
    Path(str(out)+'.vtt').write_text('\n'.join(cues))
    save(folder/'composition.json',dict(seconds=duration(str(out)+'.mp4'),ref=OLD[ident]['ref'],musicCredit=CREDIT,generated_scene_seconds=display_cut,detected_scene_cuts=cuts,edit_cuts=edited,precision_insert_seconds=15-display_cut,teaching_motion_seconds=duration_total-15,voice_source='Original approved commander voice; sentence-aligned, no speed/pitch changes'))
    print(json.dumps({'lesson':ident,'status':'COMPOSED','seconds':duration_total}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['generate','compose']);parser.add_argument('lessons',nargs='*');args=parser.parse_args()
    chosen=args.lessons or list(STORY);assert set(chosen)<=set(STORY)
    failed=[]
    if args.phase=='generate': dashscope.api_key=get_config().tts.api_key
    with _without_proxy_env(),concurrent.futures.ThreadPoolExecutor(max_workers=3 if args.phase=='generate' else 2) as pool:
        jobs={pool.submit(generate if args.phase=='generate' else compose,ident):ident for ident in chosen}
        for job in concurrent.futures.as_completed(jobs):
            try:job.result()
            except Exception as error:
                failed.append(jobs[job]);print(json.dumps({'lesson':jobs[job],'error':type(error).__name__,'message':str(error)[:180],'no_automatic_resubmission':True}),flush=True)
    raise SystemExit(bool(failed))
