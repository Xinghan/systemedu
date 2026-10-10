"""Rearrange checked-in courses. Does not generate or overwrite lesson content."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
idea = root.parent / 'systemeduidea'
out = root/'packages/student-web/src/lib/project-lines'
guided = root/'packages/student-web/public/project-lines/biomedicine'
stations = [
 ('observation','分子观察窗','先认出一个分子，留下自己的观察',1,'一台能打开浏览器的电脑','带分子 ID 与观察角度的发现卡','观察中区分模型外观与真实微观结构',[]),
 ('filter','规则筛选室','给每一次保留和排除一个理由',2,'观察卡；课程提供的 ESOL 教学样本','两套筛选规则、逐条判定与缺失值说明','同一批数据比较规则；信息不足先暂存',['observation']),
 ('prediction','预测检验室','让 AI 的判断接受证据检验',2,'筛选规则；同一验证集上的预测与测量','预测检验报告、基线比较与误差案例','比较同集结果，不把预测当测量',['filter']),
 ('systems','发现工作台','连接部件，再打开未知档案',3,'自己的筛选与检验作品；缺少的部件在原实验中明确使用默认配置','发现工作台、预算复测与首次新数据挑战档案','先封存，再揭晓；保留失败与事后改进两份记录',['filter','prediction']),
 ('protocol','研究立项室','从教学练习走向一个真实靶点',5,'前四站的研究方法；TeachOpenCADD 原课中的靶点与公开来源','靶点、单一主要端点、可比测定条件与预定协议','重新建立研究数据与问题；ESOL 练习的结论不能直接迁移为活性结论',['systems']),
 ('data','数据与基线室','把每一条候选追溯到原始来源',5,'封存的研究协议与来源快照','清洗账本、描述符过滤器、冻结结构分组与相似性基线','保留原始记录；去重与缺失处理可复查；冻结后不偷看保留集',['protocol']),
 ('evaluation','模型评估舱','用独立证据检查一个会犯错的模型',5,'冻结的数据划分、标签规则与简单基线','树与森林开发记录、冻结配置与首次保留集评价','与基线公平比较；首次结果不可覆盖；未知范围单独标记',['data']),
 ('delivery','候选评审厅','交付一份别人能够复跑的研究',5,'首次评价、冻结筛选流程与候选理由','候选证据清单、可复跑入口、环境引用与研究报告','他人复跑同一问题；写清支持、排除、未知和后续验证',['evaluation']),
]
data={'schema':'biomed-mission-curriculum/1','stations':[],'modules':[],'tasks':[],'micro':['turn-a-molecule','sort-molecule-cards']}
for i,(id,place,message,level,input,handoff,gate,deps) in enumerate(stations):
 data['stations'].append(dict(id=id,code=f'{i+1:02}',place=place,message=message,level=level,input=input,handoff=handoff,gate=gate,dependsOn=deps,steps=[]))

def add(project,m,station,mode,kind,version='1.0',anchor=None):
 ref=f"{project}:{m['module_id']}"; st=next(s for s in data['stations'] if s['id']==station)
 node=dict(ref=ref,project=project,module=m['module_id'],title=m['title'],station=station,mode=mode,kind=kind,version=version,anchor=anchor)
 data['modules'].append(node)
 if mode=='lesson':st['steps'].append(ref)
 guide=m.get('guide',{})
 outputs=[a['title'] for a in m.get('acceptance_artifacts',[])] or [guide.get('done') or m.get('deliverable') or m['title']+'的本人操作与结果记录']
 if not isinstance(outputs[0],str): outputs=[str(outputs[0])]
 checks=m.get('acceptance_standard') or ([guide['done']] if guide.get('done') else ['保留本人实际操作、选择与结果','标明来源与一个仍需验证的问题'])
 actions=guide.get('steps') or m.get('hands_on_components') or ['在原课堂阅读例子与失败情境，确认本节输入。','完成原课堂任务，保留自己的运行或判断记录。','对照本节验收标准，自检并记录下一步需要的材料。']
 resources=m.get('mission_resources',[])
 minutes=m.get('estimated_minutes') or (m.get('active_minutes') or [None])[0]
 data['tasks'].append(dict(id=ref,code=f"{st['code']}.{len(st['steps']):02}" if mode=='lesson' else '补课·'+m['module_id'],title=m['title'],station=station,role=mode,category='真实数据研究' if project.startswith('teach') else '方法练习' if kind=='guided' else '基础补给',goal=guide.get('start') or m.get('core_question') or m.get('summary') or m['title'],actions=actions,outputs=outputs,checks=checks,minutes=minutes,resources=resources,preparation='原课堂保留视频、动画、实验、学习记录与正式资料入口。',note='ESOL 教学练习用于建立方法；不能作为后续靶点活性研究的证据。' if kind=='guided' else '随用随学，不计入主线通关。保留原课程标识与记录。' if mode=='support' else '使用原课规定的数据与环境。候选仅表示值得进一步验证，不代表药效或安全性。'))
guides=json.load(open(out/'biomed-lesson-guides.json'))
for project,station in [('build-a-candidate-filter','filter'),('check-a-prediction','prediction'),('assemble-a-discovery-desk','systems'),('challenge-an-unseen-library','systems')]:
 p=guided/project/'course'; course=json.load(open(p/'tree/knowledge_tree.json'))
 for m in course['modules']:
  m['guide']=guides.get(project,{}).get(m['module_id'],{})
  resources=json.load(open(p/m['resources']))
  m['mission_resources']=[dict(title=r.get('title','原课资料'),url=r.get('url',''),purpose=r.get('task') or r.get('purpose') or r.get('description',''),kind=r.get('kind','reference')) for r in resources if r.get('url')]
  add(project,m,station,'lesson','guided',course['version'])
project='teachopencadd-candidate-research'; tree=json.load(open(idea/'projects_data'/project/'tree/knowledge_tree.json'))
for m in tree['modules']:
 st={'P1':'protocol','P2':'data','P3':'data','P4':'data','P5':'evaluation','P6':'evaluation','P7':'delivery','P8':'delivery'}[m['stage_id']]
 add(project,m,st,'lesson','full')
project='molecule-monster-hunter'; tree=json.load(open(idea/'projects_data'/project/'tree/knowledge_tree.json'))
for m in tree['modules']:
 st,anchor={'S1':('protocol','M02'),'S2':('data','M06'),'S3':('data','M16'),'S4':('evaluation','M28'),'S5':('delivery','M37')}[m['stage_id']]
 add(project,m,st,'support','full',anchor='teachopencadd-candidate-research:'+anchor)
for i,slug in enumerate(data['micro']):
 title=['转动我的第一个分子','给分子排个队'][i]
 data['tasks'].insert(i,dict(id='micro:'+slug,code=f'01.0{i+1}',title=title,station='observation',role='micro',category='3 分钟启程',goal='亲手观察、比较，留下自己的第一条发现。',actions=['进入体验，选择并操作一个分子。','保存自己的观察或排序；说出一个变化。'],outputs=['带标识的分子观察卡' if i==0 else '排序与比较记录'],checks=['实际操作并保存了自己的结果','区分屏幕模型与真实分子'],minutes=3,resources=[],preparation='浏览器即可，无需安装或购买器材。',note='任选一个体验即可进入下一站；另一个可以随时回来。'))
(out/'biomed-mission.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('stations',len(data['stations']),'main',sum(len(s['steps']) for s in data['stations']),'support',sum(m['mode']=='support' for m in data['modules']),'tasks',len(data['tasks']))
