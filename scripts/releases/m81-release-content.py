"""Validate that M81 is the only course node changed in this release."""
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import urllib.request

RELEASE = Path('/opt/systemedu/releases/m81-evidence-20260908')
ALLOWED = {'knodes/M81-w0-module/' + name for name in ['slides.json','lesson.md','assignment.md','theories.json','sections.json','audio_scripts.json']}

def hashes(root):
    return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}

def check_baseline(root):
    assert hashes(root) == json.loads((RELEASE / 'course-baseline.json').read_text()), 'Production course changed since staging'

action = sys.argv[1]
root = Path(sys.argv[2]) if len(sys.argv) > 2 else None
if action == 'baseline':
    (RELEASE / 'course-baseline.json').write_text(json.dumps(hashes(root), indent=2))
    print('Full production course baseline saved.')
elif action == 'check-baseline':
    check_baseline(root)
    print('Course baseline unchanged.')
elif action == 'manifest':
    before = json.loads((RELEASE / 'course-baseline.json').read_text())
    after = hashes(root)
    changes = {p for p in before.keys() | after.keys() if before.get(p) != after.get(p)}
    assert changes <= ALLOWED, changes - ALLOWED
    slides = json.loads((root / 'knodes/M81-w0-module/slides.json').read_text())['slides']
    assert len(slides) == 11
    assert sum(s['payload']['technical_visual']['renderer']=='regression-evidence' for s in slides)==10
    assert all(s.get('audio_path') is None for s in slides), 'This reviewed release is explicitly unvoiced'
    sys.path.insert(0, '/opt/systemedu/tools/content-pipeline/src')
    from content_pipeline.manifest import regenerate_manifest
    from library.manifest import load_manifest, verify_files
    manifest = regenerate_manifest(root)
    assert not verify_files(load_manifest(root / 'manifest.json'),root)
    (RELEASE / 'course-expected.json').write_text(json.dumps(hashes(root), indent=2))
    print(json.dumps({'changed_files': sorted(changes), 'files':len(manifest['files']),'M81_slides':11}))
elif action == 'backup-db':
    target = RELEASE / 'library-before.sqlite'
    assert not target.exists()
    with sqlite3.connect('file:/root/.systemedu-library/db.sqlite?mode=ro',uri=True) as source, sqlite3.connect(target) as dest:
        source.backup(dest)
    print('Consistent library database backup saved.')
elif action == 'verify':
    actual = hashes(root)
    expected = json.loads((RELEASE / 'course-expected.json').read_text())
    # The importer stores the newly uploaded tarball here, replacing its own
    # prior archive. Verify that derivative separately, never ignore content.
    archive = '_archive/molecule-monster-hunter-0.1.0.tar.gz'
    uploaded_hash = hashlib.sha256((RELEASE / 'molecule-monster-hunter.tar.gz').read_bytes()).hexdigest()
    assert actual.get(archive) == uploaded_hash, 'Importer archive differs from uploaded release'
    assert {k:v for k,v in actual.items() if k != archive} == {k:v for k,v in expected.items() if k != archive}, 'Published files differ from staged files'
    req = urllib.request.Request('http://127.0.0.1:18821/v1/projects/molecule-monster-hunter/knodes/M81',headers={'Authorization':'Bearer '+os.environ['LIBRARY_LICENSE_TOKEN']})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req) as response:
        content=json.load(response)
    slides=json.loads((root/'knodes/M81-w0-module/slides.json').read_text())['slides']
    assert content['slides']==slides
    before=json.loads((RELEASE/'course-baseline.json').read_text())
    changed={p for p in before.keys()|actual.keys() if before.get(p)!=actual.get(p)}
    assert changed<=ALLOWED|{'manifest.json', archive}
    print(json.dumps({'verified_node':'M81','slides':len(slides),'unvoiced':True,'changed_files':sorted(changed),'other_nodes_unchanged':True}))
else:
    raise SystemExit('Unknown action')
