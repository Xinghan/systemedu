"""One chapter-completion sample. Persist provider task ID; never silently resubmit."""
import argparse, json, logging, os, re, subprocess
from pathlib import Path
from urllib.parse import urlparse
import requests
from dashscope import VideoSynthesis
from systemedu.core.config import get_config
from systemedu.core.education import tts

logging.disable(logging.CRITICAL)
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PUBLIC = ROOT / 'packages/student-web/public'
MEDIA = PUBLIC / 'mission/space/expedition-v2'
WORK = Path('/tmp/systemedu-completion-film-20261127')
WORK.mkdir(exist_ok=True)
FILM_ID = 'research-P1-complete'
DIALOGUE = '队员，你的星光调查卡已经归档。让观察可以复查，是很好的开始。保持这份认真，下一站，我们一起检查数据的可靠性。'
SECONDS = 15

def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def ff(*args):
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error', *map(str, args)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)]))

def voice():
    target = HERE / 'dialogue.mp3'
    tts.SYSTEMEDU_HOME = WORK / 'tts'
    if not target.exists():
        relative, _ = tts.synthesize_speech(DIALOGUE, 'completion-sample', 0, 'voice.wav')
        ff('-i', tts.SYSTEMEDU_HOME / 'media' / relative, '-c:a', 'libmp3lame', '-b:a', '128k', target)
    length = duration(target)
    speed = max(1, length / 13.8)
    if speed > 1.15:
        raise ValueError('Shorten the script instead of rushing the speech')
    ff('-i', target, '-af', f'atempo={speed},adelay=400:all=1,apad,atrim=duration={SECONDS}', '-c:a', 'libmp3lame', '-b:a', '128k', WORK / 'input.mp3')
    save(HERE / 'audio.json', {'dialogue': DIALOGUE, 'original_seconds': length, 'speed': speed, 'speech_start': .4, 'speech_end': .4 + length / speed, 'voice': 'Cherry', 'model': 'qwen3-tts-flash'})
    prompt = f'原创日式太空科幻动画，延续首帧中国女性科研指挥官林岚的同一面容、短深蓝黑发、海军蓝和象牙白制服、铜色星徽，保持精致二维动画画风。她看向镜头，像对刚完成第一次研究任务的初中生说话，温暖、真诚、欣慰而不夸张。严格跟随提供的中文配音：{DIALOGUE} 前0.4秒自然微笑眨眼，讲话时嘴型清晰同步，有轻微点头和一次自然开放的鼓励手势，结束时合嘴微笑。固定中景，不换脸，不切镜，不写实。背景保持科研指挥室与舷窗地球，背景细节轻微活动。没有字幕、文字、水印、额外人物或武器。'
    (HERE / 'prompt.txt').write_text(prompt + '\n')
    print(json.dumps({'audio_ready': True, 'seconds': length, 'speed': speed}), flush=True)

def video(action):
    task_file = HERE / 'task.json'
    previous = json.loads(task_file.read_text()) if task_file.exists() else {}
    key = get_config().tts.api_key or os.environ.get('DASHSCOPE_API_KEY')
    if not key:
        raise ValueError('Provider not configured')
    if action == 'submit':
        if previous:
            print(json.dumps({'existing_task': True, 'status': previous.get('status')})); return
        with task_file.open('x') as stream:
            json.dump({'status': 'SUBMITTING'}, stream)
        response = VideoSynthesis.async_call(model='wan2.6-i2v', api_key=key, img_url=(MEDIA / 'art/commander.png').as_uri(), audio_url=(WORK / 'input.mp3').as_uri(), prompt=(HERE / 'prompt.txt').read_text(), negative_prompt='真人摄影，写实皮肤，换脸，人物变形，多余手指，嘴型不同步，额外人物，字幕，文字，水印，切镜', resolution='1080P', duration=SECONDS, prompt_extend=False, watermark=False, seed=202611271)
    else:
        if not previous.get('task_id'):
            raise ValueError('No accepted task ID; inspect before resubmitting')
        if previous.get('status') == 'SUCCEEDED' and (WORK / 'source.mp4').exists():
            print(json.dumps(previous)); return
        response = VideoSynthesis.fetch(task=previous['task_id'], api_key=key)
    output = response.output or {}
    state = {'film_id': FILM_ID, 'model': 'wan2.6-i2v', 'http_status': response.status_code, 'task_id': output.get('task_id') or previous.get('task_id'), 'status': output.get('task_status'), 'code': response.code or output.get('code')}
    save(task_file, state); print(json.dumps(state), flush=True)
    if response.status_code != 200:
        raise ValueError('Provider request failed')
    if state['status'] == 'SUCCEEDED':
        url = output.get('video_url')
        if urlparse(url or '').scheme != 'https':
            raise ValueError('Invalid media URL')
        with requests.get(url, stream=True, timeout=(15, 120)) as result:
            result.raise_for_status()
            with (WORK / 'source.download').open('wb') as stream:
                for chunk in result.iter_content(1024 * 1024): stream.write(chunk)
        (WORK / 'source.download').replace(WORK / 'source.mp4')

