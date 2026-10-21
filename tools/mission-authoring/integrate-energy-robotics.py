"""Node-preserving mission compiler. Source lessons and record scopes are never rewritten."""
from pathlib import Path
import copy,csv,json,hashlib
ROOT=Path(__file__).resolve().parents[2]; IDEA=Path('/Users/xinghan/Dev/systemeduidea')
OUT=ROOT/'packages/student-web/src/lib/project-lines'; AUDIT=ROOT/'artifacts/energy-robotics-integration-20261016'
def read(p):return json.loads(p.read_text())
def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
P={'p':'pvlib-solar-forecast-station','s':'build-a-solar-tracker','w':'design-a-wind-rotor','b':'store-energy-for-later','d':'write-energy-dispatch-rules','e':'build-a-wind-solar-station','r':'run-an-energy-mission','c':'compare-energy-settings','g':'design-a-printed-transmission','j':'build-a-printed-generator','t':'stirling-thermal-controller','a':'aloha-bimanual-apprentice','f':'clean-a-signal','q':'write-a-grasp-rule','h':'design-a-printed-gripper','i':'assemble-a-signal-controller','u':'test-an-unseen-object'}
def refs(spec):
 result=[]
 for token in spec.split():
  alias=token[0];v=token[1:].split('-');ids=range(int(v[0]),int(v[-1])+1)
  result.extend(f'{P[alias]}:M{x:02d}' for x in ids)
 return result
def g(id,station,title,spec,input,output,transfer,path='main'):
 return dict(id=id,station=station,title=title,steps=refs(spec),input=input,output=output,transfer=transfer,path=path)
