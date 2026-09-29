"""Publish only reviewed cover assets/references over the production baseline.

Production source and backups stay on the server. No course files or databases
are imported or changed. A browser-verified candidate is required to switch.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request

ROOT = Path('/opt/systemedu')
WEB = ROOT / 'packages/student-web'
UP = Path('/tmp/flagship-covers-20260929')
RELEASE = ROOT / 'releases/flagship-covers-20260929'
CANDIDATE = RELEASE / 'packages/student-web'
PREVIEW = 'systemedu-covers-preview-web'
PORT = '14001'
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def request(url):
    with opener.open(url, timeout=30) as response:
        return response.read()


def save(name, value):
    (RELEASE / name).write_text(json.dumps(value, indent=2) + '\n')


def read(name):
    return json.loads((RELEASE / name).read_text())


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def hashes(root):
    result = {}
    for directory, names, files in os.walk(root):
        names[:] = [n for n in names if n not in ['node_modules', '.next', '__pycache__']]
        for name in files:
            if name != 'tsconfig.tsbuildinfo':
                p = Path(directory) / name
                result[str(p.relative_to(root))] = sha(p)
    return result


def health():
    for _ in range(30):
        try:
            request('http://127.0.0.1:4000/library')
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError('Frontend health check failed')


def baseline():
    assert (WEB / '.next/BUILD_ID').read_text().strip() == read('baseline.json')['build']
    assert hashes(WEB) == read('web-before.json'), 'Another frontend change detected'
    assert hashes(ROOT / 'packages/student-app') == read('backend-before.json')
    assert json.loads(request('http://127.0.0.1:18820/api/library/projects')) == read('projects-before.json')


def prefer_responsive_card_cover():
    p = CANDIDATE / 'src/components/library/discovery-project-card.tsx'
    s = p.read_text()
    replacements = {
        '  const duration = project?.duration_weeks': '  const responsiveCover = projectCoverProps(entry.id, library.coverUrl(entry.id), "card")\n  const duration = project?.duration_weeks',
        '{entry.coverImage ? (': '{entry.coverImage && !responsiveCover.srcSet && !coverFailed ? (',
        'project?.cover_image_path && !coverFailed': '(responsiveCover.srcSet || project?.cover_image_path) && !coverFailed',
        '{...projectCoverProps(entry.id, library.coverUrl(entry.id), "card")}': '{...responsiveCover}',
    }
    for old, new in replacements.items():
        assert s.count(old) == 1, 'Unexpected cover card baseline'
        s = s.replace(old, new, 1)
    p.write_text(s)


def lazy_card_cover():
    p = CANDIDATE / 'src/components/library/discovery-project-card.tsx'
    s = p.read_text()
    needle = '<img {...responsiveCover} alt=""'
    assert s.count(needle) == 1 and 'loading="lazy"' not in s
    p.write_text(s.replace(needle, needle + ' loading="lazy" decoding="async"', 1))


def align_flagship_card_images():
    p = CANDIDATE / 'src/components/library/discovery.module.css'
    s = p.read_text()
    marker = '/* Individual flagship covers share one proportional frame. */'
    assert marker not in s
    p.write_text(s + '\n' + marker + '\n'
                 '.projectCard[data-kind="full"] .cardVisual{height:auto;aspect-ratio:3 / 2;flex-shrink:0}\n'
                 '.projectCard[data-kind="full"] .coverPhoto{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}\n')


def restore():
    run('systemctl', 'stop', 'systemedu-student-web')
    if WEB.exists():
        WEB.rename(RELEASE / 'student-web-failed')
    (RELEASE / 'student-web-before').rename(WEB)
    run('systemctl', 'start', 'systemedu-student-web')
    health()
    (RELEASE / 'rolled-back.ok').touch()


action = sys.argv[1]
RELEASE.mkdir(parents=True, exist_ok=True, mode=0o700)
expected = json.loads((UP / 'request.json').read_text())
if action == 'stage':
    assert not CANDIDATE.exists()
    assert shutil.disk_usage(ROOT).free > 2_000_000_000
    save('baseline.json', {'build': (WEB / '.next/BUILD_ID').read_text().strip()})
    before = hashes(WEB)
    save('web-before.json', before)
    save('backend-before.json', hashes(ROOT / 'packages/student-app'))
    save('projects-before.json', json.loads(request('http://127.0.0.1:18820/api/library/projects')))
    shutil.copytree(WEB, CANDIDATE, ignore=shutil.ignore_patterns('node_modules', '.next', 'public', 'tsconfig.tsbuildinfo'))
    for name in ['node_modules', 'public']:
        run('cp', '-al', str(WEB / name), str(CANDIDATE / name))
    assert sha(UP / 'assets.tar.gz') == expected['archive_sha256']
    with tarfile.open(UP / 'assets.tar.gz') as archive:
        assert set(archive.getnames()) == set(expected['files'])
        for member in archive.getmembers():
            assert member.isfile() and member.name.startswith('packages/student-web/') and '..' not in Path(member.name).parts
            target = RELEASE / member.name
            # Never truncate a public hardlink shared with the live release.
            if target.exists():
                assert sha(target) == expected['files'][member.name], member.name
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())
            assert sha(target) == expected['files'][member.name]
    index = CANDIDATE / 'src/lib/api/index.ts'
    s = index.read_text()
    assert 'flagshipCovers' not in s
    needle = '  coverUrl: (slug: string) =>\n'
    assert s.count(needle) == 1
    s = 'import flagshipCovers from "@/lib/project-lines/flagship-covers.json"\n' + s
    s = s.replace(needle, needle + '    (flagshipCovers as Record<string, string>)[slug] ??\n', 1)
    index.write_text(s)
    for relative, slug, placement in [
        ('src/components/library/discovery-project-card.tsx', 'entry.id', 'card'),
        ('src/app/(home)/library/[slug]/page.tsx', 'slug', 'hero'),
    ]:
        p = CANDIDATE / relative
        s = p.read_text()
        assert 'projectCoverProps' not in s
        needle = 'src={library.coverUrl(' + slug + ')}'
        assert s.count(needle) == 1, relative
        s = s.replace('"use client"', '"use client"\n\nimport { projectCoverProps } from "@/lib/project-cover"', 1)
        s = s.replace(needle, '{...projectCoverProps(' + slug + ', library.coverUrl(' + slug + '), "' + placement + '")}')
        p.write_text(s)
    prefer_responsive_card_cover()
    lazy_card_cover()
    align_flagship_card_images()
    after = hashes(CANDIDATE)
    changed = {p for p in before.keys() | after.keys() if before.get(p) != after.get(p)}
    allowed = {p.removeprefix('packages/student-web/') for p in expected['files']} | {'src/lib/api/index.ts', 'src/components/library/discovery-project-card.tsx', 'src/components/library/discovery.module.css', 'src/app/(home)/library/[slug]/page.tsx'}
    assert changed <= allowed and len(changed) >= 30
    save('web-expected.json', after)
    save('changed-files.json', {p: after[p] for p in sorted(changed)})
    baseline()
    (RELEASE / 'stage.ok').touch()
    print(json.dumps({'staged_files': len(changed), 'course_and_student_data_unchanged': True, 'production_unchanged': True}))
elif action in ['repair-staged-snapshot', 'repair-staged-lazy', 'repair-staged-layout']:
    # Upgrade the first isolated candidate; never edit the running production tree.
    assert (RELEASE / 'stage.ok').exists() and not (RELEASE / 'switch-started.ok').exists()
    baseline()
    assert hashes(CANDIDATE) == read('web-expected.json')
    if action == 'repair-staged-snapshot':
        prefer_responsive_card_cover()
    else:
        run('systemctl', 'stop', PREVIEW)
        if action == 'repair-staged-lazy':
            lazy_card_cover()
        else:
            align_flagship_card_images()
    after = hashes(CANDIDATE)
    save('web-expected.json', after)
    changed = set(read('changed-files.json'))
    if action == 'repair-staged-layout':
        changed.add('src/components/library/discovery.module.css')
    save('changed-files.json', {p: after[p] for p in sorted(changed)})
    (RELEASE / 'build.ok').unlink(missing_ok=True)
    print(json.dumps({'candidate_repair': action, 'rebuild_required': True}))
elif action == 'build':
    assert (RELEASE / 'stage.ok').exists()
    baseline()
    with (RELEASE / 'build.log').open('w') as log:
        result = subprocess.run(['npm', 'run', 'build'], cwd=CANDIDATE, env={**os.environ, 'NEXT_PUBLIC_STUDENT_API_URL': '', 'NEXT_PUBLIC_GATEWAY_URL': ''}, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        print((RELEASE / 'build.log').read_text()[-5000:])
        raise SystemExit(result.returncode)
    baseline()
    (RELEASE / 'build.ok').touch()
    print(json.dumps({'build': (CANDIDATE / '.next/BUILD_ID').read_text().strip()}))
elif action == 'preview':
    assert (RELEASE / 'build.ok').exists()
    run('systemd-run', '--unit=' + PREVIEW, '--property=WorkingDirectory=' + str(CANDIDATE), '/usr/bin/node', str(CANDIDATE / 'node_modules/next/dist/bin/next'), 'start', '-p', PORT, '-H', '127.0.0.1')
    print('Candidate started on loopback ' + PORT)
elif action == 'publish':
    assert (RELEASE / 'build.ok').exists() and not (RELEASE / 'switch-started.ok').exists()
    verification = json.loads((UP / 'browser-verified.json').read_text())
    assert verification['passed'] and verification['build'] == (CANDIDATE / '.next/BUILD_ID').read_text().strip()
    baseline()
    assert hashes(CANDIDATE) == read('web-expected.json')
    shutil.copytree(WEB / '.next/static', CANDIDATE / '.next/static', dirs_exist_ok=True)
    run('systemctl', 'stop', PREVIEW, 'systemedu-student-web')
    (RELEASE / 'switch-started.ok').touch()
    try:
        WEB.rename(RELEASE / 'student-web-before')
        CANDIDATE.rename(WEB)
        run('systemctl', 'start', 'systemedu-student-web')
        health()
    except Exception:
        restore()
        raise
    (RELEASE / 'live.ok').touch()
    print(json.dumps({'published': True, 'build': (WEB / '.next/BUILD_ID').read_text().strip()}))
elif action == 'verify':
    assert (RELEASE / 'live.ok').exists() and not (RELEASE / 'rolled-back.ok').exists()
    assert hashes(WEB) == read('web-expected.json')
    assert hashes(ROOT / 'packages/student-app') == read('backend-before.json')
    assert json.loads(request('http://127.0.0.1:18820/api/library/projects')) == read('projects-before.json')
    for service in ['systemedu-student-web', 'systemedu-student-backend', 'systemedu-library']:
        assert subprocess.check_output(['systemctl', 'is-active', service], text=True).strip() == 'active'
    report = {'passed': True, 'build': (WEB / '.next/BUILD_ID').read_text().strip(), 'changed_files': len(read('changed-files.json')), 'backend_and_catalog_unchanged': True}
    save('verified.json', report)
    print(json.dumps(report))
elif action == 'rollback':
    assert (RELEASE / 'live.ok').exists() and not (RELEASE / 'rolled-back.ok').exists()
    assert hashes(WEB) == read('web-expected.json'), 'Later frontend changes detected'
    restore()
    print('Restored the previous frontend; course and student data untouched')
else:
    raise SystemExit('stage | build | preview | publish | verify | rollback')
