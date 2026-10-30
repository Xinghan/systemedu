"""Deploy a committed frontend delta into an isolated candidate, then switch."""
import hashlib, json, os, shutil, subprocess, sys, tarfile, time, urllib.request
from pathlib import Path

ROOT = Path('/opt/systemedu')
WEB = ROOT / 'packages/student-web'
UP = Path('/tmp/transit-format-20261030')
RELEASE = ROOT / 'releases/transit-format-20261030'
CANDIDATE = RELEASE / 'packages/student-web'
PREVIEW = 'systemedu-transit-format-preview'
PORT = 14031
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name, value): (RELEASE / name).write_text(json.dumps(value, indent=2)+'\n')
def read(name): return json.loads((RELEASE / name).read_text())
def run(*args, **kwargs): return subprocess.run(args, check=True, **kwargs)
def hashes(root):
    out = {}
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '__pycache__']]
        for name in files:
            if name in ['tsconfig.tsbuildinfo', 'next-env.d.ts'] or name.startswith('.env'): continue
            p = Path(base)/name
            out[str(p.relative_to(root))] = sha(p)
    return out
def health(port):
    for _ in range(30):
        try:
            with opener.open(f'http://127.0.0.1:{port}/library', timeout=10) as r:
                if r.status == 200: return
        except Exception: pass
        time.sleep(1)
    raise RuntimeError('Frontend health check failed')
def baseline():
    b = read('baseline.json')
    assert (WEB/'.next/BUILD_ID').read_text().strip() == b['build']
    assert hashes(WEB) == b['files'], 'Concurrent frontend change detected'
    assert hashes(ROOT/'packages/student-app') == read('backend-before.json')
def restore():
    run('systemctl', 'stop', 'systemedu-student-web')
    if WEB.exists(): WEB.rename(RELEASE/'student-web-failed')
    (RELEASE/'student-web-before').rename(WEB)
    run('systemctl', 'start', 'systemedu-student-web')
    health(4000)
    (RELEASE/'rolled-back.ok').touch()

action = sys.argv[1]
if action == 'snapshot':
    print(json.dumps({'build': (WEB/'.next/BUILD_ID').read_text().strip(), 'files': hashes(WEB)}))
    raise SystemExit(0)
RELEASE.mkdir(parents=True, exist_ok=True, mode=0o700)
expected = json.loads(((UP if action == 'stage' else RELEASE)/'request.json').read_text())
if (RELEASE/'request.json').exists():
    assert read('request.json') == expected, 'Release request changed after staging'
if action == 'stage':
    assert not CANDIDATE.exists(), 'Candidate already exists'
    b = json.loads((UP/'baseline.json').read_text())
    assert hashes(WEB) == b['files'] and (WEB/'.next/BUILD_ID').read_text().strip() == b['build']
    assert shutil.disk_usage(ROOT).free > 3_000_000_000
    assert b['build'] == expected['baseline_build']
    save('request.json', expected)
    shutil.copyfile(Path(__file__), RELEASE/'release.py')
    save('baseline.json', b)
    save('backend-before.json', hashes(ROOT/'packages/student-app'))
    assert sha(UP/'frontend.tar.gz') == expected['archive_sha256']
    shutil.copytree(WEB, CANDIDATE, ignore=shutil.ignore_patterns('node_modules', '.next', 'public', 'tsconfig.tsbuildinfo'))
    for name in ['public', 'node_modules']: run('cp', '-al', str(WEB/name), str(CANDIDATE/name))
    with tarfile.open(UP/'frontend.tar.gz') as archive:
        assert set(archive.getnames()) == set(expected['files'])
        for member in archive.getmembers():
            assert member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts
            assert member.name.startswith(('src/', 'public/')) or member.name in expected['config_files']
            p = CANDIDATE/member.name
            data = archive.extractfile(member).read()
            assert hashlib.sha256(data).hexdigest() == expected['files'][member.name]
            p.parent.mkdir(parents=True, exist_ok=True)
            p.unlink(missing_ok=True)
            p.write_bytes(data)
    save('web-expected.json', hashes(CANDIDATE))
    baseline()
    (RELEASE/'stage.ok').touch()
    print(json.dumps({'staged':len(expected['files']), 'source_commit':expected['source_commit']}))
