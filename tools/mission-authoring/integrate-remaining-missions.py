"""Reorder existing lessons only. Stable source IDs and source files are immutable."""
from pathlib import Path
import json,csv,hashlib,os
ROOT=Path(__file__).resolve().parents[2]; IDEA=Path(os.environ.get('SYSTEMEDU_IDEA_ROOT',str(Path.home()/'Dev/systemeduidea')))
OUT=ROOT/'packages/student-web/src/lib/project-lines'; AUDIT=ROOT/'artifacts/remaining-missions-20261018'
read=lambda p:json.loads(p.read_text())
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
FULL=['purpleair-airquality-node','satellite-archaeology','ai-ant-ethologist','eeg-minecraft-bci','emg-prosthetic-hand']
GUIDED={'read-an-air-day':'earth-discovery','make-an-observation-map':'earth-discovery','assemble-a-field-notebook':'earth-discovery','label-the-terrain':'space-exploration','check-a-prediction':'biomedicine','clean-a-signal':'neuro-bionics'}
ALIASES=dict(p=FULL[0],s=FULL[1],a=FULL[2],e=FULL[3],m=FULL[4],r='read-an-air-day',o='make-an-observation-map',f='assemble-a-field-notebook',l='label-the-terrain',c='check-a-prediction',n='clean-a-signal')
TREES={slug:read((IDEA/'projects_data'/slug if slug in FULL else ROOT/f'packages/student-web/public/project-lines/{GUIDED[slug]}/{slug}/course')/'tree/knowledge_tree.json') for slug in FULL+list(GUIDED)}
def refs(spec):
 out=[]
 for token in spec.split():
  slug=ALIASES[token[0]];parts=token[1:].split('-');ids=[m['module_id'] for m in TREES[slug]['modules']];names=['M'+p.zfill(2) if p.isdigit() else 'M'+p for p in parts]
  if len(names)==1:assert names[0] in ids;out.append(slug+':'+names[0])
  else:out += [slug+':'+x for x in ids[ids.index(names[0]):ids.index(names[1])+1]]
 return out

def g(id,station,title,spec,input,output,transfer,path='main'):
 return dict(id=id,station=station,title=title,steps=refs(spec),input=input,output=output,transfer=transfer,path=path)
E=[
 g('ask-one-place','question','为同一个地方提出可回答的问题','p1-3 r1-2','一次影像或轨迹观察','地点问题、数据身份与缺测标记','公开或合成数据先练习方法；不能写成本人传感器实测。'),
 g('define-location','question','把观测问题放在可重建的位置','o1-2 p4-6','地点问题与单位说明','坐标约定、记录身份和手算 AQI','场地米坐标与真实经纬度分开。取得器材前可保留教学作品，不填成实际采样。'),
 g('wire-first-sample','fieldwork','让自己的传感器留下原始行','p7-15','地点、采样对象与准备清单','可追查的传感器原始数据链','按原课器材和实际单位核对；成人负责供电与焊接，不把平台曲线当本机数据。'),
 g('place-the-node','fieldwork','把测点和结构一同登记','o3 p16-17b','原始采集链与后续点位问题','本人观测节点、选址和设备身份','自制安装结构走 3D 打印；旧课通用盒体不等于已经提供打印文件。通风、防水与安装需实测；不靠主动制造烟雾验证。'),
 g('preserve-the-raw','quality','先在同一组数据上看处理代价','r3-4 p18-23','带时间和单位的原始数据','空气观察报告、计数解释与 NowCast 演算','小课向前平均不是 NowCast；保留各自算法、原始值与缺测，不能直接替换真实管线。'),
 g('verify-correction','quality','让校正保留依据和适用范围','p24-28b','湿度、颗粒物与时间记录','可复查的原始—校正—AQI 数据管线','原公式版本与传感器适用范围须核对，不把误差变小称为官方认证。'),
 g('connect-with-identity','network','让网络数据和自己的节点对上身份','p29-36b','已校验的采集与处理版本','长期采集、公开对照来源及缺测档案','第三方平台接入资格先核实；自制节点不保证可注册 PurpleAir。无法接入时保留原节点和本地成果，明确该项未完成。'),
 g('join-evidence','network','先在调查档案里抓住接口故障','o4 f1-3','本人空气与地图小课作品','固定作品索引、故障和复测','小课实际支持的参数与点位接口可导入；真实 CSV 需另按字段适配，不声称已自动互通。'),
 g('test-unseen-days','validation','用没调过的日期追问传感器','p37-43','按时刻配对的数据和冻结规则','误差图、留出检验与单独修订版','相近地点不一定同一空气环境。报告配对条件；留出集不用于挑选校正参数。'),
 g('explain-with-sources','explanation','把每个结论接回证据','f4 p44-47b f5','首轮检验与失败记录','验证报告、调查档案与数据集说明','小课合成场地与真实地点分别归档；保存证据路径、未知项，不用地图连线宣称因果。'),
 g('handover-observatory','handover','让另一个人复跑同一座观测站','p48-52','完整版本、原始数据与验证报告','可复跑观测站及自己的环境公报','发布和位置公开由本人及监护人另行决定；记录未接入项，不把索引保存当公开成功。')]
