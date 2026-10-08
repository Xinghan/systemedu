"""Read-only inventory of historical release payloads and live references."""
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

ROOT = Path('/opt/systemedu/releases')
report = {'releases': [], 'references': [], 'live_paths': [], 'docker_mounts': []}
for release in sorted(ROOT.iterdir()):
    if not release.is_dir() or release.is_symlink():
        continue
    entries = []
    for p in sorted(release.iterdir()):
        st = p.lstat()
        entries.append({'name': p.name, 'kind': 'symlink' if p.is_symlink() else 'directory' if p.is_dir() else 'file', 'bytes': st.st_size, 'target': os.readlink(p) if p.is_symlink() else None})
    statuses = {}
    for name in ['verification.json', 'preflight.json']:
        p = release / name
        if p.is_file():
            try:
                data = json.loads(p.read_text())
                statuses[name] = {k: data[k] for k in ['project', 'modules', 'slides', 'build_id', 'other_nodes_unchanged', 'presentation_mode'] if k in data}
            except (ValueError, OSError):
                statuses[name] = 'unparsed'
    report['releases'].append({'directory': str(release), 'entries': entries, 'status': statuses})

for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    links = [proc/'cwd', proc/'exe', proc/'root']
    try:
        links += list((proc/'fd').iterdir())
    except OSError:
        pass
    for link in links:
        try:
            target = os.readlink(link)
        except OSError:
            continue
        if str(ROOT) in target:
            report['references'].append({'type':'process', 'path':str(link), 'target':target})
    try:
        for line in (proc/'maps').read_text().splitlines():
            if str(ROOT) in line:
                report['references'].append({'type':'memory-map', 'pid':proc.name, 'target':line.split(maxsplit=5)[-1]})
    except OSError:
        pass

pattern = re.compile(r'/opt/systemedu/releases/[^\s\"\x27;)}]+')
for base in ['/etc/systemd/system', '/etc/nginx', '/etc/cron.d', '/var/spool/cron']:
    for current, dirs, files in os.walk(base, followlinks=False):
        for name in files:
            p = Path(current)/name
            try:
                if p.is_symlink():
                    target = str(p.resolve())
                    if str(ROOT) in target:
                        report['references'].append({'type':'config-symlink','path':str(p),'target':target})
                if p.stat().st_size > 2_000_000:
                    continue
                for match in pattern.findall(p.read_text(errors='ignore')):
                    report['references'].append({'type':'config-path','path':str(p),'target':match})
            except OSError:
                pass

live_bases = ['/opt/systemedu', '/root/.systemedu-library', '/root/.systemedu']
for base in live_bases:
    p = Path(base)
    if p.exists():
        report['live_paths'].append({'path':base,'resolved':str(p.resolve()),'device':p.stat().st_dev})
    for current, dirs, files in os.walk(base, followlinks=False):
        if Path(current) == Path('/opt/systemedu'):
            dirs[:] = [d for d in dirs if d != 'releases']
        dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__']]
        for name in dirs + files:
            p = Path(current)/name
            if p.is_symlink():
                target = str(p.resolve())
                if str(ROOT) in target:
                    report['references'].append({'type':'live-symlink','path':str(p),'target':target})

try:
    ids = subprocess.check_output(['docker','ps','-aq'],text=True).split()
    if ids:
        containers = json.loads(subprocess.check_output(['docker','inspect',*ids],text=True))
        for c in containers:
            for mount in c.get('Mounts',[]):
                report['docker_mounts'].append({'container':c['Name'], 'source':mount.get('Source'), 'destination':mount.get('Destination'), 'type':mount.get('Type')})
except (OSError, subprocess.CalledProcessError):
    report['docker_mounts_status'] = 'unavailable'

report['release_mounts'] = [line for line in Path('/proc/self/mountinfo').read_text().splitlines() if str(ROOT) in line]
if '--compact' in sys.argv:
    for release in report['releases']:
        release['entries'] = [e for e in release['entries'] if e['kind'] != 'file' or e['bytes'] > 1_000_000]
print(json.dumps(report, ensure_ascii=False, indent=None if '--compact' in sys.argv else 2))
