"""Extract task orders from existing courses; no lesson or media regeneration."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[2]
lib=root/'packages/student-web/src/lib/project-lines'
public=root/'packages/student-web/public/project-lines/space-exploration'
c=json.loads((lib/'space-curriculum.json').read_text())
old=json.loads((root/'artifacts/space-curriculum-audit-20261009/mars-analog-rover-tree.json').read_text())['modules']
full={m['module_id']:m for m in old}
prep={
 'first-contact':'浏览器即可；鼠标、触控板或触屏。',
 'mission-design':'浏览器、观察问题与任务笔记。预算是教学模型，暂不需要采购。',
 'mechanics':'浏览器与设计记录；真实尺寸需后续测量。',
 'build':'数字部分用浏览器；实物阶段需 3D 打印、低压电机/控制器等标准件与成人协助。按原课 BOM 准备。',
 'perception':'电脑浏览器、可追溯图像与训练环境。可以在等待打印时先进行。',
 'autonomy':'已有打印车、模型、相机与控制器。升级接线及路线闭环尚待样机验证，先核对原课与当前车型差异。',
 'expedition':'同一辆实物车、软边界场地、记录工具及成人协助；手动演练与自主实测分别标注。',
 'delivery':'之前的设计、代码、数据、照片和实测记录。引用原始文件，不补造结果。',
}
# Known legacy assumptions are corrected in the task order, without rewriting source lessons.
overrides={
 'M24':{'title':'对照旧底盘，确认自己的打印制造方案','actions':['阅读旧底盘的连接与检查思路','回到打印试配任务，使用自己的 CAD 和当前器件实测尺寸'],'outputs':['打印制造方案与旧车型差异说明']},
 'M34':{'title':'检查固定与防护边界','actions':['检查电池、控制器与线缆的固定','记录暴露部件与停止条件；不进行未验证的跌落或浸水试验'],'outputs':['固定与防护检查记录']},
 'M15':{'title':'训练模型，记录真实的留出集表现','outputs':['训练程序、模型版本与真实测试结果']},
 'M28':{'title':'把遥测写进可复查的日志','actions':['记录时间、传感器读数与来源','未安装 GPS 时记录本地检查点，明确坐标含义，不伪造经纬度'],'outputs':['字段含义清楚的遥测 CSV']},
 'M25':{'actions':['理解电机、驱动与控制器的连接关系','对照已有 Pico 打印车核对升级架构；Pi 直驱旧例程不能直接照抄接线'],'outputs':['当前车型的接口与供电检查表']},
 'M36b':{'title':'复查同一辆车的整车联调档案','actions':['对照旧整车案例，列出自己的打印车已经接入的部件与接口；GPS 属于选修，不是必装件','复查自己的供电、通讯、感知、执行与停止记录；没有验证的项目明确标为待测','把联调证据汇入当前主线任务，不再制造第二辆车，也不把手动演练称为自主通过'],'outputs':['当前打印车的整车联调清单、证据引用与待验证项']},
}
tasks=[]
micros=[('spot-a-world','拍下第一张星球照片','移动镜头、拉近目标，再自己按下快门。','自己取景的照片与一条观察'),('land-a-probe','让探测器稳稳落下','观察高度与速度，调节推力，回看自己的着陆。','一次着陆回放与操作记录'),('drive-and-frame','驶向第一个观察点','驾驶探测车到观察区，停下并选择取景。','自己的路线与地形照片')]
for i,(pid,title,goal,out) in enumerate(micros):
 tasks.append(dict(id='micro:'+pid,code=f'T01-{i+1:02}',title=title,station='first-contact',role='micro',category='观察体验',goal=goal,actions=[goal,'留下自己的观察，带着问题继续。'],outputs=[out],checks=[out,'能区分亲眼观察与自己的猜测'],minutes=3,resources=[],preparation=prep['first-contact'],note='三个体验任选一个即可出发，不必全部做完。'))
for node in c['modules']:
 station=next(s for s in c['stations'] if s['id']==node['station']);is_full=node['kind']=='full'
 if is_full:
  source=full[node['module']];goal=source.get('core_question') or source['summary'];actions=source.get('hands_on_components',[])[:4];outputs=[a['title'] for a in source.get('acceptance_artifacts',[])][:4];minutes=source.get('duration_minutes');resources=[]
 else:
  course=public/node['project']/'course';tree=json.loads((course/'tree/knowledge_tree.json').read_text());source=next(n for n in tree['modules'] if n['module_id']==node['module']);goal=source['objective'];outputs=[source['output']];minutes=source['estimated_minutes'];lesson=(course/source['assignment']).read_text()
  # Several assignments are a short paragraph, not a numbered list. Never expose
  # the curriculum's internal action enum (e.g. reuse-with-context) to learners.
  actions=[re.sub(r'[*`]', '',m) for m in re.findall(r'^\d+\.\s+(.+)',lesson,re.M)][:4]
  if not actions: actions=[p.strip() for p in lesson.split('自检：')[0].split('\n\n') if p.strip() and not p.strip().startswith('#')][:4]
  resources=[{k:r[k] for k in ['kind','title','url','purpose']} for r in json.loads((course/source['resources']).read_text())]
 role=node['mode']; code=station['code']+'-'+(f"{station['steps'].index(node['ref'])+1:02}" if role=='lesson' else 'R'+node['module'][1:]);title=node['title']
 override=overrides.get(node['module'],{}) if is_full else {};title=override.get('title',title);actions=override.get('actions',actions);outputs=override.get('outputs',outputs)
 cat={'mission-design':'任务设计','mechanics':'结构设计','build':'制作编程','perception':'数据训练','autonomy':'系统联调','expedition':'现场验证','delivery':'成果交付','first-contact':'调查阅读'}[node['station']]
 checks=outputs[:3]+['记录自己的操作或判断依据','说明未验证条件，或下一步需要检查什么']
 tasks.append(dict(id=node['ref'],code=code,title=title,station=node['station'],role=role,category=cat,goal=goal,actions=actions or ['在原课堂完成操作，并记录自己的判断依据。'],outputs=outputs or [station['handoff']],checks=checks,minutes=minutes,resources=resources,preparation=prep[node['station']],note=node['note']))
assert len(tasks)==88 and len({t['id'] for t in tasks})==88
(lib/'space-mission-tasks.json').write_text(json.dumps(tasks,ensure_ascii=False,indent=2)+'\n')
print('88 task orders; 62 main steps; original lessons unchanged')