ENERGY=[
 g('define-service','harvest','用同一个观测站问题开题','p1 p2 p3','一份光、风或供电体验记录','任务口径、器材边界与第一张公开实测功率图','先固定预报对象。公开 I–V 是方法入口，不能填成本人测量；采购前已有可交付数字作品。'),
 g('capture-and-measure','harvest','从追光试验走向可信的电功率','s1 s2 p4 p5 p6 s3 p7 p8 p9','观测站口径、角度对照及负载说明','追光草图与经校准的采集链','角度实验先提出问题，真实 U/I 与扫描峰值重新核验；模拟最优点不能直接当 MPP 实测。'),
 g('print-repeatable-pose','harvest','把角度方案做成能重复定位的支架','p10 p11 p12 p13 p14 p15 s4 s5','打印草图、实际小板尺寸与校准链','本人打印支架和带耗电比较的追光方案','保留两件原课作品；pvlib 使用登记过的固定姿态，追光方案须另计执行器耗电，不能混用姿态记录。'),
 g('wind-evidence','harvest','为第二种能源建立可比较的证据','w1-5','同一观测站的供电需求','本人风轮、对照与卡滞诊断','风轮是供电支路；pvlib 不预测风机。电气输出与机械试验分别记录，装配前核对接口。'),
 g('storage-budget','storage','为风停与遮光准备能量','b1-4','风光实验与负载身份','储能台、续航报告和损耗说明','同一功率不等于相同电量；保留真实电压、时间及测量边界，不用动画亮灯时间冒充续航。'),
 g('dispatch-contract','storage','规定谁先得到有限的电','d1-4','储能与关键负载需求','可执行的调度规则和缺测处理','调度规则消费明确单位和采样时间；失去读数不能当能量为零。先用小课数据测规则边界。'),
 g('assemble-station','integration','让前面的装置和规则协同工作','e1-6','自己的风光、储能及调度作品','本人打印、装配、测试的能源站','原工作台按既有接口接入本人前作；缺失的默认模块要明示。集成通过不能替代采集链校准。'),
 g('record-development','measurement','把同一套装置变成可追查的测点','p16-20','固定姿态、校准链与工程版本','原始开发数据、缺测标记与只读快照','能源站与小板研究各保留设备身份；只有同一测点同一口径的文件才能进入模型。'),
 g('sun-and-service','measurement','把太阳位置连回观测站任务','p21-25 r1 r2','测点位置、姿态与开发数据','太阳几何计算器和事前供电任务','小课的历史预测是演练；正式 pvlib 天气预报另存来源、有效时间及发布前可用性。'),
 g('radiation-model','forecast','算清板面实际接到了什么光','p26-31','太阳几何与天气字段','板面辐照转换器、单位账和边界检查','不能把水平辐照直接当倾斜板输入；保存来源、时间口径与转换版本。'),
 g('temperature-model','forecast','把升温的代价写进模型','p32-35','本人温度记录与板面辐照','带假设范围的温度预测器','未测参数保留假设标签；热机支线不提供太阳能板的温度系数。'),
 g('power-model','forecast','让模型对应自己手里的小板','p36-40','校准、开发数据、辐照与温度模型','冻结开发版本的直流功率模型','公开大组件参数不能套给小板；保留训练/开发时间窗与尚未测定的量。'),
 g('freeze-forecast','forecast','先保存明天的答案，再安排用电','p41-45 r3','冻结模型与发布前可用天气','三方法事前预报与教学调度方案','真实预报包与小课调度演练分开。没有适配程序时只迁移方法，不声称已自动驱动能源站。'),
 g('first-observation','validation','让尚未发生的天气检验预报','p46-50 r4','封存的预报、测点与验收口径','首次真实评价和单独的小课挑战记录','正式扫描与教学结果分开；保留失败、缺测、首次结果和所有分母。'),
 g('retest-with-evidence','validation','只改有依据的一处，再换日期复查','p51-53 r5','首次残差、失败与原始版本','两个日期的复查档案和修订理由','事后回算用于诊断，不覆盖事前成绩；小课挑战的修订不能改写正式预报历史。'),
 g('engineering-handover','handover','让另一位工程师复跑同一份证据','p54-58','装置、环境、模型和两次真实验证','端到端预报站与可复跑工程档案','打印实物、本人测量、预报与证据缺一不算完整工程；不能把索引保存当最终验收。'),
 g('mechanism-comparison','harvest','机构支线 · 先比较转速与功率','c1-4','任一供电发现或独立进入','发电对照报告','可独立完成的方法支线，不锁定太阳能主路径。','mechanism'),
 g('mechanism-fit','harvest','机构支线 · 打印与试配传动','g1-4','对照报告与尺寸约定','可打印传动设计','几何方法可迁移；齿轮文件不自动适配风轮或小板。','mechanism'),
 g('mechanism-delivery','integration','机构支线 · 交付打印发电装置','j1-6','自己的传动设计与发电报告','真实打印装配、测量与故障证据','保留原作业和导入接口；该独立作品不作为光伏校准的前置。','mechanism'),
]
for id,title,start,end,output in [('heat','热机原理与装置识读',1,9,'热机说明书'),('electricity','发电与测量入门',10,19,'可报告功率的发电站'),('sensing','温度、转速与功率联测',20,30,'同步监测台'),('actuation','执行与控制边界',31,38,'可控发电站'),('feedback','闭环反馈与整定',39,52,'PID 控制器与整定日志'),('optimization','寻优与故障保护',53,60,'寻优和保护记录'),('thermal-delivery','完整热机工程验收',61,66,'原热机完整装置、证据和说明书')]:
 ENERGY.append(g('thermal-'+id,'handover','热机支线 · '+title,f't{start}-{end}','原热机课堂规定的前作与器材',output,'这是独立保留的旧热机工程，涉及原课的成品热机、高温与明火要求。不是默认低压打印路线，不作为风光储前置；是否开展按原课程与成人现场条件判断。','thermal'))
