"""Revise Lin Lan's voice without changing the stage dialogue or global TTS settings."""
import argparse
import base64
import importlib.util
import json
import os
import shutil
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('completion_film', HERE.parent / 'completion-film/generate.py')
film = importlib.util.module_from_spec(spec)
spec.loader.exec_module(film)
film.HERE = HERE
film.WORK = Path('/tmp/systemedu-completion-commander-voice-20261127')
film.WORK.mkdir(exist_ok=True)

VOICE_PROMPT = '35岁中国女性科研指挥官，中低音区，胸腔共鸣饱满，音色结实，气息稳定，吐字清楚有力度。镇定自信，带队指挥的权威感，中速，分句短停顿，句尾干脆下落。肯定队员时克制而坚定，不轻声细语、不甜美、不撒娇，不气声、不拖尾、不喊叫。标准普通话，干净人声，无音乐和混响。'
MODEL = 'qwen-audio-3.1-tts-plus'
MUSIC_URL = 'https://peritune.com/music/PerituneMaterial_Firmament_Active.mp3'
MUSIC_PAGE = 'https://peritune.com/blog/2017/07/30/firmament/'


def music():
    target = HERE / 'Firmament_Active.mp3'
    if not target.exists():
        response = requests.get(MUSIC_URL, timeout=(15, 90))
        response.raise_for_status()
        target.write_bytes(response.content)
    (HERE / 'MUSIC-LICENSE.txt').write_text(
        'Firmament_Active by PeriTune (Sei Mutsuki)\n'
        f'Source: {MUSIC_PAGE}\nAudio: {MUSIC_URL}\n'
        'License: Creative Commons Attribution 4.0 International\n'
        'https://creativecommons.org/licenses/by/4.0/\n'
        'Track published 2017-07-30. The track page and the current PeriTune terms\n'
        'retain CC BY 4.0 for tracks published before March 2026. Checked 2026-11-27.\n'
        'https://peritune.com/about/\n'
        'Changes in SystemEdu video: excerpt, loudness normalization, voice-dependent\n'
        'volume reduction, fade-in/fade-out, and mixing under an original voiceover.\n'
        'The unmodified MP3 here is retained as the credited source asset.\n')
    print(json.dumps({'music_ready': True, 'seconds': film.duration(target)}), flush=True)


