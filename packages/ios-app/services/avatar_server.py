"""Loopback-only iPad simulator avatar adapter. Not a production/public server.
Run: .venv/bin/python packages/ios-app/services/avatar_server.py
Original input lives only in worker memory. Results expire after 15 minutes.
"""
import base64
import io
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

import requests
from PIL import Image, ImageOps
from camera_bridge import CameraSessions, handle_camera

PORT = 8769
MAX_BODY = 9_000_000
Image.MAX_IMAGE_PIXELS = 24_000_000
FRAMING = 'full-body-v1'
OUTPUT_SIZE = '1024*1536'
PROMPT = ('以参考照片或卡通肖像中的同一个人为主角，设计原创日式太空科幻动画队员的全身立绘。'
          '保留参考图实际可见的脸型、发型、发色和眼镜特征，不凭空添加配饰，保持原来的年龄感，不成人化。'
          '必须是从头顶到鞋底的完整全身：头发、双手、双腿、两只鞋全部在画面内；头顶和鞋底各留约8%的背景边距。'
          '单人站立，正面略微侧身，双臂自然放松，友好自然表情。海军蓝与象牙白太空科研连体制服、铜色小星徽、完整长裤与短靴。'
          '以科研制服补全参考图未展示的身体，比例自然，不夸大身体特征。清晰精致的二维赛璐璐动画线条与柔和阴影，浅蓝纯色背景。'
          '竖幅2:3构图，人物居中；禁止半身、头像特写、截断腿脚、额外人物、武器、文字和水印。')


def clean_image(data, max_side=1024):
    if not data or len(data) > 6_000_000:
        raise ValueError('invalid image')
    with Image.open(io.BytesIO(data)) as image:
        if image.width * image.height > Image.MAX_IMAGE_PIXELS or min(image.size) < 64:
            raise ValueError('invalid dimensions')
        image.load()
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((max_side, max_side))
        image.info.clear()
        out = io.BytesIO()
        image.save(out, 'JPEG', quality=88)
        return out.getvalue()


def provider_edit(photo):
    from systemedu.core.config import get_config
    key = get_config().tts.api_key
    if not key:
        raise RuntimeError('not configured')
    session = requests.Session()
    session.trust_env = False
    encoded = base64.b64encode(photo).decode('ascii')
    payload = {'model': 'wan2.6-image', 'input': {'messages': [{'role': 'user', 'content': [
        {'image': 'data:image/jpeg;base64,' + encoded}, {'text': PROMPT}]}]},
        'parameters': {'n': 1, 'enable_interleave': False, 'size': OUTPUT_SIZE, 'prompt_extend': False, 'watermark': False}}
    response = session.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
                            headers={'Authorization': 'Bearer ' + key}, json=payload, timeout=(15, 240))
    response.raise_for_status()
    content = response.json()['output']['choices'][0]['message']['content']
    url = next(x['image'] for x in content if x.get('image'))
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.aliyuncs.com') or parsed.port not in (None, 443):
        raise ValueError('untrusted result host')
    with session.get(url, stream=True, allow_redirects=False, timeout=(15, 60)) as result:
        if result.status_code != 200:
            raise ValueError('invalid image response')
        chunks, size = [], 0
        for chunk in result.iter_content(65536):
            size += len(chunk)
            if size > 6_000_000:
                raise ValueError('result too large')
            chunks.append(chunk)
    return clean_image(b''.join(chunks), 1024)


class Jobs:
    def __init__(self, generate=provider_edit):
        self.generate = generate
        self.items = {}
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=1)
        self.busy = False
        self.last_started = 0

    def prune(self):
        now = time.monotonic()
        self.items = {k: v for k, v in self.items.items() if now - v['created'] < 900}

    def start(self, key, photo):
        if not re.fullmatch(r'[a-f0-9]{32}', key):
            raise ValueError('invalid request ID')
        with self.lock:
            self.prune()
            if key in self.items:
                return 202
            if self.busy or time.monotonic() - self.last_started < 5:
                return 429
            self.busy = True
            self.last_started = time.monotonic()
            self.items[key] = {'status': 'processing', 'created': time.monotonic()}
        self.pool.submit(self.work, key, photo)
        return 202

    def work(self, key, photo):
        try:
            result = self.generate(photo)
            value = {'status': 'ready', 'image': base64.b64encode(result).decode('ascii'), 'framing': FRAMING}
        except Exception:
            value = {'status': 'failed', 'message': '形象生成未完成，请稍后重试。'}
        finally:
            photo = None
        with self.lock:
            if key in self.items:
                self.items[key].update(value)
            self.busy = False

    def get(self, key):
        with self.lock:
            self.prune()
            value = self.items.get(key)
            return {k: v for k, v in value.items() if k != 'created'} if value else None

    def remove(self, key):
        with self.lock:
            self.items.pop(key, None)


jobs = Jobs()
cameras = CameraSessions(clean_image)
threading.Thread(target=cameras.sweep, daemon=True).start()


class Handler(BaseHTTPRequestHandler):
    server_version = 'AvatarPreview'
    def log_message(self, *_):
        pass  # Never log photos, generated portraits, URLs or credentials.

    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(body)

    def allowed(self):
        return not self.headers.get('Origin') and self.headers.get('Host') in (f'127.0.0.1:{PORT}', f'localhost:{PORT}')

    def do_POST(self):
        if handle_camera(self, cameras): return
        self.connection.settimeout(15)
        if not self.allowed(): return self.reply(403, {'error': 'request denied'})
        if self.path != '/avatars' or self.headers.get('Content-Type') != 'application/json':
            return self.reply(400, {'error': 'invalid request'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_BODY: return self.reply(413, {'error': 'image too large'})
            value = json.loads(self.rfile.read(length))
            key = value['requestId']
            # Check idempotency before decoding, then Jobs.start checks again under the lock.
            if jobs.get(key): return self.reply(202, {'id': key})
            photo = clean_image(base64.b64decode(value['image'], validate=True))
            status = jobs.start(key, photo)
            self.reply(status, {'id': key} if status == 202 else {'error': 'generator busy'})
        except Exception:
            self.reply(400, {'error': 'invalid image or request'})

    def do_GET(self):
        if handle_camera(self, cameras): return
        if not self.allowed(): return self.reply(403, {'error': 'request denied'})
        if self.path == '/health': return self.reply(200, {'mode': 'simulator-preview'})
        match = re.fullmatch(r'/avatars/([a-f0-9]{32})', self.path)
        value = jobs.get(match[1]) if match else None
        self.reply(200 if value else 404, value or {'error': 'expired'})

    def do_DELETE(self):
        if handle_camera(self, cameras): return
        if not self.allowed(): return self.reply(403, {'error': 'request denied'})
        match = re.fullmatch(r'/avatars/([a-f0-9]{32})', self.path)
        if not match: return self.reply(404, {'error': 'not found'})
        jobs.remove(match[1])
        self.reply(200, {'removed': True})


if __name__ == '__main__':
    print('Avatar preview listening on loopback port 8769; production deployment is not configured.', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