C=[
 g('define-image-question','question','先定义这个影像助手能回答什么','s1-11','自己的影像观察卡','研究区域、目标信号与来源约定','沿用原课坐标、分辨率、区域背景与外联草稿，不把识别候选称为发现遗址。'),
 g('prepare-spectral-input','acquisition','让每个输入像素都有可解释的来历','s12-21b','固定区域与来源图像','多波段预处理管线','完整保留波段、比值、掩膜和归一化节点；原图、参数与版本要能复跑。'),
 g('label-with-a-contract','annotation','用小样本练习怎样做可靠标签','l1-2 s22-25','预处理影像和分类目标','标注约定与可追查图块集','地形样本用于练标注方法，不能直接变成遗址训练集；重新核对对象、标签和图像 ID。'),
 g('freeze-geographic-split','annotation','先固定没见过的地块再看成绩','l3 s26-27b','标注版本与空间身份','地理防泄漏数据划分','保留原地理切分课程与检验；短课测试通过不能免除目标领域的独立测试。'),
 g('start-with-baselines','baseline','先做能被检查的简单预测','c1-2 s28-29','冻结的数据用途与两个模型','同集基线对比和复跑配置','分子预测只迁移分组和基线方法；数值标签不混进卫星影像，保留两个实验的原记录。'),
 g('inspect-errors','baseline','让平均分暴露具体失败','c3-4','同集预测记录','带样本 ID 的错误检查报告','方法练习不是卫星模型验收；下一站在真实目标数据上重做检查。'),
 g('learn-spatial-models','model','从卷积走到逐像素分割','s30-37','基线、目标标签与划分','CNN 与 U-Net 的可运行模型','原卷积、边缘、特征和掩膜节点全部保留；平台提供预训练权重须明示。'),
 g('calibrate-evidence','evaluation','让模型说清自己有多不确定','s38-41b','冻结模型和未用于训练的数据','混淆统计、校准与错例档案','保留假阳、假阴与分母；高分不是发现证明，不用测试集反复挑最佳版本。'),
 g('review-candidates','handover','把机器建议交给证据和专家复核','s42-50b','模型版本、扫描范围和披露规则','候选证据、排除理由及独立修订版','原节点与审核步骤全部保留；候选只代表待核查信号。外联和敏感位置披露需本人明确决定。'),
 g('reproduce-image-ai','handover','交付可复现的影像研究助手','s51-56','原始版本、审核与局限','脱敏展示、复跑包与学习反思','保留原隐私和披露要求；不因提交作品自动向外发消息、发布坐标或宣称科研发现。')]