ROBOT=[
 g('control-authority','specification','先分清谁在指挥机器人的动作','a1 a2 a3 a4','一次夹爪几何体验','双手任务规格、控制权与字段契约','从同一个托盘与插块任务展开；遥操作、固定回放和学习策略各有独立证据。'),
 g('signal-rule','specification','让动作请求有清楚的条件','f1-4 q1-4','信号身份和动作模式','合成信号处理卡与可检验抓取规则','信号课程留在原路径且仍归脑科学；此处只复用控制方法。双阈值规则不是 EEG 解码或 ACT 策略。'),
 g('offline-interface','specification','先让无动力工位的接口跑通','a5-8','任务字段与控制规则的经验','可复现环境和无动力工位接口','原单舵机程序不能发给 SO-101；在正式字段、单位与采样约定下重新核对。'),
 g('fit-before-build','fabrication','先印小夹爪，验证配合再放大','a9 h1 h2 a10 h3 h4 h5','实际载荷预算与几何草图','本人试配件、单夹爪与真实端点记录','单夹爪是独立实物里程碑；试配方法迁移到四臂，尺寸和舵机标定不能直接复制。'),
 g('print-workcell','fabrication','把试配经验带到四臂工位','a11-18','孔径试配、工作区与载荷预算','四臂打印结构、托盘、相机座和可切断动力的工位','结构自制全部 3D 打印；购买标准电机与简单紧固件。按原课完成供电、身份和干涉核验。'),
 g('connect-small-system','control','从一个可诊断的小系统开始联调','i1-6','自己的信号、规则与打印夹爪','实物信号抓取机与接口诊断证据','消费原工作台支持的前作接口；该旋钮夹爪不是四臂遥操作，也不声称采集人体信号。'),
 g('calibrate-and-limit','control','把四臂的边界变成实际检查','a19-23','四臂工位与小系统接口经验','参考姿态、可达区、限位与响应记录','逐臂重做标定；请求目标不等于实测位置。调试与实际停机遵守原课要求。'),
 g('bimanual-timing','control','让两只执行臂按同一时序协作','a24-28','已标定机构、限位和响应记录','同步双臂遥操作与遮挡检查','左右接口、动作和相机时间须可追查；遥操作成功仍不是自主学习。'),
 g('collect-demonstrations','demonstration','为同一任务采下自己的示范','a29-32','稳定遥操作与冻结任务规格','本人原始回合、失败标签和起点覆盖','保留失败及介入。官方演示或合成样本不能改标成本人采集。'),
 g('freeze-test-design','demonstration','在训练前先约定陌生条件','u1 u2 a33 a34 a35','原始示范与单夹爪挑战问题','整回合数据划分、本地数据包和独立挑战计划','夹爪挑战与双臂测试分别封存；按回合划分，不把相邻帧分到训练与验证两边。'),
 g('learn-a-small-policy','learning','从可手算预测走到一套小策略','a36-46','可追查训练回合与冻结划分','固定回放基线、损失与小策略训练器','训练、验证、测试身份分开；手算与原实验保留，模型误差不能替代实机成功率。'),
 g('see-and-act','learning','让自己的相机参与动作判断','a47-55','小策略与本人双相机样本','视觉特征、注意力核对与视觉动作策略','所有原视觉与梯度节点完整保留；默认特征演示不算本人视觉训练。'),
 g('chunk-the-future','learning','把未来动作接回当前观测','a56-59','视觉策略、时间偏移和原始回合','动作分块、时间集成与可重置调度器','不同预测覆盖同一时刻，先核对权重和时间，再连执行接口。'),
 g('understand-act','learning','理解多种动作走法怎样进入 ACT','a60-66','合法片段、本人特征与小策略','潜变量、KL 账单与真实 batch 的学习步','训练有未来动作，推理没有；原数学与实验逐节保留，不以观看动画免修。'),
 g('freeze-deployment','learning','用本人数据训练并冻结部署包','a67-70','已核验学习步、整回合划分与设备预算','可重载的本人 ACT 部署候选','共享 GPU 可以使用，数据身份、配置、日志与模型版本要属于本次任务。'),
 g('test-small-first','validation','先让陌生物体检验小夹爪','u3-5','封存的独立小夹爪计划','首次实物挑战与修订档案','保留小课自己的首次结果；它训练验收方法，不替代双臂随机条件测试。'),
 g('verify-execution','validation','实机执行前先检查时序和停止','a71-74','固定部署候选、标定和测试计划','整链时序、停机证据与签存验收方案','原课要求的实际掉线与陈旧画面检查保留；离线通过不能声称实机已安全停机。'),
 g('autonomous-evidence','validation','让自主双臂接受全部预定尝试','a75-80','签存计划与固定版本','首次自主证据、失败分母、域外边界和发布工位','全部试次保留；遥操作补救必须记介入，首次失败不被修订覆盖。'),
 g('reproduce-together','handover','把整套任务交给下一位工程师','a81 a82','全部实物、数据、训练和自主验收材料','可复现的双臂任务与本人贡献清单','允许诚实交付未通过状态；演示视频、课堂自检和索引保存不替代最终实物验收。'),
]

