"""Generate ONE approved sample; subsequent invocations fetch the same task.

Uses the existing project credential without printing it or signed media URLs.
Only the authored reference image and narration are sent to the video provider.
"""
import argparse
import json
import logging
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from dashscope import VideoSynthesis
from systemedu.core.config import get_config
from systemedu.core.education.tts import _without_proxy_env

logging.getLogger('dashscope').setLevel(logging.CRITICAL)
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STATE = HERE / 'task.json'
MODEL = 'wan2.6-i2v'
VIDEO = ROOT / 'packages/student-web/public/mission/rover/video/lin-lan-welcome-v1.mp4'

def write_state(value):
    STATE.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['submit', 'fetch'])
    args = parser.parse_args()
    key = get_config().tts.api_key or os.environ.get('DASHSCOPE_API_KEY')
    if not key:
        raise SystemExit('Video provider credential is not configured.')
    if args.action == 'submit':
        if STATE.exists():
            raise SystemExit('Task file already exists; use fetch to avoid duplicate generation.')
        # A 10-second, single-shot sample only. No automatic retries of submission.
        response = VideoSynthesis.async_call(
            model=MODEL, api_key=key,
            img_url=(ROOT / 'packages/student-web/public/mission/rover/engineer-1920.webp').as_uri(),
            audio_url=(HERE / 'lin-lan-welcome-10s.mp3').as_uri(),
            prompt=(HERE / 'prompt.txt').read_text(),
            negative_prompt='换脸，人物变形，夸张笑容，嘴型不同步，机械动作，多余手指，融化的手，屏幕扭曲，镜头切换，字幕，文字，额外人物',
            resolution='1080P', duration=10, prompt_extend=False,
            watermark=False, seed=20261009,
        )
    else:
        state = json.loads(STATE.read_text())
        if not state.get('task_id'):
            raise SystemExit('No task was accepted; review the provider error before another submission.')
        if state.get('status') == 'SUCCEEDED' and VIDEO.exists():
            print(json.dumps({'status':'SUCCEEDED','local_video':str(VIDEO)}))
            return
        response = VideoSynthesis.fetch(task=state['task_id'], api_key=key)
    output = response.output or {}
    state = {
        'model': MODEL, 'requested_resolution': '1080P', 'requested_duration_seconds':10,
        'http_status':response.status_code, 'task_id':output.get('task_id'),
        'status':output.get('task_status'), 'code':response.code or output.get('code'),
    }
    if args.action == 'fetch' and not state['task_id']:
        state['task_id'] = json.loads(STATE.read_text()).get('task_id')
    write_state(state)
    print(json.dumps(state), flush=True)
    if response.status_code != 200:
        raise SystemExit('Provider request failed; no resubmission has been made.')
    if state['status'] == 'SUCCEEDED':
        url = output.get('video_url')
        parsed = urlparse(url or '')
        if parsed.scheme != 'https' or not parsed.hostname:
            raise SystemExit('Provider returned no secure output URL.')
        # Download the generated deliverable, without forwarding provider credentials.
        with requests.get(url, stream=True, timeout=(15, 120)) as result:
            result.raise_for_status()
            temp = VIDEO.with_suffix('.download')
            with temp.open('wb') as f:
                for chunk in result.iter_content(1024*1024):
                    f.write(chunk)
            temp.replace(VIDEO)
        state['local_video'] = str(VIDEO.relative_to(ROOT))
        state['bytes'] = VIDEO.stat().st_size
        write_state(state)
        print(json.dumps({'saved':state['local_video'],'bytes':state['bytes']}))

if __name__ == '__main__':
    try:
        with _without_proxy_env():
            main()
    except Exception as exc:
        # Avoid logging credential-bearing request headers or signed URLs.
        print(f'Video operation failed: {type(exc).__name__}', file=sys.stderr)
        sys.exit(1)
