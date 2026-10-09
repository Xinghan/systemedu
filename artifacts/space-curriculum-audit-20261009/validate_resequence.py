"""Validate design coverage and published-source hashes, not student mastery."""
import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('plan_dir', type=Path)
parser.add_argument('--idea-root', type=Path, default=Path('/Users/xinghan/Dev/systemeduidea'))
parser.add_argument('--web-root', type=Path, default=Path('/Users/xinghan/Dev/systemedu'))
args = parser.parse_args()
audit = Path(__file__).parent
plan = json.loads((args.plan_dir / 'curriculum-map.json').read_text())
published = json.loads((audit / 'published-file-inventory.json').read_text())
tree = json.loads((audit / 'mars-analog-rover-tree.json').read_text())
assert plan['status'] == 'review-draft-not-live'
assert len(plan['bridges']) == 4
assert all('implemented' not in b['status'] or 'not-implemented' in b['status'] for b in plan['bridges'])

expected = {'mars-analog-rover:' + m['module_id'] for m in tree['modules']}
guided_trees = list((args.idea_root / 'project_lines/space-exploration/projects').glob('*/course/tree/knowledge_tree.json'))
guided_ids = {a['project'] for a in plan['allocation'] if a['source_kind'] == 'published-guided-course'}
for path in guided_trees:
    data = json.loads(path.read_text())
    if data['id'] in guided_ids:
        expected.update(data['id'] + ':' + m['module_id'] for m in data['modules'])
refs = [a['ref'] for a in plan['allocation']]
assert len(refs) == len(set(refs)) == len(expected) == 85
assert set(refs) == expected
stations = {s['id']: s for s in plan['stations']}
assert len(stations) == 8
homes = [ref for s in stations.values() for ref in s['modules']]
assert Counter(homes) == Counter(refs)
assert all(a['ref'] in stations[a['station']]['modules'] for a in plan['allocation'])
visiting, visited = set(), set()

def visit(station_id):
    assert station_id not in visiting, 'Dependency cycle: ' + station_id
    if station_id in visited:
        return
    visiting.add(station_id)
    for dependency in stations[station_id]['depends_on']:
        assert dependency in stations
        visit(dependency)
    visiting.remove(station_id)
    visited.add(station_id)

for station_id in stations:
    visit(station_id)
assert set(stations['T06']['depends_on']) == {'T04', 'T05'}
assert 'T04' not in stations['T05']['depends_on']
assert set(stations['T01']['micro_choices']) == {'spot-a-world', 'land-a-probe', 'drive-and-frame'}
assert any(s['project'] == 'lightkurve-transit-detective' for s in plan['side_quests'])
assert not any(a['project'] == 'lightkurve-transit-detective' for a in plan['allocation'])

matched = 0
authoring_drift = []
for item in plan['allocation']:
    source = args.idea_root / item['source_path']
    assert source.is_dir(), str(source)
    full = item['source_kind'] == 'published-full-course'
    relative = source.relative_to(args.idea_root / 'projects_data/mars-analog-rover') if full else Path(item['project']) / 'course/knodes' / item['module_id']
    inventory = published['mars-analog-rover' if full else 'guided-space']['files']
    reference = item['published_reference']
    reference_root = args.idea_root if reference['repository'] == 'systemeduidea' else args.web_root
    drift_files = []
    for filename in ['lesson.md', 'assignment.md']:
        data = (reference_root / reference['path'] / filename).read_bytes()
        key = str(relative / filename)
        assert hashlib.sha256(data).hexdigest() == inventory[key]['sha256'] == reference['sha256'][filename], 'Published source differs: ' + key
        if data != (source / filename).read_bytes():
            drift_files.append(filename)
            authoring_drift.append({'ref': item['ref'], 'file': filename, 'action': 'review uses published website version; authoring source unchanged'})
        matched += 1
    assert drift_files == item['authoring_drift_files']

with (args.plan_dir / 'node-allocation.tsv').open() as handle:
    rows = list(csv.DictReader(handle, delimiter='\t'))
assert len(rows) == 85
assert [row['source_ref'] for row in rows] == refs
assert [row['station'] for row in rows] == [item['station'] for item in plan['allocation']]
for block in plan['expedition_merge']:
    assert set(block['references']).issubset(expected)

report = {
    'date': '2026-10-09',
    'status': 'passed-design-validation-only',
    'source_nodes': len(refs),
    'published_lesson_assignment_hashes_matched': matched,
    'authoring_source_drift': authoring_drift,
    'stations': {key: len(s['modules']) for key, s in stations.items()},
    'actions': dict(sorted(Counter(a['action'] for a in plan['allocation']).items())),
    'checks': ['85 unique source nodes covered exactly once', 'all source paths exist',
               'source lessons and assignments match published files', 'dependencies exist and are acyclic',
               'digital study can run during manufacture', 'all three micro entries accounted for',
               'Lightkurve is a side quest, not a required rover prerequisite', 'TSV matches JSON allocation',
               'expedition references resolve', 'draft is not marked live'],
    'not_validated': ['platform implementation', 'student progress migration', 'runtime media regression',
                      'new hardware prototype', 'navigation bridge', 'student learning time or outcomes'],
}
(args.plan_dir / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
