"""Read-only production library checks using the existing service credential.

Run on the server. Never print credentials or act as a student account.
"""
import hashlib
import json
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

pid = subprocess.check_output(['systemctl', 'show', 'systemedu-student-backend', '-p', 'MainPID', '--value'], text=True).strip()
env = dict(part.split(b'=', 1) for part in Path(f'/proc/{pid}/environ').read_bytes().split(b'\0') if b'=' in part)
base = env.get(b'LIBRARY_BASE_URL', env.get(b'LIBRARY_URL', b'http://127.0.0.1:18821')).decode().rstrip('/')
assert urllib.parse.urlparse(base).hostname in ('127.0.0.1', 'localhost'), 'Only loopback library reads are allowed'
token = env[b'LIBRARY_LICENSE_TOKEN'].decode()
root = Path('/root/.systemedu-library/media/projects/lightkurve-transit-detective')
manifest = json.loads((root / 'manifest.json').read_text())
paths = ['manifest.json', 'tree/knowledge_tree.json', 'downloads/lightkurve-practice-kit.zip', 'practice/browser/holdout.json']
for entry in manifest['knodes']:
    paths.extend(f"{entry['knode_dir']}/{file}" for file in ['sections.json', 'slides.json', 'theories.json', 'lesson.md', 'assignment.md', 'learning-record.json'])
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
checks = []
for relative in paths:
    url = f'{base}/v1/projects/lightkurve-transit-detective/files/{urllib.parse.quote(relative)}'
    request = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with opener.open(request, timeout=30) as response:
        assert response.status == 200
        digest = hashlib.sha256(response.read()).hexdigest()
    assert digest == hashlib.sha256((root / relative).read_bytes()).hexdigest(), relative
    checks.append({'path': relative, 'sha256': digest})
print(json.dumps({'passed': True, 'nodes': len(manifest['knodes']), 'files': len(checks), 'checks': checks,
                  'boundary': 'Real service-to-service read-only library API; no student impersonation or persistence writes.'}))
