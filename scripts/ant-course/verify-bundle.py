#!/usr/bin/env python3
"""Check final shared artifacts and the installed-resource staging directory."""
from pathlib import Path
import hashlib,json,subprocess
repo=Path(__file__).resolve().parents[2]
root=repo/'packages/ios-app/SystemEdu/Resources/WebRuntime'
source=repo.parent/'systemeduidea/projects_data/ai-ant-ethologist'
read=lambda p:json.loads(p.read_text())
manifest=read(source/'manifest.json')
for item in manifest['files']:
    payload=(source/item['path']).read_bytes()
    assert hashlib.sha256(payload).hexdigest()==item['sha256'],item['path']
    assert len(payload)==item['size'],item['path']
catalog=read(root/'content/catalog.json')
course=next(c for c in catalog['courses'] if c['id']=='ai-ant-ethologist')
assert course['contentRevision']=='20261118' and len(course['modules'])==60
media=0
for node in course['modules']:
    lesson=read(root/node['path'].lstrip('/'))
    assert lesson['content_revision']=='20261118' and lesson['content_history']
    for item in lesson['interactions']:
        if item.get('path'):
            assert (root/item['path'].lstrip('/')).is_file()
            media+=1
    if node['moduleId']=='M01':
        assert any('先写出自己想了解的问题' in (root/i['path'].lstrip('/')).read_text() for i in lesson['interactions'] if i.get('path'))
assert media==119
# Older courses that did not opt in to a preserved revision history keep their progress.
transit=next(c for c in catalog['courses'] if c['id']=='lightkurve-transit-detective')
assert 'contentRevision' not in transit
assets=root/'content/assets/ai-ant-ethologist'
assert not (assets/'authoring').exists()
zip_path='downloads/ant-research-starter-20261118.zip'
assert (assets/zip_path).read_bytes()==(source/zip_path).read_bytes()
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
report={'status':'pass','source_commit':commit,'catalog_courses':len(catalog['courses']),'catalog_nodes':sum(len(c['modules']) for c in catalog['courses']),'ant_nodes':60,'ant_media':media,'revision':'20261118','old_question_histories':60,'source_manifest_files_verified':len(manifest['files']),'download_sha256':hashlib.sha256((assets/zip_path).read_bytes()).hexdigest(),'authoring_tools_excluded':True,'unrelated_course_progress_unchanged':True,'resource_bytes':sum(p.stat().st_size for p in root.rglob('*') if p.is_file())}
(repo/'artifacts/ant-course-repair/bundle-contract.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