def compose(voice_track=None):
    from PIL import Image, ImageDraw, ImageFont
    story = json.loads((ROOT / 'packages/ios-app/content/space-expedition.json').read_text())
    chapter = next(c for c in story['chapters'] if c['id'] == 'research-P1')
    output = MEDIA / 'video'
    audio = json.loads((HERE / 'audio.json').read_text())
    talk_end = min(SECONDS, audio['speech_end'] + .8)
    inputs = ['-i', WORK / 'source.mp4']
    if voice_track:
        inputs += ['-i', voice_track, '-map', '0:v:0', '-map', '1:a:0']
    ff(*inputs, '-t', talk_end, '-vf', 'scale=1280:720,fps=24', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', WORK / 'character.mp4')
    ff('-loop', '1', '-i', PUBLIC / chapter['image'].lstrip('/'), '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '3', '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=24', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', WORK / 'evidence-scene.mp4')
    ff('-i', WORK / 'character.mp4', '-i', WORK / 'evidence-scene.mp4', '-filter_complex', '[0:v:0][0:a:0][1:v:0][1:a:0]concat=n=2:v=1:a=1[v][a]', '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '22', '-c:a', 'aac', '-ar', '48000', '-movflags', '+faststart', output / (FILM_ID + '.mp4'))
    parts = [s for s in re.split('(?<=[。])', DIALOGUE) if s]
    time = .4; captions = ['WEBVTT', '']; cues = []
    for i, part in enumerate(parts):
        end = time + (audio['speech_end'] - .4) * len(part) / len(DIALOGUE)
        captions += [str(i + 1), f'00:00:{time:06.3f} --> 00:00:{end:06.3f}', part, '']; time = end
        cues.append((end - (audio['speech_end'] - .4) * len(part) / len(DIALOGUE), end, part))
    closing = '成果：星光调查卡 · 下一站：检查观测数据'
    captions += ['scene', f'00:00:{talk_end:06.3f} --> 00:00:{talk_end + 3:06.3f}', closing, '']
    cues.append((talk_end, talk_end + 3, closing))
    vtt = output / (FILM_ID + '.vtt'); vtt.write_text('\n'.join(captions))
    ff('-ss', '3', '-i', WORK / 'source.mp4', '-frames:v', '1', '-vf', 'scale=960:-2', output / (FILM_ID + '-poster.jpg'))
    # A captioned review copy; the app uses switchable native subtitles.
    # This host's FFmpeg has no libass; render exact subtitle text, then overlay it on the video.
    font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 30)
    inputs = []; filters = []; previous = '0:v'
    for index, (start, end, text) in enumerate(cues):
        image = Image.new('RGBA', (1280, 720)); draw = ImageDraw.Draw(image)
        width = draw.textlength(text, font=font); x = (1280 - width) / 2
        draw.rounded_rectangle((x - 20, 628, x + width + 20, 686), radius=10, fill=(0, 0, 0, 200))
        draw.text((x, 639), text, font=font, fill='white')
        png = WORK / f'caption-{index}.png'; image.save(png)
        inputs += ['-loop', '1', '-i', png]
        filters.append(f'[{previous}][{index + 1}:v]overlay=0:0:enable=\'between(t,{start:.3f},{end:.3f})\'[v{index}]')
        previous = f'v{index}'
    ff('-i', output / (FILM_ID + '.mp4'), *inputs, '-filter_complex', ';'.join(filters), '-map', f'[{previous}]', '-map', '0:a', '-t', duration(output / (FILM_ID + '.mp4')), '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', HERE / 'linlan-completion-preview.mp4')
    print(json.dumps({'composed': True, 'seconds': duration(output / (FILM_ID + '.mp4'))}), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('action', choices=['voice', 'submit', 'fetch', 'compose']); args = parser.parse_args()
    with tts._without_proxy_env():
        try:
            if args.action == 'voice': voice()
            elif args.action == 'compose': compose()
            else: video(args.action)
        except Exception as error:
            print(json.dumps({'error_type': type(error).__name__, 'no_automatic_resubmission': True})); raise SystemExit(1)
