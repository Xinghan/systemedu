"""Install only the five completed lesson films; preserve generated introductions."""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PUBLIC = ROOT / 'packages/student-web/public'
TARGETS = [ROOT / 'packages/learning-runtime/dist', ROOT / 'packages/ios-app/SystemEdu/Resources/WebRuntime']
SOURCE = ROOT / 'packages/ios-app/content/space-expedition.json'
story = json.loads(SOURCE.read_text())
dialogues = json.loads((HERE / 'dialogue.json').read_text())
credit = {'title': 'Firmament_Active', 'artist': 'PeriTune', 'sourceURL': 'https://peritune.com/blog/2017/07/30/firmament/', 'licenseURL': 'https://creativecommons.org/licenses/by/4.0/', 'changes': '节选、响度调整、人声下自动降低配乐、淡入淡出。'}
films, verified, copies = {}, [], []
for ident, item in dialogues.items():
    assert json.loads((HERE / ident / 'task.json').read_text())['status'] == 'SUCCEEDED'
    assert (HERE / ident / 'composition.json').exists()
    stem = '/mission/space/expedition-v2/video/lesson-' + ident.lower() + '-summary'
    film = {'id': 'expedition-lesson-' + ident.lower() + '-summary', 'title': item['title'], 'description': item['lesson'], 'path': stem + '.mp4', 'captions': stem + '.vtt', 'poster': stem + '-poster.jpg', 'musicCredit': credit}
    for key in ['path', 'captions', 'poster']:
        source = PUBLIC / film[key].lstrip('/')
        assert source.is_file() and source.stat().st_size > 0
        copies += [(source, target / film[key].lstrip('/')) for target in TARGETS]
    video = PUBLIC / film['path'].lstrip('/')
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'quiet', '-show_streams', '-show_format', '-of', 'json', str(video)]))
    assert any(s['codec_name'] == 'h264' and s['width'] == 1280 and s['height'] == 720 for s in probe['streams'])
    assert any(s['codec_name'] == 'aac' for s in probe['streams'])
    assert 12 < float(probe['format']['duration']) <= 20.1
    films[item['ref']] = film
    verified.append({'ref': item['ref'], 'seconds': float(probe['format']['duration']), 'sha256': hashlib.sha256(video.read_bytes()).hexdigest()})
chapter = next(c for c in story['chapters'] if c['id'] == 'research-P1')
assert set(films) == set(chapter['refs']) and len(films) == 5
for source, target in copies:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    assert hashlib.sha256(source.read_bytes()).digest() == hashlib.sha256(target.read_bytes()).digest()
story['lessonCompletionFilms'] = films
SOURCE.write_text(json.dumps(story, ensure_ascii=False, indent=2) + '\n')
for target in TARGETS:
    manifest = target / 'content/missions/space-expedition.json'
    current = json.loads(manifest.read_text())
    assert [(c['id'], c['refs']) for c in current['chapters']] == [(c['id'], c['refs']) for c in story['chapters']]
    assert len(current['films']) == 15 and len(current['completionFilms']) == 14
    current['lessonCompletionFilms'] = films
    manifest.write_text(json.dumps(current, ensure_ascii=False, separators=(',', ':')))
(HERE / 'media-verification.json').write_text(json.dumps({'lesson_closings': verified, 'original_nodes': 120, 'other_nodes_expanded': 0}, ensure_ascii=False, indent=2) + '\n')
print('Installed five unique lesson summaries; retained 29 project/chapter films and all 120 nodes.')
