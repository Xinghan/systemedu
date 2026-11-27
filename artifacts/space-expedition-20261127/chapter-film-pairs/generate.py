"""Produce the 13 missing chapter closings; preserve accepted task IDs and the approved voice.

References: https://help.aliyun.com/en/model-studio/voice-cloning-user-guide
No user photos or learning records are sent: only authored scripts and the bundled fictional commander.
"""
import argparse
import concurrent.futures
import json
import logging
import re
import shutil
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
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PUBLIC = ROOT / 'packages/student-web/public'
MEDIA = PUBLIC / 'mission/space/expedition-v2'
WORK = Path('/tmp/systemedu-chapter-film-pairs')
VOICE = 'qwen-audio-3.1-tts-plus-vd-linlan-7a2e1e41aaad45129bea81dfa67553a1'
MODEL = 'qwen-audio-3.1-tts-plus'
MUSIC = HERE.parent / 'completion-film-commander-voice/Firmament_Active.mp3'
STORY = json.loads((ROOT / 'packages/ios-app/content/space-expedition.json').read_text())
DIALOGUE = json.loads((HERE / 'dialogue.json').read_text())
CREDIT = {'title': 'Firmament_Active', 'artist': 'PeriTune', 'sourceURL': 'https://peritune.com/blog/2017/07/30/firmament/', 'licenseURL': 'https://creativecommons.org/licenses/by/4.0/', 'changes': '节选、响度调整、人声下自动降低配乐、淡入淡出。'}

def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def ff(*args):
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error', '-threads', '2', '-filter_complex_threads', '1', *map(str, args)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)]))

def produce(ident, submit_only=False):
    target = HERE / ident; target.mkdir(exist_ok=True)
    work = WORK / ident; work.mkdir(parents=True, exist_ok=True)
    text = DIALOGUE[ident]
    voice = work / 'voice.mp3'
    raw = target / 'voice-original.mp3'
    if not raw.exists():
        # Reuse the successful synthesis probe rather than paying twice.
        probe = Path('/tmp/systemedu-first-contact-voice.mp3')
        if ident == 'first-contact' and probe.exists(): shutil.copy2(probe, raw)
        else:
            audio = SpeechSynthesizer(model=MODEL, voice=VOICE, format=AudioFormat.MP3_48000HZ_MONO_256KBPS).call(text, timeout_millis=90000)
            if not audio: raise ValueError('No synthesis audio')
            raw.write_bytes(audio)
    ff('-i', raw, '-af', 'loudnorm=I=-18:TP=-2:LRA=7', '-ar', '48000', '-c:a', 'libmp3lame', '-b:a', '160k', voice)
    length = duration(voice)
    if length > 14.2: raise ValueError(f'{ident}: shorten dialogue ({length:.2f}s); never rush the voice')
    speech_end = .4 + length
    save(target / 'audio.json', {'voice': VOICE, 'model': MODEL, 'dialogue': text, 'speech_start': .4, 'speech_end': speech_end, 'speed': 1, 'pitch': 1})
    ff('-i', voice, '-af', 'adelay=400:all=1,apad,atrim=duration=15', '-c:a', 'libmp3lame', '-b:a', '160k', work / 'input.mp3')
    prompt = f'原创日式太空科幻动画。同一位中国女性科研指挥官林岚，沿用首帧面容、短深蓝黑发、海军蓝和象牙白制服、铜色星徽，精致二维动画画风。她直视镜头，姿态挺拔，沉着坚定、有指挥官的权威感，向初中生队员总结刚完成的任务。严格跟随提供的中文声音和停顿，嘴型清晰同步：{text} 一次简短有力的开放手势，结束合嘴点头。固定中景，不换脸，不切镜，不甜笑、不歪头、不写实。背景保持同一科研指挥室与舷窗地球。没有字幕、文字、水印、额外人物或武器。'
    (target / 'prompt.txt').write_text(prompt + '\n')
    task_file = target / 'task.json'
    state = json.loads(task_file.read_text()) if task_file.exists() else {}
    if not state:
        save(task_file, {'status': 'SUBMITTING'})
        response = VideoSynthesis.async_call(model='wan2.6-i2v', api_key=dashscope.api_key, img_url=(MEDIA / 'art/commander.png').as_uri(), audio_url=(work / 'input.mp3').as_uri(), prompt=prompt, negative_prompt='真人摄影，换脸，变形，多余手指，嘴型不同步，额外人物，字幕，文字，水印，切镜', resolution='1080P', duration=15, prompt_extend=False, watermark=False, seed=202611272)
        output = response.output or {}
        state = {'status': output.get('task_status'), 'task_id': output.get('task_id'), 'http_status': response.status_code, 'code': response.code or output.get('code')}
        save(task_file, state)
        if response.status_code != 200: raise ValueError(f'{ident}: video submission rejected ({state["code"]})')
    if not state.get('task_id'): raise ValueError(f'{ident}: inspect existing submission before retrying')
    if submit_only:
        print(json.dumps({'chapter': ident, 'status': state['status'], 'submitted_only': True}), flush=True)
        return
    source = work / 'source.mp4'
    while not source.exists():
        response = VideoSynthesis.fetch(task=state['task_id'], api_key=dashscope.api_key)
        output = response.output or {}
        state.update(status=output.get('task_status'), http_status=response.status_code, code=response.code or output.get('code'))
        save(task_file, state)
        print(json.dumps({'chapter': ident, 'status': state['status']}, ensure_ascii=False), flush=True)
        if response.status_code != 200 or state['status'] in ['FAILED', 'CANCELED', 'UNKNOWN']:
            raise ValueError(f'{ident}: video generation failed ({state["code"]})')
        if state['status'] == 'SUCCEEDED':
            url = output.get('video_url', '')
            if urlparse(url).scheme != 'https': raise ValueError('Invalid video URL')
            with requests.get(url, stream=True, timeout=(15, 120)) as result:
                result.raise_for_status()
                with (work / 'source.download').open('wb') as stream:
                    for chunk in result.iter_content(1024 * 1024): stream.write(chunk)
            (work / 'source.download').replace(source)
        else: time.sleep(30)
    compose(ident, work, speech_end)
    print(json.dumps({'chapter': ident, 'status': 'COMPOSED'}, ensure_ascii=False), flush=True)

