from pathlib import Path
import json,os
from PIL import Image
r=Path(os.environ.get('SYSTEMEDU_ROOT',str(Path(__file__).resolve().parents[2])))
base=Path('/Users/xinghan/.codex/generated_images/01a0b31d-cfb2-7081-bf83-90042da3d74f')
ids={'earth-observation':'6b769bd7-1428-46e7-b993-28a69ea62ea2','earth-measurement':'fd4be2ec-4e31-4dcb-84c1-6c234ca097cc','earth-evidence':'9bec3458-6c37-490d-b4f8-06fb236f28e0','computing-data':'78666375-b81d-49a8-8e90-d5d521c73274','computing-model':'c7a87da5-d44f-47e5-9cf4-8a7d1f8e5fdf','computing-review':'339d5696-c65a-43ca-bc33-088d94684800','brain-signal':'699dad1b-688c-4070-aba5-c40334795a08','brain-processing':'8dcd9b59-eeca-43a7-81c2-d18b91c5fdf9','brain-control':'b5ac589c-c2b3-4639-af49-9c15ad4894bd'}
maps={'earth':'b2ac2c4c-3a09-47b5-9fc0-eecdbb86e45c','computing':'b135346d-e8d5-4c83-a791-b9fdf5e852d2','brain':'2f3aced2-ba04-4122-a503-32c15b650fa2'}
films=json.loads((r/'packages/student-web/src/lib/project-lines/remaining-stage-films.json').read_text())
for mission,items in films.items():
 out=r/f'packages/student-web/public/mission/{mission}';(out/'stations').mkdir(parents=True,exist_ok=True)
 im=Image.open(base/f'exec-{maps[mission]}.png').convert('RGB');im.save(out/'campus-map-v1.webp',quality=86)
 for f in items:
  for width in [640,960,1536]:
   im=Image.open(base/f'exec-{ids[f["frame"]]}.png').convert('RGB');im.thumbnail((width,9999));im.save(out/f'stations/{f["station"]}-v1-{width}.webp',quality=83)
(r/'artifacts/remaining-missions-20261018/media-provenance.json').write_text(json.dumps({'generator':'built-in imagegen','maps':maps,'scenes':ids,'source_directory':str(base),'note':'3 个新地图、9 个新无人实验室场景。每线 3 个实验室场景用于 8 个阶段；阶段简报采用轻微镜头运动、中文旁白与字幕。场景为生成示意，非实物操作或实验结果录像。'},ensure_ascii=False,indent=2)+'\n')
print('3 maps, 72 optimized stage background variants')