elif action == 'build':
    assert (RELEASE/'stage.ok').exists() and not (RELEASE/'switch-started.ok').exists()
    baseline()
    run('python3', str(UP/'cache-fonts.py'))
    with (RELEASE/'build.log').open('w') as out:
        run('/usr/bin/node','node_modules/next/dist/bin/next','build','--webpack',cwd=CANDIDATE,stdout=out,stderr=subprocess.STDOUT,env={**os.environ,'NEXT_PUBLIC_STUDENT_API_URL':'','NEXT_PUBLIC_GATEWAY_URL':'','NEXT_TELEMETRY_DISABLED':'1','NEXT_FONT_GOOGLE_MOCKED_RESPONSES':str(RELEASE/'font-responses.json')})
    assert hashes(CANDIDATE) == read('web-expected.json')
    (RELEASE/'build.ok').touch()
    print(json.dumps({'built':True,'build':(CANDIDATE/'.next/BUILD_ID').read_text().strip()}))
elif action == 'preview':
    assert (RELEASE/'build.ok').exists()
    run('systemd-run','--unit='+PREVIEW,'--property=WorkingDirectory='+str(CANDIDATE),'/usr/bin/node',str(CANDIDATE/'node_modules/next/dist/bin/next'),'start','-p',str(PORT),'-H','127.0.0.1')
    health(PORT)
    print(json.dumps({'preview_port':PORT}))
elif action == 'publish':
    assert (RELEASE/'build.ok').exists() and not (RELEASE/'switch-started.ok').exists()
    check=json.loads((UP/'browser-verified.json').read_text())
    assert check['passed'] and check['modules']==32 and check['stages']==6
    assert check['mobile_verified'] and check['classroom_fixture_passed'] and check['public_passed'] and check['format_passed']
    assert check['source_commit']==expected['source_commit']
    save('candidate-verification.json', check)
    assert check['build']==(CANDIDATE/'.next/BUILD_ID').read_text().strip()
    baseline()
    assert hashes(CANDIDATE)==read('web-expected.json')
    shutil.copytree(WEB/'.next/static',CANDIDATE/'.next/static',dirs_exist_ok=True)
    run('systemctl','stop',PREVIEW,'systemedu-student-web')
    (RELEASE/'switch-started.ok').touch()
    try:
        WEB.rename(RELEASE/'student-web-before')
        CANDIDATE.rename(WEB)
        run('systemctl','start','systemedu-student-web')
        health(4000)
    except Exception:
        restore()
        raise
    (RELEASE/'live.ok').touch()
    print(json.dumps({'published':True,'build':(WEB/'.next/BUILD_ID').read_text().strip()}))
elif action=='verify':
    assert (RELEASE/'live.ok').exists()
    assert hashes(WEB)==read('web-expected.json')
    assert hashes(ROOT/'packages/student-app')==read('backend-before.json')
    for s in ['systemedu-student-web','systemedu-student-backend','systemedu-library']:
        assert subprocess.check_output(['systemctl','is-active',s],text=True).strip()=='active'
    report={'passed':True,'build':(WEB/'.next/BUILD_ID').read_text().strip(),'source_commit':expected['source_commit'],'changed_files':len(expected['files']),'backend_unchanged':True}
    save('verified.json',report)
    print(json.dumps(report))
elif action=='rollback':
    assert (RELEASE/'live.ok').exists() and not (RELEASE/'rolled-back.ok').exists()
    assert hashes(WEB)==read('web-expected.json')
    restore()
else: raise SystemExit('snapshot | stage | build | preview | publish | verify | rollback')
