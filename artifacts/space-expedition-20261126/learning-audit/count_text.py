"""Count the bundled iPad teaching text, not generated JSON/source-code bytes.

Run from repository root. Only reads the bundle and writes this audit directory.
No canonical course text or learner records are changed.
"""
from pathlib import Path
import hashlib
import json
import re
import statistics

ROOT = Path(__file__).resolve().parents[3]
BUNDLE = ROOT / 'packages/ios-app/SystemEdu/Resources/WebRuntime/content'
OUT = Path(__file__).resolve().parent


def visible(markdown):
    # Preserve rendered link labels, discard URLs, media markers and formatting.
    text = re.sub(r'\[\[[A-Z0-9_]+:[^\]]+\]\]', '', markdown or '')
    text = re.sub(r'!?\[([^\]]*)\]\([^\n]*?\)', r'\1', text)
    text = re.sub(r'^```[^\n]*\n|^```\s*$', '', text, flags=re.M)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'^[#>*\-]+\s*', '', text, flags=re.M)
    return text.replace('`', '').replace('**', '')


def counts(text):
    text = visible(text)
    return {'han_characters': len(re.findall(r'[\u3400-\u9fff]', text)),
            'non_whitespace_characters': len(re.sub(r'\s', '', text))}


def total(items):
    return {key: sum(item[key] for item in items) for key in
            ['han_characters', 'non_whitespace_characters']}


all_modules = {}
module_paths = {}
for path in (BUNDLE / 'modules').glob('*.json'):
    item = json.loads(path.read_text())
    key = item['course_id'] + ':' + item['module_id']
    assert key not in all_modules, key
    all_modules[key] = item
    module_paths[key] = path

story = json.loads((BUNDLE / 'missions/space-expedition.json').read_text())
refs = [ref for chapter in story['chapters'] for ref in chapter['refs']]
assert len(set(refs)) == len(refs)
assert all(ref in all_modules for ref in refs)
rows = []
foundations = {}
for ref in refs:
    module = all_modules[ref]
    levels = {'K1': [], 'K3': []}
    for theory in module.get('theories', []):
        bodies = theory.get('level_bodies', [])
        for level in levels:
            found = next((b['body_markdown'] for b in bodies if b['level'] == level), None)
            if found is not None:
                levels[level].append(found)
            elif level == 'K1':
                levels[level].append(theory.get('body_markdown', ''))
    for foundation in module.get('foundations', []):
        if module['course_id'] == 'lightkurve-transit-detective':
            previous = foundations.setdefault(foundation['id'], foundation)
            assert previous['body_markdown'] == foundation['body_markdown']
    rows.append({'ref': ref, 'title': module['title'],
                 'lesson': counts(module.get('lesson', '')),
                 'assignment': counts(module.get('assignment', '')),
                 'K1': counts('\n'.join(levels['K1'])),
                 'K3': counts('\n'.join(levels['K3'])),
                 'theory_count': len(module.get('theories', [])),
                 'foundation_ids': [x['id'] for x in module.get('foundations', [])],
                 'sections': re.findall(r'^## (.+)$', module.get('lesson', ''), re.M),
                 'active_minutes_authored_not_validated': module.get('active_minutes'),
                 'source_sha256': hashlib.sha256(module_paths[ref].read_bytes()).hexdigest(),
                 'source': str(module_paths[ref].relative_to(ROOT))})

course = [r for r in rows if r['ref'].startswith('lightkurve-transit-detective:')]
assert len(course) == 32
report = {
    'scope': '2026-11-26 iPad bundle; reader source text, not proof of learning usability',
    'method': 'Han = U+3400–U+9FFF. URLs, markdown markers and media IDs excluded. Code remains in non-whitespace count. K1 and K3 counted separately; body_markdown fallback counted only if K1 absent. No double counting K1 fallback or repeated foundation modules. Main lesson count excludes concept panels, assignments, assessment, captions and slides. Full authored corpus is larger; these are separate layers, not a single mandatory reading total.',
    'route_node_count': len(rows),
    'route_lesson_total': total([r['lesson'] for r in rows]),
    'lightkurve': {
        'modules': len(course),
        'main_lesson_total': total([r['lesson'] for r in course]),
        'K1_total': total([r['K1'] for r in course]),
        'K3_total': total([r['K3'] for r in course]),
        'assignment_total': total([r['assignment'] for r in course]),
        'foundation_unique_count': len(foundations),
        'foundation_unique_total': counts('\n'.join(f['body_markdown'] for f in foundations.values())),
        'first_five_lesson_total': total([r['lesson'] for r in course[:5]]),
        'lesson_han_median': statistics.median(r['lesson']['han_characters'] for r in course),
        'lesson_han_min': min(r['lesson']['han_characters'] for r in course),
        'lesson_han_max': max(r['lesson']['han_characters'] for r in course),
        'rows': course,
    },
    'route_rows': rows,
}
(OUT / 'text-counts.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['route_rows', 'lightkurve']}, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in report['lightkurve'].items() if k != 'rows'}, ensure_ascii=False, indent=2))
