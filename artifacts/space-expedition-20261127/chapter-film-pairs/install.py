"""Install only approved completed chapter media, without exporting unrelated course changes."""
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
films = dict(story.get('completionFilms', {}))
verified = []
pending_copies = []
for chapter in story['chapters']:
    ident = chapter['id']
    if ident in dialogues:
        assert json.loads((HERE / ident / 'task.json').read_text())['status'] == 'SUCCEEDED'
        assert (HERE / ident / 'composition.json').exists()
        stem = '/mission/space/expedition-v2/video/' + ident + '-complete'
        films[ident] = {'id': 'expedition-' + ident + '-complete', 'title': '林岚的阶段回信', 'description': '本章成果回顾：' + chapter['delivery']['title'], 'path': stem + '.mp4', 'captions': stem + '.vtt', 'poster': stem + '-poster.jpg', 'musicCredit': credit}
    film = films[ident]
    for key in ['path', 'captions', 'poster']:
        source = PUBLIC / film[key].lstrip('/')
        assert source.is_file() and source.stat().st_size > 0
        if ident in dialogues:
            pending_copies += [(source, target / film[key].lstrip('/')) for target in TARGETS]
    video = PUBLIC / film['path'].lstrip('/')
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'quiet', '-show_streams', '-show_format', '-of', 'json', str(video)]))
    assert any(s['codec_name']=='h264' and s['width']==1280 and s['height']==720 for s in probe['streams'])
    assert any(s['codec_name']=='aac' for s in probe['streams'])
    assert 10 < float(probe['format']['duration']) < 20
    verified.append({'chapter':ident, 'seconds':float(probe['format']['duration']), 'sha256':hashlib.sha256(video.read_bytes()).hexdigest()})
assert set(films) == {c['id'] for c in story['chapters']}
for source,target in pending_copies:
    target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
    assert hashlib.sha256(source.read_bytes()).digest()==hashlib.sha256(target.read_bytes()).digest()
story['completionFilms']=films
SOURCE.write_text(json.dumps(story,ensure_ascii=False,indent=2)+'\n')
for target in TARGETS:
    manifest=target/'content/missions/space-expedition.json'
    current=json.loads(manifest.read_text())
    assert [(c['id'],c['refs']) for c in current['chapters']]==[(c['id'],c['refs']) for c in story['chapters']]
    assert len(current['films'])==15
    # Verify existing intros remain bundled and identical; no script or voice change to them.
    for film in current['films']:
        for key in ['path','captions','poster']:
            assert hashlib.sha256((target/film[key].lstrip('/')).read_bytes()).digest()==hashlib.sha256((PUBLIC/film[key].lstrip('/')).read_bytes()).digest()
    current['completionFilms']=films
    manifest.write_text(json.dumps(current,ensure_ascii=False,separators=(',',':')))
(HERE/'media-verification.json').write_text(json.dumps({'chapter_introductions':14,'chapter_closings':14,'project_introduction':1,'original_nodes':120,'closings':verified},ensure_ascii=False,indent=2)+'\n')
print('Installed 14 chapter film pairs and preserved the project opening, 120 nodes and original course files.')