B=[
 g('identify-signal','signal','先辨清脑电、意图和动作','e1-6 n1','一次合成信号开门体验','公开脑电观察卡与信号身份','合成阈值信号不是脑电；脑电分类不是读心，肌电在独立路径学习。'),
 g('read-rhythm','signal','给波形建立时间与频率的尺度','e7-09b','公开数据与事件标记','频谱、频段和运动想象记录','保留原频率与 ERD 节点；不把示例差异视为每个人都具备的控制能力。'),
 g('record-own-signal','recording','在合适设备下记录自己的信号','e10-12','记录方案、设备配置和成人协助','本人原始脑电与条件标记','只按原课无创设备要求开展；设备型号和电极配置先核对。允许先做公开数据，不能算本人采集。'),
 g('test-cleaning-cost','cleaning','先看平滑换来了什么、丢掉了什么','n2-3 e13-18','原始脑电与合成信号对照','窗口代价和去伪迹证据','小课滑动平均不能代替 EEG 带通或 ICA；每次处理保留原图和假设。'),
 g('freeze-cleaning','cleaning','把信号处理封成可复查的版本','n4 e19','各步处理与质量对照','信号处理卡和原 EEG 清洁管线','保留两个作品的独立参数与原始记录；不能仅凭曲线平滑判定有效脑电。'),
 g('build-csp-foundation','decoding','让每一步数学对应一项真实信号变化','e21-30','清洁信号与固定类别','方差、协方差、投影与 CSP 证据','原数学与交互节点逐个保留；颜色图不代替方向、方差和数据身份检查。'),
 g('compare-decoders','decoding','让没见过的数据检验分类器','e31-38b','CSP 特征与冻结划分','离线训练包和各方法比较','按原划分报告结果；他人公开数据成绩不能直接换成本人实时控制能力。'),
 g('calibrate-personal','calibration','用自己的记录检验泛化和漂移','e39-51','离线流程、本人录制与试验计划','个人校准、留出检验和时延档案','保留全部失败和版本。原课 70% 是目标，不能保证达到；不把训练成绩当独立检验。'),
 g('connect-one-action','control','让一个可靠判定进入可停止的游戏','e52-60','冻结个人解码器和停止方案','可停止闭环动作及解谜关卡证据','游戏动作成功不证明医疗效果；记录人工帮助、误触发、校准和全部尝试。'),
 g('handover-decoder','handover','交付作品，也说明它的能力边界','e61-64','原始信号、模型与真实试次','尊重隐私的脑机项目分享包','共享信号、代码和演示由本人及监护人决定；可以交付未达标档案，不夸大为读心。')]
ANT_NOTE='原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。'
SAT_NOTE='独立卫星研究路径，使用原课程数据、坐标与披露规则；空气节点和蚁群结果不能直接作为遗址证据。原课全部节点及记录保留。'
EMG_NOTE='独立肌电机械手路径；EMG 不等同 EEG。保留原肌电采集、3D 打印结构和真实力反馈要求，先核对器材与成人支持。原纸板传动示意作为历史内容保留，新自制结构使用 3D 打印，不宣称已补齐新打印文件。'
def branch(slug,alias,path,station,note):
 groups=[]
 for stage in TREES[slug]['stages']:
  mods=[n for n in TREES[slug]['modules'] if n.get('stage_id')==stage['stage_id']]
  if not mods:mods=[n for n in TREES[slug]['modules'] if n.get('stage')==stage['stage_id']]
  assert mods,(slug,stage)
  groups.append(dict(id=path+'-'+stage['stage_id'].lower(),station=station,title=stage['title'],steps=[slug+':'+n['module_id'] for n in mods],input='原课本阶段前作、器材与数据条件',output=stage.get('stage_output',stage['title']),transfer=note,path=path))
 return groups
