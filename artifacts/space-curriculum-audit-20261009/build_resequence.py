"""Build a review-only allocation of existing lessons; never edit live courses."""
import json,csv,hashlib
from pathlib import Path
ROOT=Path('/Users/xinghan/Dev/systemeduidea')
WEB=Path('/Users/xinghan/Dev/systemedu/packages/student-web/public/project-lines/space-exploration')
AUDIT=Path(__file__).parent
OUT=Path('/private/tmp/space-mission-resequence-20261009');OUT.mkdir(exist_ok=True)
tree=json.loads((AUDIT/'mars-analog-rover-tree.json').read_text())
manifest=json.loads((ROOT/'projects_data/mars-analog-rover/manifest.json').read_text())
old={m['module_id']:m for m in tree['modules']};knodes={n['module_id']:n for n in manifest['knodes']}
source={}
for mid,m in old.items():
 k=knodes[mid];source['mars-analog-rover:'+mid]={'project':'mars-analog-rover','module_id':mid,'title':m['title'],'version':'1.1.1','source_kind':'published-full-course','source_path':'projects_data/mars-analog-rover/'+k['knode_dir'],'source_depends_on':m['depends_on']}
for p in WEB.glob('*/course/tree/knowledge_tree.json'):
 d=json.loads(p.read_text());slug=d['id']
 for m in d['modules']:
  source[slug+':'+m['module_id']]={'project':slug,'module_id':m['module_id'],'title':m['title'],'version':d['version'],'source_kind':'published-guided-course','source_path':f'project_lines/space-exploration/projects/{slug}/course/knodes/{m["module_id"]}','deployed_path':str((p.parent.parent/m['lesson']).relative_to(WEB)),'source_depends_on':m['depends_on'],'estimated_minutes':m.get('estimated_minutes')}
for item in source.values():
 full=item['source_kind']=='published-full-course'
 reference=ROOT/item['source_path'] if full else WEB/item['project']/'course/knodes'/item['module_id']
 repo_root=ROOT if full else WEB.parents[4]
 item['published_reference']={'repository':'systemeduidea' if full else 'systemedu','path':str(reference.relative_to(repo_root)),'sha256':{name:hashlib.sha256((reference/name).read_bytes()).hexdigest() for name in ['lesson.md','assignment.md']}}
 item['authoring_drift_files']=[name for name in ['lesson.md','assignment.md'] if (ROOT/item['source_path']/name).read_bytes()!=(reference/name).read_bytes()]
