"""Temporary, capability-protected Mac camera relay for Simulator development."""
import base64
import hmac
import json
import re
import secrets
import subprocess
import threading
import time
from pathlib import Path

ASSETS = Path(__file__).parent / 'mac-camera'


class CameraSessions:
    def __init__(self, clean_image, open_browser=None, clock=time.monotonic):
        self.clean_image = clean_image
        self.open_browser = open_browser or (lambda url: subprocess.Popen(['open', url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        self.clock = clock
        self.lock = threading.Lock()
        self.item = None

    def prune(self):
        if self.item and (self.clock() - self.item['heartbeat'] > 10 or self.clock() - self.item['created'] > 180):
            self.item = None

    def start(self, ident, reader, origin):
        if not re.fullmatch(r'[a-f0-9]{32}', ident) or not re.fullmatch(r'[a-f0-9]{64}', reader):
            raise ValueError('invalid capability')
        with self.lock:
            self.prune()
            if self.item:
                if self.item['id'] == ident and hmac.compare_digest(self.item['reader'], reader): return
                raise RuntimeError('busy')
            writer = secrets.token_hex(32)
            self.item = dict(id=ident, reader=reader, writer=writer, created=self.clock(), heartbeat=self.clock(),
                             frame=None, frame_at=0, status='waiting', message='请在 Mac 打开的相机页面中允许摄像头。')
        try:
            self.open_browser(f'{origin}/camera#{ident}.{writer}')
        except Exception:
            self.remove(ident, reader)
            raise

    def authorized(self, ident, token, mode):
        self.prune()
        item = self.item
        return item if item and item['id'] == ident and isinstance(token, str) and hmac.compare_digest(item[mode], token) else None

    def get(self, ident, token, mode):
        with self.lock:
            item = self.authorized(ident, token, mode)
            if not item: return None
            if mode == 'reader': item['heartbeat'] = self.clock()
            result = {'status': item['status'], 'message': item['message']}
            if mode == 'reader' and item['frame'] and self.clock() - item['frame_at'] < 3:
                result['image'] = base64.b64encode(item['frame']).decode('ascii')
            return result

    def frame(self, ident, token, data):
        with self.lock:
            item = self.authorized(ident, token, 'writer')
            if not item: return False
        image = self.clean_image(data)
        with self.lock:
            item = self.authorized(ident, token, 'writer')
            if not item: return False
            item.update(frame=image, frame_at=self.clock(), status='live', message='Mac 摄像头已连接')
        return True

    def fail(self, ident, token, reason):
        messages = {'NotAllowedError': 'Mac 浏览器未获相机权限，请在浏览器和系统设置中允许摄像头。',
                    'NotFoundError': 'Mac 没有找到可用摄像头。', 'NotReadableError': 'Mac 摄像头无法使用，可能被其他应用占用。'}
        with self.lock:
            item = self.authorized(ident, token, 'writer')
            if not item: return False
            item.update(frame=None, status='failed', message=messages.get(reason, 'Mac 相机连接中断，请重新连接。'))
        return True

    def remove(self, ident, token):
        with self.lock:
            if self.authorized(ident, token, 'reader') or self.authorized(ident, token, 'writer'):
                self.item = None
                return True
            return False

    def sweep(self):
        while True:
            time.sleep(2)
            with self.lock: self.prune()


def handle_camera(handler, sessions):
    """Return False for unrelated avatar routes; never relax their Origin policy."""
    if not (handler.path == '/camera' or handler.path.startswith('/camera/')): return False
    port = handler.server.server_port
    origin = f'http://127.0.0.1:{port}'

    def send(code, value, content_type='application/json; charset=utf-8'):
        body = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False).encode()
        handler.send_response(code)
        for k, v in {'Content-Type': content_type, 'Content-Length': str(len(body)), 'Cache-Control': 'no-store',
                     'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Connection': 'close',
                     'Permissions-Policy': 'camera=(self), microphone=()',
                     'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}.items():
            handler.send_header(k, v)
        handler.end_headers()
        try: handler.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError): pass

    def body(limit):
        length = int(handler.headers.get('Content-Length', '0'))
        if not 0 < length <= limit: raise ValueError('invalid length')
        handler.connection.settimeout(5)
        result = handler.rfile.read(length)
        if len(result) != length: raise ValueError('incomplete body')
        return result

    if handler.headers.get('Host') != f'127.0.0.1:{port}' or handler.headers.get('Origin') not in (None, origin):
        send(403, {'error': 'request denied'}); return True
    method = handler.command
    try:
        assets = {'/camera': ('index.html', 'text/html; charset=utf-8'), '/camera/app.js': ('app.js', 'text/javascript; charset=utf-8'), '/camera/style.css': ('style.css', 'text/css; charset=utf-8')}
        if method == 'GET' and handler.path in assets:
            filename, mime = assets[handler.path]; send(200, (ASSETS / filename).read_bytes(), mime); return True
        if method == 'POST' and handler.path == '/camera':
            if handler.headers.get('Origin') or handler.headers.get('X-SystemEdu-Camera') != 'simulator' or handler.headers.get('Content-Type') != 'application/json':
                send(403, {'error': 'request denied'}); return True
            value = json.loads(body(1024)); sessions.start(value['id'], value['reader'], origin)
            send(202, {'status': 'waiting'}); return True
        match = re.fullmatch(r'/camera/([a-f0-9]{32})(/status|/frame|/error)?', handler.path)
        if not match: send(404, {'error': 'not found'}); return True
        ident, suffix = match.groups(); token = handler.headers.get('X-Camera-Token', '')
        if method == 'GET' and suffix in (None, '/status'):
            result = sessions.get(ident, token, 'writer' if suffix else 'reader')
            send(200 if result else 404, result or {'error': 'expired'})
        elif method == 'DELETE' and not suffix:
            removed = sessions.remove(ident, token); send(200 if removed else 404, {'removed': removed})
        elif method == 'POST' and suffix in ('/frame', '/error'):
            if not sessions.get(ident, token, 'writer'): send(404, {'error': 'expired'}); return True
            if suffix == '/frame' and handler.headers.get('Content-Type') == 'image/jpeg':
                ok = sessions.frame(ident, token, body(500_000))
            elif suffix == '/error' and handler.headers.get('Content-Type') == 'application/json':
                ok = sessions.fail(ident, token, json.loads(body(1024)).get('reason'))
            else: send(400, {'error': 'invalid content type'}); return True
            send(200 if ok else 404, {'accepted': ok})
        else: send(405, {'error': 'method not allowed'})
    except RuntimeError: send(409, {'error': 'camera busy'})
    except Exception: send(400, {'error': 'invalid camera request'})
    return True
