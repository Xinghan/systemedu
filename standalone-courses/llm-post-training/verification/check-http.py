"""HTTP smoke test against the existing local course server (no browser mutations)."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import io
import json
import re
import urllib.request
import urllib.parse
import urllib.error
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:4000'
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.algorithms = []
        self.video_links = []
        self.spatial = []
        self.representations = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'data-algorithm' in attrs:
            self.algorithms.append(attrs['data-algorithm'])
        if attrs.get('data-visualization') == 'spatial-explainer':
            self.spatial.append(attrs['data-algorithm'])
        if 'data-representation' in attrs:
            self.representations.append(attrs['data-representation'])
        if tag == 'a' and attrs.get('href', '').startswith('https://www.youtube.com/watch?v='):
            self.video_links.append(attrs['href'])

result = {'pages': {}, 'downloads': {}}
for i in range(1, 6):
    module = f'M0{i}'
    with opener.open(f'{ORIGIN}/standalone/post-training/{module}', timeout=30) as response:
        page = Page()
        page.feed(response.read().decode())
        expected = re.findall(r'\[\[LAB:([a-z0-9]+)\]\]', (ROOT/'nodes'/f'{module}.md').read_text())
        assert page.algorithms == expected, (module, page.algorithms, expected)
        assert page.spatial == expected
        assert page.video_links
        assert len(page.representations) == len(expected)
        result['pages'][module] = {'status': response.status, 'algorithms': page.algorithms, 'youtube_index': True, 'representations': page.representations}
assert len({r for page in result['pages'].values() for r in page['representations']}) == 15
with opener.open(f'{ORIGIN}/standalone/post-training/ticketlab-course.zip', timeout=30) as response:
    data = response.read()
    expected = (ROOT.parents[1]/'packages/student-web/public/standalone/post-training/ticketlab-course.zip').read_bytes()
    assert data == expected
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert archive.testzip() is None
        assert 'ticketlab-course/project/numerical_walkthrough.py' in archive.namelist()
        assert '[[LAB' not in archive.read('ticketlab-course/nodes/M04.md').decode()
    result['downloads']['zip'] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'crc': 'passed'}
record = {'schema': 2, 'course': 'llm-post-training-professional', 'version': '2026-10-15.2',
          'nodes': {f'M0{i}': {'notes': 'HTTP export fixture', 'checks': [False]*4, 'slide': 0} for i in range(1, 6)},
          'lab': {'rank': 8, 'angle': -25, 'quantized': True, 'maskPrompt': True, 'keepEos': True, 'signal': 0},
          'experiments': {'nf4': {'step': 2, 'values': {'outlier': 6, 'uniform': 0, 'index': 4}, 'view': {'time': 2.37, 'focus': 'weight:4', 'mode': 'graph'}}}}
for form in ['json', 'markdown']:
    payload = urllib.parse.urlencode({'record': json.dumps(record), 'format': form}).encode()
    request = urllib.request.Request(ORIGIN+'/standalone/post-training/download', data=payload)
    with opener.open(request, timeout=30) as response:
        body = response.read().decode()
        assert 'nf4' in body and 'HTTP export fixture' in body
        assert 'attachment' in response.headers['Content-Disposition']
        if form == 'json':
            assert json.loads(body) == record
        result['downloads'][form] = {'status': response.status, 'new_experiment_preserved': True}
print(json.dumps(result, ensure_ascii=False, indent=2))
