"""Verified HTTPS transport for this offline media-generation job only.

Keeps keys, signed URLs and upload policies out of process arguments and logs.
No automatic retries (a video POST is billable); never disables TLS validation.
"""
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse
import json, subprocess
import requests

def quote(value):
    return '"'+str(value).replace('\\','\\\\').replace('"','\\"').replace('\n','\\n').replace('\r','\\r')+'"'

def send(self, request, **kwargs):
    parsed = urlparse(request.url)
    host = parsed.hostname or ''
    if parsed.scheme != 'https' or not (host == 'dashscope.aliyuncs.com' or host.endswith('.aliyuncs.com')):
        raise ValueError('Unexpected media-service destination')
    if kwargs.get('verify') is False:
        raise ValueError('TLS verification is required')
    with TemporaryDirectory(prefix='mission-video-http-') as tmp:
        base = Path(tmp)
        config = ['url = '+quote(request.url), 'request = '+quote(request.method),
                  'silent', 'show-error', 'compressed', 'noproxy = "*"', 'proto = "=https"',
                  'connect-timeout = 20', 'max-time = 180',
                  'output = '+quote(base/'response'), 'dump-header = '+quote(base/'headers'),
                  'write-out = "%{http_code}"']
        for key, value in request.headers.items():
            if key.lower() == 'accept-encoding': continue
            config.append('header = '+quote(f'{key}: {value}'))
        if request.body is not None:
            body = request.body
            if isinstance(body, str): body = body.encode()
            if not isinstance(body, bytes): raise ValueError('Expected prepared request body')
            (base/'body').write_bytes(body)
            config.append('data-binary = '+quote('@'+str(base/'body')))
        result = subprocess.run(['curl','--config','-'], input=('\n'.join(config)+'\n').encode(), capture_output=True)
        if result.returncode:
            # curl stderr may contain signed URLs; expose only the numeric exit.
            raise ConnectionError(f'Verified media transport failed (curl {result.returncode})')
        response = requests.Response()
        response.status_code = int(result.stdout.decode())
        response.url = request.url
        response.request = request
        response._content = (base/'response').read_bytes()
        response._content_consumed = True
        for block in (base/'headers').read_text().strip().split('\n\n'):
            if block.startswith('HTTP/'):
                response.headers.clear()
                for line in block.splitlines()[1:]:
                    if ':' in line:
                        key,value=line.split(':',1);response.headers[key.strip()]=value.strip()
        response.encoding = 'utf-8'
        return response

@contextmanager
def verified_curl():
    original = requests.Session.send
    requests.Session.send = send
    try: yield
    finally: requests.Session.send = original
