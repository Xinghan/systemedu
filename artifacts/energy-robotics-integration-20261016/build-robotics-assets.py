from pathlib import Path
import os
from PIL import Image
import json
r=Path(os.environ.get("SYSTEMEDU_ROOT", str(Path(__file__).resolve().parents[2])));pub=r/'packages/student-web/public';out=pub/'mission/robotics';out.mkdir(exist_ok=True)
base=pub/'project-lines/neuro-bionics'
images={'discovery':'grasp-a-virtual-block/cover-editorial-v2.png','specification':'write-a-grasp-rule/cover-editorial-v2.png','fabrication':'design-a-printed-gripper/cover-editorial-v2.png','control':'aloha/cover-editorial-v2.png','demonstration':'assemble-a-signal-controller/cover-editorial-v2.png','learning':'clean-a-signal/cover-editorial-v2.png','validation':'test-an-unseen-object/cover-editorial-v2.png','handover':'cover-cinematic-v3.png'}
for station,source in images.items():
 for width in [640,960,1536]:
  image=Image.open(base/source).convert('RGB');image.thumbnail((width,9999));dest=out/f'stations/{station}-v1-{width}.webp';dest.parent.mkdir(exist_ok=True);image.save(dest,quality=84)
mapSource=Path('/Users/xinghan/.codex/generated_images/01a0b31d-cfb2-7081-bf83-90042da3d74f/exec-5bb3829b-d317-49e8-9d0f-4327b63d4a68.png')
im=Image.open(mapSource);im.save(out/'campus-map-v1.webp',quality=87)
briefs=[('discovery','从一次抓取开始','先转动夹指，让它接近目标。改变一个开口，再比较两次几何结果。保存自己的发现；下一站，你会为双臂领取一个真实协作任务。','操作一个夹爪','留下两次几何试验'),('specification','先把任务说清楚','两只手一起完成托盘和插块任务。先分清人、回放和策略谁在发出动作，再约定字段与工作区。把小夹爪的规则带来，按双臂接口重新核对。','辨清动作来源','交付无动力接口'),('fabrication','先试配，再组装四臂','先印一个小试配件，量出真实孔径和间隙。再打印四臂结构、托盘与相机座。原夹爪提供制作经验，但新工位的尺寸、供电和干涉仍要逐项核对。','试印与实测','交付打印工位'),('control','让两只执行臂协作','从能诊断的小夹爪系统开始，再逐臂标定自己的四臂工位。核对方向、范围和停止能力，让图像与动作对上同一时刻。遥操作成功，还不代表自主学会。','核对标定和接口','交付同步遥操作'),('demonstration','把自己的示范变成数据','录下自己的完整示范，同时保留失败和介入。用不同起点补足覆盖，再按整个回合划分训练和验证。先封存测试条件，不能用看过的答案证明模型会做。','采集完整回合','封存本人数据包'),('learning','从一个预测走到 ACT','用自己的训练样本，手算一个小预测器，再连接图像、注意力和动作分块。保留每一步计算和实验。最后训练并冻结部署包，漂亮的离线分数仍需接受实机检验。','手算、训练、复查','冻结部署候选'),('validation','让机器人接受真实考验','先核对执行时序、掉线和停止，再签存独立验收方案。按全部预定条件运行，保留失败和人工介入。修订可以另做，但不能覆盖第一次结果。','先定标准再运行','保留全部试次'),('handover','把任务交给下一位工程师','把打印工位、本人数据、模型和原始试次连成可复现的证据链。请另一人重现同一个任务，讲清自己的贡献。没有验证的部分，诚实地留在待完成清单。','复跑同一套版本','交付作品与边界')]
films=[]
for idx,(station,title,voice,action,output) in enumerate(briefs):
 films.append(dict(level=idx+1,station=station,title=title,dialogue=voice,brief=voice,action=action,output=output,frame=station))
(r/'packages/student-web/src/lib/project-lines/robotics-stage-films.json').write_text(json.dumps(films,ensure_ascii=False,indent=2)+'\n')
(r/'artifacts/energy-robotics-integration-20261016/robotics-media-provenance.json').write_text(json.dumps({'map':str(mapSource),'rooms':images,'note':'既有项目素材缩放为 WebP；本批新生成室内地图。短片为有声任务简报，不冒充实物操作录像。'},ensure_ascii=False,indent=2)+'\n')
print('WebP assets and eight briefing scripts ready')
