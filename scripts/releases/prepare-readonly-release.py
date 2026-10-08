"""Prepare a narrow release from inspected production baseline; never contact production."""
import hashlib
import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/readonly-release-20260914'
WEB = ROOT / 'packages/student-web'
COURSE = ROOT.parent / 'systemeduidea/projects_data/molecule-monster-hunter'
BASE = OUT / 'baseline'
FILES = ['readonly-presentation.tsx', 'discovery-brief-readonly.tsx', 'discovery-readonly.css',
         'rdkit-runtime-readonly.tsx', 'skeleton-readonly.tsx', 'science-readonly.css',
         'python-variable-visual.tsx', 'python-variable.css', 'molecular-object-3d.tsx']

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def replace_one(text, old, new):
    assert text.count(old) == 1, old
    return text.replace(old, new, 1)

payload = OUT / 'web'
assert not payload.exists(), 'Do not silently replace frozen release payload'
component = payload / 'src/components/learning'
component.mkdir(parents=True)
for name in FILES:
    (component / name).write_bytes((WEB / 'src/components/learning' / name).read_bytes())
teacher = (BASE / 'teacher-scene-view.tsx').read_text()
teacher = replace_one(teacher, 'import { FormulaVisual, TechnicalVisual } from "./technical-visual"', 'import { FormulaVisual, TechnicalVisual } from "./technical-visual"\nimport { ReadonlyPresentation, PresentationPlaybackControls, hasReadonlyAnimation } from "./readonly-presentation"')
teacher = replace_one(teacher, '      <SlideSurface fit={layout === "fit"}>', '      <ReadonlyPresentation key={moduleId + slide.slide_id + idx}>\n      <SlideSurface fit={layout === "fit"}>')
teacher = replace_one(teacher, '        {audioPath ? audio?.url ? (', '        {hasReadonlyAnimation(slide.payload.technical_visual) && <PresentationPlaybackControls />}\n        {audioPath ? audio?.url ? (')
teacher = replace_one(teacher, '      <nav aria-label={t("teacher.page_navigation")}', '      </ReadonlyPresentation>\n      <nav aria-label={t("teacher.page_navigation")}')
(component / 'teacher-scene-view.tsx').write_text(teacher)
technical = (BASE / 'technical-visual.tsx').read_text()
for old, new, old_path, new_path in [
    ('DiscoveryBriefVisual', 'DiscoveryBriefReadonly', './discovery-brief-visual', './discovery-brief-readonly'),
    ('RdkitRuntimeVisual', 'RdkitRuntimeReadonly', './rdkit-runtime-visual', './rdkit-runtime-readonly'),
    ('SkeletonEvidenceVisual', 'SkeletonReadonly', './skeleton-evidence-visual', './skeleton-readonly'),
]:
    assert technical.count(old) == 2
    technical = technical.replace(old, new)
    technical = replace_one(technical, old_path, new_path)
(component / 'technical-visual.tsx').write_text(technical)
course_files = []
for module in ['M01', 'M02', 'M03', 'M08']:
    node, = (COURSE / 'knodes').glob(module + '-*')
    fixture = ROOT / f'course_factory/fixtures/molecule-monster-hunter/{module}-readonly-v1.json'
    assert (node / 'slides.json').read_bytes() == fixture.read_bytes()
    course_files.extend([f'knodes/{node.name}/{name}' for name in ['slides.json', 'audio_scripts.json']])
course_files.append('manifest.json')
with tarfile.open(OUT / 'course-delta.tar.gz', 'w:gz') as tar:
    for rel in course_files: tar.add(COURSE / rel, arcname=rel)
web_files = sorted(str(p.relative_to(payload)) for p in payload.rglob('*') if p.is_file())
with tarfile.open(OUT / 'web-delta.tar.gz', 'w:gz') as tar:
    for rel in web_files: tar.add(payload / rel, arcname=rel)
record = {'project': 'molecule-monster-hunter', 'production_deployed': False, 'modules': ['M01','M02','M03','M08'], 'slides': 34,
          'expected_build': 'wePmenNJ5nB7jso6BM2a9',
          'web_sha256': {rel: sha(payload / rel) for rel in web_files},
          'baseline_web_sha256': {f'src/components/learning/{p.name}': sha(p) for p in BASE.glob('*.tsx')},
          'course_sha256': {rel: sha(COURSE / rel) for rel in course_files}}
(OUT / 'expected.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'modules': record['modules'], 'slides': 34, 'web_files': web_files, 'course_files': course_files}, ensure_ascii=False, indent=2))
