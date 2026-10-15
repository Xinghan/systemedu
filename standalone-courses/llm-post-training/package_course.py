"""Package original notes and starter repository; no external course generators."""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parent
DEST = ROOT.parents[1] / 'packages/student-web/public/standalone/post-training/ticketlab-course.zip'
manifest = json.loads((ROOT/'course.json').read_text())
for node in manifest['modules']:
    lesson = (ROOT/'nodes'/f'{node["id"]}.md').read_text()
    assert lesson.count('[[LAB]]') == 1 and '```' in lesson
    assert node['videos'] and node['reading'] and len(node['slides']) == 5
    assert all(v['url'].startswith('https://www.youtube.com/watch?v=') for v in node['videos'])
DEST.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(DEST, 'w', zipfile.ZIP_DEFLATED) as archive:
    for folder in ['nodes', 'project']:
        for path in sorted((ROOT/folder).rglob('*')):
            if path.is_file() and not any(p in ('__pycache__', 'runs', '.venv') for p in path.parts):
                data = path.read_bytes()
                if folder == 'nodes':
                    data = path.read_text().replace('[[LAB]]', '> 交互实验请在独立课程网页中打开。').encode()
                archive.writestr(f'ticketlab-course/{path.relative_to(ROOT)}', data)
    archive.write(ROOT/'course.json', 'ticketlab-course/course.json')
    archive.write(ROOT/'README.md', 'ticketlab-course/README.md')
print(f'{DEST}: {DEST.stat().st_size} bytes')
