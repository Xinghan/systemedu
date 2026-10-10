"""Read-only inventory of the published aerospace course files; no learner data."""
import hashlib,json
from pathlib import Path
roots={'mars-analog-rover':Path('/root/.systemedu-library/media/projects/mars-analog-rover'),'guided-space':Path('/opt/systemedu/packages/student-web/public/project-lines/space-exploration')}
result={}
for name,root in roots.items():
 patterns=['manifest.json','tree/knowledge_tree.json','blueprint/README.zh.md','knodes/*/lesson.md','knodes/*/assignment.md'] if name=='mars-analog-rover' else ['*/course/tree/knowledge_tree.json','*/course/knodes/*/lesson.md','*/course/knodes/*/assignment.md','assemble-a-rover/hardware/build-guide.md','assemble-a-rover/hardware/controller.py']
 files=sorted({p for pattern in patterns for p in root.glob(pattern) if p.is_file()})
 result[name]={'root':str(root),'files':{str(p.relative_to(root)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in files}}
print(json.dumps(result,ensure_ascii=False,indent=2))
