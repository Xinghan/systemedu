"""Copy only the reviewed media batch into the existing course source repository."""
from pathlib import Path
import json,shutil
H=Path(__file__).resolve().parent;R=H.parents[1];P=R/'packages/student-web/public'
source=Path('/Users/xinghan/Dev/systemeduidea/project_lines')
report=json.loads((H/'media-verification.json').read_text());assert report['passed']
people=json.loads((H/'presenters.json').read_text());scripts=json.loads((H/'scripts.json').read_text())
for line,slug in {'energy':'energy-motion','robotics':'robotics','earth':'earth-discovery','computing':'computing-ai','brain':'neuro-bionics'}.items():
 target=source/slug/'presenter-briefings-20261018';assert target.is_dir()
 items=[f for f in scripts if f['line']==line]
 evidence=[]
 for f in items:
  d=H/line/f['station'];video=P/f'mission/{line}/video'
  for name in [f"{f['station']}-v2.mp4",f"{f['station']}-zh-v2.vtt"]:shutil.copy2(video/name,target/name)
  evidence.append(json.loads((d/'final-probe.json').read_text()))
 (target/'verification.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
 (target/'README.md').write_text(f"# 阶段人物简报 · 已完成本地媒体验收\n\n{people[line]['name']}（虚构中国{people[line]['role']}）固定负责本线的 8 段阶段介绍。每段先用独立生成的动态讲话镜头交代当前任务，再接入原有设备画面和阶段说明。\n\n人物短片与无人任务中心背景分别维护；本次未修改地图、实验室环境背景、课程节点或学习记录。文件为 v2，v1 保留。`verification.json` 包含各片头时长、字幕和媒体验证信息。网站本地验收后提交，尚未部署生产环境。\n")
 print({'line':line,'videos':len(items),'source':str(target)})