def compose():
    from PIL import Image, ImageDraw, ImageFont
    film.compose(voice_track=film.WORK / 'input.mp3')
    audio = json.loads((HERE / 'audio.json').read_text())
    talk_end = min(film.SECONDS, audio['speech_end'] + .8)
    credit = Image.new('RGBA', (1280, 720))
    draw = ImageDraw.Draw(credit)
    font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18)
    draw.rounded_rectangle((25, 25, 735, 67), radius=8, fill=(0, 0, 0, 175))
    draw.text((39, 36), 'Music: Firmament_Active · PeriTune · CC BY 4.0', font=font, fill='white')
    credit_path = film.WORK / 'music-credit.png'; credit.save(credit_path)
    metadata = f'Music: Firmament_Active by PeriTune. {MUSIC_PAGE} CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ Changes: excerpt, fades, ducking, voiceover mix.'
    for output in [film.MEDIA / 'video' / (film.FILM_ID + '.mp4'), HERE / 'linlan-completion-preview.mp4']:
        source = film.WORK / ('unmixed-' + output.name)
        shutil.copy2(output, source)
        length = film.duration(source)
        # Keep narration in front; the score rises smoothly only after the last sentence.
        # Normalized music is -32 LUFS under speech, rising towards -24 LUFS for the closing scene.
        release = audio['speech_end']
        filters = (
            f"[1:a]atrim=duration={length},asetpts=PTS-STARTPTS,loudnorm=I=-24:TP=-3:LRA=7,aresample=48000,"
            f"volume='if(lt(t,{release}),0.398,0.398+0.602*min((t-{release})/0.8,1))':eval=frame,"
            f"afade=t=in:d=0.6,afade=t=out:st={length-1.1}:d=1.1[bg];"
            '[0:a][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891:level=0[a];'
            f"[0:v][2:v]overlay=0:0:enable='gte(t,{talk_end})'[v]"
        )
        film.ff('-i', source, '-i', HERE / 'Firmament_Active.mp3', '-loop', '1', '-i', credit_path,
                '-filter_complex', filters, '-map', '[v]', '-map', '[a]', '-t', length,
                '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                '-ar', '48000', '-metadata', 'comment=' + metadata, '-movflags', '+faststart', output)
    film.save(HERE / 'mix.json', {'track': 'Firmament_Active', 'artist': 'PeriTune', 'source': MUSIC_PAGE,
        'license': 'https://creativecommons.org/licenses/by/4.0/', 'excerpt_start': 0,
        'music_lufs_under_voice': -32, 'music_lufs_closing': -24,
        'rise_start': release, 'rise_duration': .8, 'fade_in': .6, 'fade_out': 1.1,
        'voice_source': 'Original designed voice, not the video provider audio',
        'duration_seconds': length})
    print(json.dumps({'mixed': True, 'seconds': length}), flush=True)


def voice():
    voice_file = HERE / 'voice-design.json'
    raw = HERE / 'commander-voice.wav'
    if not raw.exists():
        if voice_file.exists():
            raise ValueError('Existing voice attempt: inspect it before submitting again')
        request = {
            'model': 'voice-enrollment',
            'input': {'action': 'create_voice', 'target_model': MODEL, 'prefix': 'linlan',
                      'voice_prompt': VOICE_PROMPT, 'preview_text': film.DIALOGUE, 'language_hints': ['zh']},
            'parameters': {'sample_rate': 24000, 'response_format': 'wav'},
        }
        film.save(voice_file, {'status': 'SUBMITTING', 'request': request})
        key = film.get_config().tts.api_key or os.environ.get('DASHSCOPE_API_KEY')
        response = requests.post('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization',
                                 headers={'Authorization': f'Bearer {key}'}, json=request, timeout=(15, 120))
        data = response.json()
        output = data.get('output', {})
        meta = {'http_status': response.status_code, 'code': data.get('code'),
                'request_id': data.get('request_id'), 'voice_id': output.get('voice_id'), 'request': request}
        film.save(voice_file, meta)
        print(json.dumps({k: v for k, v in meta.items() if k != 'request'}), flush=True)
        response.raise_for_status()
        payload = output.get('preview_audio', {}).get('data')
        if not payload:
            raise ValueError('Voice service returned no preview audio')
        raw.write_bytes(film.tts._normalize_wav_header(base64.b64decode(payload)))
    # Loudness-normalize the freshly generated voice; do not pitch-shift or rush it.
    target = HERE / 'dialogue.mp3'
    film.ff('-i', raw, '-af', 'loudnorm=I=-18:TP=-2:LRA=7', '-ar', '48000', '-c:a', 'libmp3lame', '-b:a', '160k', target)
    length = film.duration(target)
    if length > 13.8:
        raise ValueError('Voice is too long for the film; review before changing delivery speed')
    film.ff('-i', target, '-af', f'adelay=400:all=1,apad,atrim=duration={film.SECONDS}', '-c:a', 'libmp3lame', '-b:a', '160k', film.WORK / 'input.mp3')
    meta = json.loads(voice_file.read_text())
    film.save(HERE / 'audio.json', {'dialogue': film.DIALOGUE, 'original_seconds': length, 'speed': 1,
        'speech_start': .4, 'speech_end': .4 + length, 'voice': meta['voice_id'], 'model': MODEL,
        'voice_prompt': VOICE_PROMPT, 'normalization': 'loudnorm I=-18 TP=-2 LRA=7; no pitch or speed change'})
    prompt = f'原创日式太空科幻动画，延续首帧中国女性科研指挥官林岚的同一面容、短深蓝黑发、海军蓝和象牙白制服、铜色星徽。保持精致二维动画画风。她直视镜头，姿态挺拔，像训练有素的科研指挥官向队员总结任务。沉着、自信、有权威感，表情坚定，以克制的点头肯定队员，不甜笑不歪头。严格跟随提供的中文配音和停顿，嘴型清晰同步：{film.DIALOGUE} 讲话时一次简短有力的开放手势，结束合嘴点头。固定中景，不换脸，不切镜，不写实。背景保持同一科研指挥室与舷窗地球。没有字幕、文字、水印、额外人物或武器。'
    (HERE / 'prompt.txt').write_text(prompt + '\n')
    print(json.dumps({'voice_ready': True, 'seconds': length}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['voice', 'music', 'submit', 'fetch', 'compose'])
    action = parser.parse_args().action
    with film.tts._without_proxy_env():
        try:
            if action == 'voice': voice()
            elif action == 'music': music()
            elif action == 'compose': compose()
            else: film.video(action)
        except Exception as error:
            print(json.dumps({'error_type': type(error).__name__, 'no_automatic_resubmission': True}))
            raise SystemExit(1)
