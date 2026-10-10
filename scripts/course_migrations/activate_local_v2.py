"""Activate the verified production-matched candidate while retaining the full old source."""
import hashlib,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'artifacts/molecule-numbering-20260914'
receipt=json.loads((ART/'production-verification.json').read_text())
assert receipt['numbering_version']=='consecutive-v2' and receipt['nodes']==47
candidate=ROOT/'artifacts/molecule-numbering-20260912/candidate-v5/molecule-monster-hunter'
canonical=ROOT.parent/'systemeduidea/projects_data/molecule-monster-hunter'
backup=ROOT.parent/'systemeduidea/course-backups/molecule-monster-hunter-legacy-v1-20260914'
assert not backup.exists() and json.loads((canonical/'manifest.json').read_text())['version']=='0.1.0'
report=json.loads((candidate.parent/'migration-report.json').read_text())
for rel,h in report['source_sha256'].items():assert hashlib.sha256((canonical/rel).read_bytes()).hexdigest()==h,rel
staging=canonical.with_name('molecule-monster-hunter-v2-activating');assert not staging.exists()
shutil.copytree(candidate,staging)
backup.parent.mkdir(exist_ok=True);canonical.rename(backup);staging.rename(canonical)
progress=ROOT/'docs/slide-image-prompts/molecule-monster-hunter-progress.json'
p=json.loads(progress.read_text());p['numbering_version']='consecutive-v2';p['updated']='2026-09-14'
for entry in p['entries']:entry.setdefault('numbering_version','legacy-v1')
for name in ['current_batch','last_production_batch']:p[name].setdefault('numbering_version','legacy-v1')
p['numbering_transition'].update(status='production-verified',record='docs/deployments/2026-09-14-molecule-numbering-v2.md',legacy_source_backup=str(backup))
p['next_recommended_nodes']=['M08'];progress.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n')
print('Canonical source activated as consecutive-v2; full legacy snapshot retained.')