E+=branch(FULL[1],'s','satellite','handover',SAT_NOTE)+branch(FULL[2],'a','ant','handover',ANT_NOTE)
C+=branch(FULL[2],'a','agent','handover',ANT_NOTE)
B+=branch(FULL[4],'m','emg','handover',EMG_NOTE)
CONFIG={
'earth':dict(line='earth-discovery',title='地球脉动',sourceLine='earth-discovery',groups=E,micro=['spot-a-landscape-change','follow-an-ant'],stations=[('discovery','观察初探室','先留下可以追问的一次观察'),('question','调查设计室','把同一个观测站问题和位置说清楚'),('fieldwork','传感器工坊','建立自己的采集链和测点身份'),('quality','数据质量室','检查缺测、处理代价和校正依据'),('network','观测网络室','连接来源、时区、单位和位置'),('validation','独立对照室','用未用于调参的数据检查误差'),('explanation','证据分析室','让结论可以返回原始记录'),('handover','研究交付室','交付能复查的观测站和环境公报')],preparation='先用浏览器完成观察与合成数据练习；真实空气节点需成人协助准备低压传感器和安装条件，长周期采集另计。'),
'computing':dict(line='computing-ai',title='智能造物',sourceLine='earth-discovery',groups=C,micro=['spot-a-landscape-change'],stations=[('discovery','影像观察室','先问图片里什么变化值得检查'),('question','问题定义室','固定区域、对象与模型边界'),('acquisition','数据准备室','建立可复跑的影像预处理'),('annotation','标注与划分室','让样本身份和测试地块先固定'),('baseline','基线实验室','用简单方法发现能被解释的错误'),('model','视觉模型室','从卷积走向自己的分割模型'),('evaluation','独立评测室','保留误差、校准与未知边界'),('handover','研究发布室','交付可复现、可复核的影像 AI')],preparation='浏览器练习可直接开始；完整影像研究按原课准备电脑、数据和家长管理的服务账号。数字研究不要求购买机械装置。'),
'brain':dict(line='neuro-bionics',title='大脑解码',sourceLine='neuro-bionics',groups=B,micro=['open-a-signal-gate'],stations=[('discovery','信号初探室','先让一段模拟信号触发动作'),('signal','信号识别室','分清观测、意图、频率与动作'),('recording','无创记录室','记录本人数据和实际采集条件'),('cleaning','信号质量室','处理伪迹，同时保留信息损失'),('decoding','解码研究室','让数学、特征和分类有对应证据'),('calibration','个人校准室','面对新试次、时延和漂移'),('control','闭环验证室','把解码接进可停止的一次动作'),('handover','证据交付室','交付可复跑的个人控制档案')],preparation='先用合成和公开数据，无需立即购买头戴设备。本人 EEG/EMG 使用原课指定无创设备与成人协助；目标成绩不保证达到。')}
MICRO={'spot-a-landscape-change':('找出地表的变化','拖动两期影像的分界线，标记两处变化或未知。','自己的影像观察卡','这是公开影像观察，不是遗址确认或因果证明。'), 'follow-an-ant':('跟上那只蚂蚁','选时刻标记位置，遮挡时保留未知，再回放自己的轨迹。','自己的轨迹与未知记录','使用平台模拟，不采集或干预活体。'),'open-a-signal-gate':('用信号打开一扇门','先运行，再改一个阈值，比较误开与迟开的区别。','两次阈值试验和解释','这是合成信号阈值体验，不是实际脑电控制。')}
def compile(id,c):
 groups=c['groups'];allrefs=[x for g in groups for x in g['steps']];slugs=list(dict.fromkeys(x.split(':')[0] for x in allrefs));expected=[slug+':'+n['module_id'] for slug in slugs for n in TREES[slug]['modules']]
 assert len(allrefs)==len(set(allrefs)) and set(allrefs)==set(expected),(id,'coverage')
 pos={x:i for i,x in enumerate(allrefs)};nodes=[];tasks=[];deps=[];stations=[]
 for i,(sid,title,message) in enumerate(c['stations']):
  gs=[g for g in groups if g['station']==sid and g['path']=='main'];steps=[x for g in gs for x in g['steps']]
  stations.append(dict(id=sid,code=f'{i+1:02}',place=title,message=message,input=gs[0]['input'] if gs else '浏览器与自己的问题',handoff=gs[-1]['output'] if gs else '一份本人观察记录',gate='核对来源、版本与尚未验证的部分；完整要求见原课堂。',dependsOn=[c['stations'][i-1][0]] if i else [],steps=steps))
 for i,mid in enumerate(c['micro']):
  title,action,output,note=MICRO[mid];tasks.append(dict(id='micro:'+mid,code=f'01.{i+1:02}',title=title,station='discovery',role='micro',category='3 分钟入口',goal=action,actions=[action],outputs=[output],checks=['保留自己的观察或操作记录','能说明一处未知或模型边界'],minutes=3,resources=[],preparation='浏览器即可开始。',note=note))
 for group in groups:
  for ref in group['steps']:
   slug,mid=ref.split(':');n=next(n for n in TREES[slug]['modules'] if n['module_id']==mid);full=slug in FULL;sourceLine=GUIDED.get(slug,c['sourceLine']);mode='lesson' if group['path']=='main' else 'support'
   nodes.append(dict(ref=ref,project=slug,module=mid,title=n['title'],station=group['station'],mode=mode,kind='full' if full else 'guided',version=TREES[slug].get('version','1.0'),anchor=None,sourceLine=sourceLine,group=group['id'],path=group['path']))
   out=n.get('outputs_produced') or [n.get('output',n['title'])];checks=n.get('acceptance_standard') or ['完成原节点作业与交付要求','保留本人证据和一处尚未验证的限制'];checks=[checks] if isinstance(checks,str) else checks
   resources=[] if full else read(ROOT/f'packages/student-web/public/project-lines/{sourceLine}/{slug}/course'/n['resources'])
   tasks.append(dict(id=ref,code=f"{next(s['code'] for s in stations if s['id']==group['station'])}.{pos[ref]+1:02}",title=n['title'],station=group['station'],role=mode,category='原课研究' if full else '方法练习',goal=n.get('core_question',n['title']),actions=n.get('hands_on_components') or [n.get('objective',n['title']),'按原课堂保存自己的结果及证据'],outputs=out,checks=checks,minutes=n.get('estimated_minutes'),resources=[dict(url=x['url'],title=x['title'],purpose=x.get('purpose','在原课堂定向阅读'),kind=x['kind']) for x in resources],preparation=({'satellite':'按原卫星课准备电脑、影像来源与服务账号；无需空气传感器。','ant':'独立 RFID 蚁群路径，需专业支持复核活体操作及原课设备条件；不作为家庭默认入口。','agent':'此助手使用原 RFID 蚁群数据链；前段设备及活体研究条件需专业支持，不能跳过。','emg':'使用原课无创肌电设备、电机与 3D 打印结构；不要求 EEG 头戴设备，成人协助核对供电与装配。'}.get(group['path'],c['preparation'])),note=group['transfer']))
   for pre in n.get('depends_on',[]):deps.append(dict(source=slug+':'+pre,target=ref))
 for d in deps:assert pos[d['source']]<pos[d['target']],d
 data=dict(schema=id+'-mission/1',revision='integrated-20261018',stations=stations,modules=nodes,tasks=tasks,groups=groups,foundations=[],sourceDependencies=deps,preservation=dict(classroomNodes=len(nodes),mainNodes=sum(len(s['steps']) for s in stations),micro=len(c['micro']),sourceTrees={slug:len(TREES[slug]['modules']) for slug in slugs}))
 save(OUT/f'{id}-mission.json',data);dest=IDEA/'project_lines'/c['line']/'mission-integration-20261018';save(dest/'runtime-manifest.json',data)
 with (AUDIT/f'{id}-node-allocation.tsv').open('w') as f:
  w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['original_ref','title','station','group','path','position','original_record_ref']);w.writerows([[n['ref'],n['title'],n['station'],n['group'],n['path'],pos[n['ref']]+1,n['ref']] for n in nodes])
 (dest/'node-allocation.tsv').write_bytes((AUDIT/f'{id}-node-allocation.tsv').read_bytes())
 review=f"# {c['title']}：节点整合对照\n\n完整验收状态见 verification-summary.md。全部原节点、媒体、作业及学习记录保留。\n\n"
 for g in groups:review+=f"## {g['title']}\n\n路径：{g['path']}；站点：{g['station']}。\n\n输入：{g['input']}\n\n交付：{g['output']}\n\n迁移：{g['transfer']}\n\n原节点："+' → '.join(g['steps'])+'\n\n'
 for f in [dest/'integration-review.md',AUDIT/f'{id}-review.md']:f.write_text(review.rstrip()+'\n')
 print(id,data['preservation'],'groups',len(groups),'dependencies',len(deps))
for id,c in CONFIG.items():compile(id,c)
for file,sha in read(AUDIT/'source-hashes.json').items():assert hashlib.sha256(Path(file).read_bytes()).hexdigest()==sha,file