def sources(full,short,line):
 trees={}; nodes={};tasks={};dependencies=[]
 for slug in full+short:
  isfull=slug in full; base=IDEA/'projects_data'/slug if isfull else ROOT/f'packages/student-web/public/project-lines/{line}/{slug}/course'
  tree=read(base/'tree/knowledge_tree.json');trees[slug]=tree
  for n in tree['modules']:
   ref=f"{slug}:{n['module_id']}";nodes[ref]=dict(ref=ref,project=slug,module=n['module_id'],title=n['title'],station='',mode='lesson',kind='full' if isfull else 'guided',version=tree.get('version','1.0'),anchor=None,sourceLine=line)
   output=n.get('outputs_produced') or [a['title'] for a in n.get('acceptance_artifacts',[])] or [n.get('output',n['title'])]
   check=n.get('acceptance_standard') or [n.get('output',n['title']),'保留原始记录，说明本人操作和一条尚未验证的限制']
   check=[check] if isinstance(check,str) else check
   resources=[] if isfull else read(base/n['resources'])
   tasks[ref]=dict(id=ref,code='',title=n['title'],station='',role='lesson',category='双臂工程' if isfull else '方法与制作',goal=n.get('core_question',n['title']),actions=n.get('hands_on_components') or [n.get('objective',n['title']),f'完成原节点任务并保存：{output[0]}'],outputs=output,checks=check,minutes=n.get('estimated_minutes'),resources=[dict(url=x['url'],title=x['title'],purpose=x.get('purpose','在原课堂定向阅读'),kind=x['kind']) for x in resources],preparation='按原课堂准备器材与前作；数字练习可先做。实体自制结构用 3D 打印，购买简单标准件，供电、装配和动力检查由成人协助。',note='原课正文、媒体、作业和记录标识保持不变。')
   dependencies.extend(dict(source=f'{slug}:{p}',target=ref) for p in n.get('depends_on',[]))
 return trees,nodes,tasks,dependencies