def compose(ident, work, speech_end):
    chapter_index = next(i for i,c in enumerate(STORY['chapters']) if c['id'] == ident)
    chapter = STORY['chapters'][chapter_index]
    next_title = STORY['chapters'][chapter_index + 1]['title'] if chapter_index + 1 < len(STORY['chapters']) else '远航完成 · 回看你的成果'
    talk_end = min(15, speech_end + .6)
    total = talk_end + 3
    # The last scene explains the submitted work and next step; the speaking character is actual i2v footage.
    scene = Image.open(PUBLIC / chapter['image'].lstrip('/')).convert('RGB')
    from PIL import ImageOps
    scene = ImageOps.fit(scene, (1280, 720)).convert('RGBA')
    overlay = Image.new('RGBA', scene.size); draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 475, 1280, 720), fill=(3, 14, 24, 215))
    font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 38)
    small = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 27)
    draw.text((45, 514), '本章归档 · ' + chapter['delivery']['title'], font=font, fill='#ffd07b')
    draw.text((45, 578), ('下一站 · ' if chapter_index < 13 else '') + next_title, font=small, fill='white')
    draw.text((45, 664), 'Music: Firmament_Active · PeriTune · CC BY 4.0', font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18), fill='#c9d4df')
    Image.alpha_composite(scene, overlay).convert('RGB').save(work / 'closing.jpg')
    ff('-i', work / 'source.mp4', '-i', work / 'input.mp3', '-map', '0:v:0', '-map', '1:a:0', '-t', talk_end, '-vf', 'scale=1280:720,fps=24', '-c:v', 'libx264', '-threads', '2', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', work / 'talk.mp4')
    ff('-loop', '1', '-i', work / 'closing.jpg', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '3', '-vf', 'fps=24', '-c:v', 'libx264', '-threads', '2', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', work / 'ending.mp4')
    filters = f'[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][voice];[2:a]atrim=duration={total},asetpts=PTS-STARTPTS,loudnorm=I=-24:TP=-3:LRA=7,aresample=48000,volume=\'if(lt(t,{speech_end}),0.398,0.398+0.602*min((t-{speech_end})/0.8,1))\':eval=frame,afade=t=in:d=0.6,afade=t=out:st={total-1.1}:d=1.1[bg];[voice][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891:level=0[a]'
    out = MEDIA / 'video' / (ident + '-complete')
    metadata = 'Music: Firmament_Active by PeriTune. ' + CREDIT['sourceURL'] + ' CC BY 4.0 ' + CREDIT['licenseURL'] + ' Changes: excerpt, normalization, ducking, fades, voiceover mix.'
    ff('-i', work / 'talk.mp4', '-i', work / 'ending.mp4', '-i', MUSIC, '-filter_complex', filters, '-map', '[v]', '-map', '[a]', '-t', total, '-c:v', 'libx264', '-threads', '2', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-metadata', 'comment=' + metadata, str(out) + '.mp4')
    ff('-ss', '3', '-i', work / 'source.mp4', '-frames:v', '1', '-vf', 'scale=960:-2', str(out) + '-poster.jpg')
    cues = ['WEBVTT', '']; start = .4
    for i, part in enumerate(filter(None, re.split('(?<=[。])', DIALOGUE[ident]))):
        end = start + (speech_end - .4) * len(part) / len(DIALOGUE[ident])
        cues += [str(i + 1), f'00:00:{start:06.3f} --> 00:00:{end:06.3f}', part, '']; start = end
    cues += ['scene', f'00:00:{talk_end:06.3f} --> 00:00:{total:06.3f}', '成果：' + chapter['delivery']['title'] + ' · ' + next_title, '']
    Path(str(out) + '.vtt').write_text('\n'.join(cues))
    save(HERE / ident / 'composition.json', {'seconds': duration(str(out) + '.mp4'), 'talk_end': talk_end, 'musicCredit': CREDIT, 'voice_source': 'original TTS track; provider audio replaced', 'next_chapter': next_title})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('chapters', nargs='*'); parser.add_argument('--submit-only', action='store_true'); args = parser.parse_args()
    dashscope.api_key = get_config().tts.api_key
    with _without_proxy_env(), concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        tasks = {pool.submit(produce, ident, args.submit_only): ident for ident in args.chapters or DIALOGUE.keys()}
        failed = []
        for task in concurrent.futures.as_completed(tasks):
            try: task.result()
            except Exception as error:
                ident = tasks[task]; failed.append(ident)
                print(json.dumps({'chapter': ident, 'error': type(error).__name__, 'message': str(error)[:200], 'no_automatic_resubmission': True}), flush=True)
        raise SystemExit(bool(failed))