def O(*ids):return ['mars-analog-rover:'+x for x in ids]
def G(slug,*ids):return [slug+':'+x for x in ids]
def R(a,b):return [f'M{i:02}' for i in range(a,b+1)]
stations=[
 {'id':'T01','title':'启程观测港','mission':'接下一个观察任务，留下第一份证据','output':'任务档案 v0：操作记录、一个观察问题、自己的初始猜测','modules':O('M01'),'micro_choices':['drive-and-frame','spot-a-world','land-a-probe'],'gate':'任选一次体验或展示等价观察证据即可开始；M01 按是否理解人车分工选读。'},
 {'id':'T02','title':'任务设计所','mission':'决定去哪里、观察什么、带什么','output':'任务简报 v1：观察目标、来源与尺度、候选路线、装备预算','modules':G('pick-an-observation-site',*R(1,3))+G('plan-a-payload',*R(1,3)),'gate':'解释取舍和未验证条件；用 M38 的任务字段作简报模板，此时不要求已能进行实地自主任务。'},
 {'id':'T03','title':'结构实验室','mission':'把任务约束变成可检验的车体方案','output':'设计 v1：底盘对照、尺寸约束、信息与电源接口图','modules':G('tune-a-chassis',*R(1,3))+G('assemble-a-rover',*R(1,3)),'gate':'至少一次同条件比较；区分教学参数与真实尺寸。先保留设计问题，不把模拟克数当实物称量。'},
 {'id':'T04','title':'原型制造区','mission':'造出第一辆能动、能停、能测的打印车','output':'车辆 v1：自己修改的 CAD/程序、试配、接线和三个实测','modules':O('M11')+G('write-driving-rules',*R(1,4))+G('assemble-a-rover',*R(4,7))+O('M24','M34')+G('assemble-a-rover','M08'),'gate':'03 原有实物要求完整保留。车能前进、转向、触碰停止，不宣称已具有相机自主导航；数字原型不能替代实物。'},
 {'id':'T05','title':'视觉训练站','mission':'从可追溯的样本训练一个能被检验的模型','output':'数据/模型 v1：来源、标签约定、分组切分、训练程序、误差报告、导出模型','modules':O('M02','M03','M04')+G('label-the-terrain',*R(1,3))+O(*R(5,8),'M10',*R(12,18)),'gate':'先做小样本规则，再扩展真实数据。保留卷积、训练、混淆矩阵与压缩等必要知识；按真实留出结果评价，不承诺必到 80%。'},
 {'id':'T06','title':'自主系统联调区','mission':'把视觉能力装到同一辆车上，完成闭环与受限路线执行','output':'车辆 v2：升级件、部署模型、控制程序、实测延迟、停止策略及联调记录','modules':O('M25','M26','M27','M28','M29','M19','M20','M21','M22','M23','M23b','M30','M31','M32','M33','M35','M36','M36b'),'gate':'硬件升级桥接和目标/路线闭环必须先做实机验证。分类调速不等于路径导航；目标未识别、输入超时及断连时进入可核验的停止策略。'},
 {'id':'T07','title':'远征指挥站','mission':'用新场景考验同一套系统，保留失败再修订','output':'任务 v2：冻结标准、首次日志、改动差异、复测、观测与返航/结束证据','modules':G('run-an-expedition',*R(1,5))+O(*R(37,47)),'gate':'把五节点远征课作为任务外壳，旧大课实测与分析材料嵌入对应步骤；只有一次正式任务流程，失败不被覆盖。人工操作的早期演练不能冒充自主实测。'},
 {'id':'T08','title':'任务交付中心','mission':'让别人根据证据复查这次任务','output':'完整工程档案：CAD/BOM/程序/数据/模型版本、原始日志、研究报告与演示','modules':O('M48','M49','M50','M51','M53','M54','M09','M52'),'gate':'复核任务标准和模型边界；代码与数据可在私有可复跑包中交付。公开分享是自选行动，不再是训练或毕业先决条件。'},
]
real_dependencies=[[],[],['T02'],['T03'],['T02'],['T04','T05'],['T06'],['T07']]
for i,s in enumerate(stations):
 s['recommended_after']=[] if i==0 else [stations[i-1]['id']]
 s['depends_on']=real_dependencies[i]
 s['status']='design-only'
# Every source lesson receives exactly one primary home; references elsewhere are not new requirements.
allocated=[x for s in stations for x in s['modules']]
assert len(allocated)==85 and len(set(allocated))==85 and set(allocated)==set(source)
for s in stations:
 s['source_node_count']=len(s['modules'])
 s['lesson_blocks_note']='来源节点数不是新课时数；合并验收/补学/选修另见 allocation。'
alloc=[]
for s in stations:
 for ref in s['modules']:
  m=source[ref];mid=m['module_id'];full=m['project']=='mars-analog-rover'
  action='reuse-with-context';note='保留正文与富媒体，换为当前任务简报、上一步作品和下一步交付；保留原记录标识。'
  if full and mid=='M01':action='conditional-orientation';note='与开场简报合并；能解释人车分工和任务目标时选读，不用再次写一份从零入门总结。'
  elif full and mid=='M11':action='move-foundation-earlier';note='提前到首次代码操作前；区分云端 Python 与 Pico MicroPython 的运行位置，不能直接照搬安装方式。'
  elif full and mid=='M24':action='replace-hardware-procedure';note='知识与机械检查保留，采购铝合金 4WD 装配流程用已有打印车 M06/M08 替代；整车实测是认定依据。'
  elif full and mid in ['M09','M52']:action='optional-publication';note='公开发布移到交付之后，不阻塞本地训练、数据复现或毕业；保留版本、来源和许可要求。'
  elif full and mid in ['M27','M31']:action='optional-geolocation-extension';note='GPS/经纬度日志与绘图可扩展；默认小场地以本地测量/检查点记录，不把 GPS 当精确到点的保证；旧完整课程原要求不被偷偷改写。'
  elif full and mid in ['M10','M23','M23b','M36b','M48','M54']:action='embed-existing-checkpoint';note='用已有阶段作品做当前任务站验收；材料保留供回看，不重复交同一份总结。M54 个人信可选，工程证据不可选。'
  elif full and mid in ['M25','M26','M28','M29','M30','M32','M33','M34','M35','M36']:action='reuse-with-hardware-or-control-adapter';note='保留原理/动画/游戏；修改实际设备、控制接口、任务语境和测试要求，先验证升级打印车方案。'
  elif full and mid in ['M02','M03','M04','M05','M06','M07','M08','M15','M20','M21','M22']:action='retain-required-delta';note='不能凭短项目提交免修。核对真实数据来源、标签体系、规模、分割与部署环境；修订已识别的准确率/置信度和跨视角表述。'
  elif full and mid in R(37,47):action='merge-into-expedition';note='嵌入 run-an-expedition 的计划/现场/尝试/复盘/交付步骤，增加自主系统与完整遥测要求；不另外再开一轮同名远征。'
  if m['project']=='run-an-expedition':action='expedition-task-shell';note='保留五个课程节点和表单作为主任务外壳，扩展到车辆 v2；需新版交付要求，2.0 的人工操作记录仍按原含义保存。'
  alloc.append({'ref':ref,'station':s['id'],**m,'action':action,'review_note':note})