def compile(line,data,groups,nodes,tasks,deps,trees):
 allrefs=[r for g in groups for r in g['steps']];assert len(allrefs)==len(set(allrefs))==len(nodes),(line,len(allrefs),len(nodes));assert set(allrefs)==set(nodes)
 positions={r:i for i,r in enumerate(allrefs)}
 for e in deps:assert positions[e['source']]<positions[e['target']],e
 for st in data['stations']:
  st['steps']=[ref for g in groups if g['station']==st['id'] and g['path']=='main' for ref in g['steps']]
 newnodes=[];newtasks=[]
 for group in groups:
  for k,ref in enumerate(group['steps']):
   n=nodes[ref];n.update(station=group['station'],group=group['id'],path=group['path'],mode='lesson' if group['path']=='main' else 'support',anchor=None)
   t=tasks[ref];t.update(station=n['station'],role=n['mode'],code=f"{next(s['code'] for s in data['stations'] if s['id']==n['station'])}.{positions[ref]+1:02}",note=group['transfer']);newnodes.append(n);newtasks.append(t)
 data.update(revision='integrated-20261016',modules=newnodes,tasks=data['tasks']+newtasks,groups=groups,sourceDependencies=deps)
 foundation=[]
 for slug,tree in trees.items():
  for f in sorted((IDEA/'projects_data'/slug/'practice/foundations').glob('*.md')):
   uses=[f"{slug}:{n['module_id']}" for n in tree['modules'] if f.stem in n.get('foundation_ids',[])]
   foundation.append(dict(id=f.stem,project=slug,title=f.read_text().splitlines()[0].lstrip('# '),path='practice/foundations/'+f.name,uses=uses,sha256=hashlib.sha256(f.read_bytes()).hexdigest()))
 data['foundations']=foundation
 data['preservation']=dict(classroomNodes=len(nodes),mainNodes=sum(len(s['steps']) for s in data['stations']),micro=len([t for t in data['tasks'] if t['role']=='micro']),sourceTrees={s:len(t['modules']) for s,t in trees.items()},sourceFilesUnchanged=True)
 save(OUT/f'{line}-mission.json',data)
 dest=IDEA/'project_lines'/('energy-motion' if line=='energy' else 'robotics')/'mission-integration-20261016'
 save(dest/'runtime-manifest.json',data)
 with (AUDIT/f'{line}-node-allocation.tsv').open('w',newline='') as f:
  w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['original_ref','original_title','mission_station','mission_group','path','position','record_ref'])
  for n in newnodes:w.writerow([n['ref'],n['title'],n['station'],n['group'],n['path'],positions[n['ref']]+1,n['ref']])
 (dest/'node-allocation.tsv').write_bytes((AUDIT/f'{line}-node-allocation.tsv').read_bytes())
 summary='# '+('未来能源' if line=='energy' else '机器人觉醒')+'：节点整合对照\n\n状态：编排已生成，运行验收见 verification-summary.md。原正文、媒体、作业、历史入口与记录标识保持不变。\n\n'+f"课堂节点 {len(nodes)}，主路径 {data['preservation']['mainNodes']}，任务段 {len(groups)}。原文件指纹和逐节点对应表另存。\n\n"
 for group in groups:summary+=f"## {group['title']}\n\n路径：{group['path']}；站点：{group['station']}。\n\n输入：{group['input']}\n\n交付：{group['output']}\n\n迁移：{group['transfer']}\n\n原节点："+' → '.join(group['steps'])+'\n\n'
 summary=summary.rstrip()+'\n'
 (dest/'integration-review.md').write_text(summary);(AUDIT/f'{line}-review.md').write_text(summary)
 print(line,data['preservation'],'groups',len(groups),'dependencies',len(deps))

old=read(AUDIT/'energy-before.json');data=copy.deepcopy(old)
nodes={n['ref']:copy.deepcopy(n) for n in old['modules']}; tasks={t['id']:copy.deepcopy(t) for t in old['tasks'] if t['role']!='micro'}
full=[P['p'],P['t']];short=list(dict.fromkeys(n['project'] for n in old['modules'] if n['kind']=='guided'))
trees,extra,extratasks,deps=sources(full,short,'energy-motion')
for ref in extra:
 if ref not in nodes:nodes[ref]=extra[ref];tasks[ref]=extratasks[ref];tasks[ref]['category']='热机独立支线'
for n in nodes.values():n['sourceLine']='energy-motion'
data['tasks']=[t for t in old['tasks'] if t['role']=='micro']
for s in data['stations']:
 s.update(message={'harvest':'从同一个供电问题出发，做出风光部件和可信采集链','measurement':'让已建测点留下可信记录，并核对太阳方向','integration':'把自己的风光、储能与调度部件接成能源站'}.get(s['id'],s['message']))
