"""Update only the existing five media triples; never touch progress or lesson records."""
import hashlib
import json
import shutil
from pathlib import Path

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
PUBLIC=ROOT/'packages/student-web/public'
source=json.loads((ROOT/'packages/ios-app/content/space-expedition.json').read_text())
verified=json.loads((HERE/'media-verification.json').read_text())
assert {item['ref'] for item in verified}==set(source['lessonCompletionFilms'])
targets=[ROOT/'packages/learning-runtime/dist',ROOT/'packages/ios-app/SystemEdu/Resources/WebRuntime']
for target in targets:
    manifest=target/'content/missions/space-expedition.json'
    before=manifest.read_bytes();story=json.loads(before)
    assert story['lessonCompletionFilms']==source['lessonCompletionFilms']
    for item in verified:
        film=story['lessonCompletionFilms'][item['ref']]
        video=PUBLIC/film['path'].lstrip('/')
        assert hashlib.sha256(video.read_bytes()).hexdigest()==item['sha256']
        for key in ['path','captions','poster']:
            src=PUBLIC/film[key].lstrip('/');dst=target/film[key].lstrip('/')
            assert src.is_file();shutil.copy2(src,dst)
            assert hashlib.sha256(src.read_bytes()).digest()==hashlib.sha256(dst.read_bytes()).digest()
    assert manifest.read_bytes()==before
print('Updated five existing video/captions/poster triples in both bundles; manifests and learning records untouched.')