bridges=[
 {'id':'B-HARDWARE','at':'T06','status':'required-not-implemented','goal':'在已有打印车上升级 Raspberry Pi/相机，保留 Pico 驱动与触碰停止','needs':['安装件 CAD 与载荷/重心/供电核对','Pi↔Pico 命令与确认、超时、断连处理','成人协助样机验证；不能假定旧双轮车可直接搭载所有新硬件'],'acceptance':'同一辆车升级前后版本可追溯；架空单测与低速停止/失联测试记录齐全。','sizing':'需独立细化节点与试制，不能声称仅改一句接线说明即可完成。'},
 {'id':'B-LABELS','at':'T05,T06','status':'required-adaptation','goal':'区分两类近邻练习、五类轨道影像训练、地面相机域外测试','needs':['保留 source_id、image_id、split、label_schema 与视角','同源图块按来源分组划分数据，测试集不参与调参','地面标签不能按名称强行等同轨道地貌；重新声明可观察的类别和无对应情况'],'acceptance':'提交类别对应与不对应清单，保存目标相机采集条件及真实失败，不能把 sand→dune 当自动转换。'},
 {'id':'B-NAVIGATION','at':'T06','status':'critical-gap-not-implemented','goal':'完成预先声明场地内的路线执行、到点判定、超时和停止闭环','needs':['明确位置/路线/目标的可观测信号与误差','先用有限路径或标记点验证动作和到点检测，再与视觉限速层组合','若终点要求未知场地自由导航，需另铺定位、建图、规划知识链，当前资源不足'],'acceptance':'新路线实测能区分调速正确、路线执行正确、到点确认及被安全中止；禁止把分类器准确率当任务通过。','sizing':'这是实质内容缺口，纯重排无法补齐，当前不承诺固定新增节数。'},
 {'id':'B-EVIDENCE','at':'all','status':'platform-adaptation-not-implemented','goal':'一个任务档案串起现有作品，显式检查版本与接口','needs':['source_project/module/content_version/submission_id/hash 指向原记录','payload kg、模拟能量点、真实 g/Wh 分开；不能直接照抄成实物约束','失效只标记下游需复测，保留旧快照；访客作品经本人确认关联账号'],'acceptance':'作品能实际载入、显示来源和兼容检查；只读文件夹汇总不算接口已接通。'},
]
plan={'schema_version':'mission-resequence/0.1','status':'review-draft-not-live','date':'2026-10-09','line_id':'space-exploration','mission_title':'火星地形观察远征','mission':'设计、3D 打印并逐步升级同一辆探测车，在预先声明的地面类比场地完成观测任务，留下能复核的代码、数据和实测证据。','endpoint_boundary':'课堂地面类比任务；NASA 轨道数据训练不代表真实火星车导航实现，也不保证迁移到地面相机。','strategy':'任务站引用已有课程节点，不复制课程、不重置已有进度；有证据才缩短重复教学。','source_counts':{'full_tree_nodes':len(old),'published_declared_count':54,'guided_nodes':29,'micro_entries':3,'lightkurve_nodes_local_only':32,'guided_nominal_minutes':715,'legacy_nominal_hours':140,'timing_status':'既有设计估计，不是重排后真实用时；不相加承诺或捏造节省比例。'},'stations':stations,'allocation':alloc,'bridges':bridges,'side_quests':[{'project':'lightkurve-transit-detective','placement':'独立行星发现科研支线','production_status':'public-summary-and-tree-returned-404','relationship':'不是造车/自主驾驶前置，也不计入火星远征必修完成率；发布可用后再开放。'},{'project':'land-a-probe','placement':'启程站可选飞行体验','relationship':'着陆操作不是造车先决条件，不伪造制作依赖。'}],'progress_policy':{'legacy_records':'全部保留 project/module/activity/content_version；任务新 ID 只添加引用。','not_auto_credit':'已浏览/已提交/旧节点完成不自动认定新能力。','recognition':'兼容的已评阅作品可复用；未评阅保存展示为待复核；新增任务条件需补测。','source_dependencies':'原知识树的硬边保持原课兼容；新编排用单独语义依赖图与明确替代依据，不直接删除原边。'},'rollout':['审核本设计、最终任务边界及必要桥接','实现独立 mission-curriculum 配置、只读路由/原记录引用和作品档案','改交接句、核对关键科学表述与硬件适配；运行跨课程验收','桥接硬件和导航经试制/课堂验证后再启用完整任务通过判定','先本地验收再按新的用户部署授权上线'],'references':[{'title':'On Calibration of Modern Neural Networks','url':'https://proceedings.mlr.press/v70/guo17a.html'},{'title':'JPL Perseverance AutoNav 首次驾驶回放','url':'https://www.jpl.nasa.gov/images/pia24723-computer-simulation-of-perseverances-first-autonav-drive/'},{'title':'JPL Mars 2020 Mobility','url':'https://robotics.jpl.nasa.gov/what-we-do/flight-projects/mars-2020-rover/m2020mobility/'},{'title':'HiRISE 仪器规格','url':'https://www.uahirise.org/specs/'}]}
plan['expedition_merge']=[
 {'step':'计划与判据','shell':'run-an-expedition:M01','references':O('M38'),'reuse':'读取 T02 简报并冻结最终标准，不重新编一份无关任务。'},
 {'step':'资源与场地','shell':'run-an-expedition:M02,M03','references':O('M37','M46'),'reuse':'读取实物车版本，标定场地；电量/距离改为实测单位，示意点数不作验收。'},
 {'step':'第一次尝试与修订','shell':'run-an-expedition:M04','references':O('M39','M40','M41'),'reuse':'同一版本执行、记录失败、提出修改，再测；保留全部尝试。'},
 {'step':'正式任务与分析','shell':'run-an-expedition:M04,M05','references':O('M42','M43','M44','M45','M47'),'reuse':'使用新版自主任务要求；复用旧课混淆矩阵、速度关系、结论边界等分析材料。'},
 {'step':'交付证据','shell':'run-an-expedition:M05','references':O('M48'),'reuse':'M48 在 T08 只有一个主归属；这里移交已积累档案，不重复提交。'},
]
plan['presentation']={
 'classroom':'沿用既有统一课堂；任务上下文覆盖在原课程节点外，不新增动画/游戏/幻灯片分类 tabs。',
 'map':'复用八个地图位置和美术，重新绑定任务站；推荐先后与作品依赖分别展示。',
 'campaign_acts':[
  {'act':1,'label':'接受任务','stations':['T01']},
  {'act':2,'label':'设计方案','stations':['T02','T03']},
  {'act':3,'label':'制造原型','stations':['T04']},
  {'act':4,'label':'获得自主能力','stations':['T05','T06']},
  {'act':5,'label':'执行并交付远征','stations':['T07','T08']},
 ],
 'difficulty':'幕次/地点表示任务进程，不冒充项目难度；节点保留真实学习层级。',
 'films':'先核对既有配音与分镜。实物、远征段落可重绑定；原终章的工程/天文二选一含义需局部改稿及配音，不能靠字幕覆盖相反旁白。此批未修改或生成影片。',
}
(OUT/'curriculum-map.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
with (OUT/'node-allocation.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['source_ref','source_version','title','station','action','reason'])
 for a in alloc:w.writerow([a['ref'],a['version'],a['title'],a['station'],a['action'],a['review_note']])
print(json.dumps({'source_nodes':len(alloc),'stations':[(s['id'],s['source_node_count']) for s in stations],'output':str(OUT)},ensure_ascii=False))