station_context={
 'harvest':('体验发现与同一观测站的供电问题','任务口径、校准采集链、打印支架和风轮证据','真实测量先校准；追光与固定姿态分别登记；风轮另计输出'),
 'storage':('已测试的风光方案与关键负载需求','储能续航报告、调度规则与缺测处理','记录功率、时间与损耗；先保关键任务，实物与模拟分开'),
 'integration':('自己的风光、储能和调度作品及接口表','本人打印装配的能源站、故障诊断与集成测试','本人输入与默认模块明示；系统运行不替代各通道校准'),
 'measurement':('已校准采集链、固定打印姿态与测点身份','可追溯开发数据、太阳几何与历史调度演练','真实测点按时刻、身份与单位对齐；保留空缺及无效原因'),
 'forecast':('开发数据、太阳几何与来源明确的天气字段','带假设的功率模型、三方法事前预报与独立调度方案','先封存模型和预报，再看未来结果；未实际适配不称自动控制'),
 'validation':('封存预报、测点配置及首次验收规则','首次结果、失败记录与第二日期复查档案','实际观测不能用事后天气替代；修订另存不覆盖首次结果'),
 'handover':('实物、数据、预报与独立复查证据','可复跑的阳光预报工程档案','完整保留原课交付；热机是独立支线，不作为主线验收条件')}
for st in data['stations']:
 if st['id'] in station_context:st['input'],st['handoff'],st['gate']=station_context[st['id']]
compile('energy',data,ENERGY,nodes,tasks,deps,trees)
new=read(OUT/'energy-mission.json');after={t['id']:t for t in new['tasks']}
for t in old['tasks']:
 for k in ['id','title','actions','outputs','checks']:assert after[t['id']][k]==t[k],(t['id'],k)
short=[P[k] for k in ['f','q','h','i','u']];trees,nodes,tasks,deps=sources([P['a']],short,'neuro-bionics')
places=[('discovery','抓取初探室','操作一个夹爪，留下一次几何发现','浏览器','开口设计与两次试验','先动手，结果注明为教学模拟'),('specification','任务与接口室','为同一个双手协作问题约定接口','夹爪体验与任务问题','模式字段、信号规则与无动力接口','辨清遥操作、回放和自主；原输入不能跨硬件直接复用'),('fabrication','打印制造室','从试配夹爪走向四臂打印工位','尺寸与载荷预算','打印结构、托盘、相机座和无动力工位','试印、实测、装配；数字图不替代实物'),('control','标定联调室','让两只执行臂在同一工作区协作','已装工位及接口契约','标定、限位与同步遥操作','真实响应、停止能力与相机时序分别核验'),('demonstration','示范数据室','留下可追查、可训练的本人示范','稳定遥操作与任务规格','原始回合、失败标签与封存划分','本人采集与合成演示分开，按整回合划分'),('learning','策略训练室','从手算小策略走到自己的 ACT','训练回合与固定验证规则','训练日志、模型与冻结部署包','全部机制节点保留，不把离线损失当实机成功率'),('validation','自主验证室','按事前规则检验机器人能否自己完成','冻结策略、实机与验收计划','首轮全部试次、失败和能力边界','人工介入必须记录，不能只挑成功演示'),('handover','工程交付室','让另一人重现同一套双臂任务','打印工位、数据、模型与验证证据','可复现任务与本人贡献清单','保留所有失败、原版本和未完成项')]
stations=[dict(id=x[0],code=f'{i+1:02}',place=x[1],message=x[2],input=x[3],handoff=x[4],gate=x[5],dependsOn=[places[i-1][0]] if i else [],steps=[]) for i,x in enumerate(places)]
micro=dict(id='micro:grasp-a-virtual-block',code='01.01',title='让夹爪碰到目标',station='discovery',role='micro',category='3 分钟入口',goal='转动夹指，找到恰好接触的位置。',actions=['改变开口，保存两次不同的几何试验。','说明什么条件改变了、为什么结果不同。'],outputs=['自己的开口设计与两次几何试验'],checks=['留下自己的两次操作记录','能指出这是几何模拟，还没有证明实物抓取'],minutes=3,resources=[],preparation='浏览器即可，无需购买器材。',note='先获得一次发现，随时可以暂停；不冒充实物验收。')
compile('robotics',dict(schema='robotics-mission/1',stations=stations,tasks=[micro],micro=['grasp-a-virtual-block']),ROBOT,nodes,tasks,deps,trees)
