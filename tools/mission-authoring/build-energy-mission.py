"""Map existing courses into a mission; original lessons/IDs are never rewritten."""
import argparse, hashlib, json
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--idea-root',type=Path,required=True);args=parser.parse_args()
root=Path(__file__).resolve().parents[2];idea=args.idea_root
out=root/'packages/student-web/src/lib/project-lines';public=root/'packages/student-web/public/project-lines/energy-motion'
stations=[
('discovery','能量初探室','给一盏观测信号灯找到能量',1,'电脑与浏览器；从三种体验任选一种','角度对照、风轮比较或供电记录','改一个参数，保存两次结果；指出这是教学模拟',[]),
('harvest','风光采集室','让光与风变成可以比较的电',2,'自己的体验记录；按原课程准备小太阳能板、微型发电机与打印结构','追光台、小风机、同条件对照和原始测量','结构有本人尺寸决策；固定条件比较；分清电压、功率与能量',['discovery']),
('storage','储能调度室','给有限能量排一张值班表',2,'采集方案；带保护的低压储能模块与原课规定器材','储能续航报告、有效的调度规则与缺测策略','区分储能容量与可用能量；保留关键负载；在缺测情境测试规则',['harvest']),
('integration','能源站联调室','让自己打印的能源站接下一次任务',3,'自己的光、风、储能和规则参数；缺件可在原课明确使用默认模块','本人打印装配的能源站、故障定位及一次未知工况挑战','数字原型先存；实物交付另需本人装配与实测；先封存再测试，不覆盖失败',['harvest','storage']),
('measurement','可信测量室','先证明读数可信，再给明天做预报',5,'进入 pvlib 完整课程；通用低压测量器材、3D 打印与成人接线复核','小板身份与接口表、校准采集链、可复现支架和开发数据集','重新核验器材口径与姿态；公开数据与本人测量分别标明，缺硬件不记为实物完成',['integration']),
('forecast','功率预报室','把光、温度与小板模型接起来',5,'有来源的开发数据、同一块板的参数和固定姿态','太阳位置、板面辐照、温度与直流模型包','保留单位、时区、假设与未知量；开发数据调参，独立日期留到后面',['measurement']),
('validation','盲测验证室','在明天到来之前，封存你的判断',5,'冻结模型、发布时可取得的天气与两种基线','三方法未来预报包、首次独立观测和第二日期复查','预报先于观测；公平配对同一批时刻；误差与失败保留，不冒充全天电量',['forecast']),
('handover','工程交付室','把一座能复查的预测站交给下一位工程师',5,'原始测量、版本、首次结果、打印结构与故障记录','一条命令可复跑的预测站与本人实物验证档案','干净目录复跑；标明已验证和未完成部分；正式文件交到原课堂',['validation']),
]
data={'schema':'energy-mission-curriculum/1','stations':[],'modules':[],'tasks':[],'micro':['catch-a-sunbeam','tune-a-wind-rotor','keep-the-beacon-on'],'provenance':[]}
for i,(id,place,message,level,inp,handoff,gate,deps) in enumerate(stations):data['stations'].append(dict(id=id,code=f'{i+1:02}',place=place,message=message,level=level,input=inp,handoff=handoff,gate=gate,dependsOn=deps,steps=[]))
def read(p):
 b=p.read_bytes();data['provenance'].append({'path':str(p.relative_to(idea)) if p.is_relative_to(idea) else str(p.relative_to(root)),'sha256':hashlib.sha256(b).hexdigest()});return json.loads(b)
guides=read(out/'renewable-guides.json');oldguides=read(out/'energy-guides.json')
def add(project,m,station,kind,version='1.0',mode='lesson',anchor=None):
 st=next(s for s in data['stations'] if s['id']==station);ref=project+':'+m['module_id'];guide=(guides.get(project) or oldguides.get(project) or {}).get(m['module_id'],{})
 data['modules'].append(dict(ref=ref,project=project,module=m['module_id'],title=m['title'],station=station,mode=mode,kind=kind,version=version,anchor=anchor))
 if mode=='lesson':st['steps'].append(ref)
 outputs=[a['title'] for a in m.get('acceptance_artifacts',[])] or [guide.get('output') or m.get('output') or m.get('artifact') or m['title']+'的操作证据']
 checks=m.get('acceptance_standard') or [guide.get('output') or m.get('output') or '保存自己的版本与原始结果','写清条件、单位及一条尚未验证的限制']
 actions=guide.get('steps') or m.get('hands_on_components') or [m.get('objective') or m['title'],'保存本人的操作与结果，对照原课要求复核。']
 resources=[]
 if kind=='guided':
  for r in json.loads((public/project/'course'/m['resources']).read_text()):
   if r.get('url'):resources.append(dict(title=r.get('title','原课资料'),url=r['url'],purpose=r.get('task') or r.get('purpose') or r.get('description',''),kind=r.get('kind','reference')))
 data['tasks'].append(dict(id=ref,code=f"{st['code']}.{len(st['steps']):02}" if mode=='lesson' else '补给·'+m['module_id'],title=m['title'],station=station,role=mode,category='真实功率预报' if kind=='full' else '机构补给' if mode=='support' else '能源实践',goal=guide.get('start') or m.get('core_question') or m['title'],actions=actions,outputs=outputs,checks=checks,minutes=m.get('estimated_minutes') or (m.get('active_minutes') or [None])[0],resources=resources,preparation='先阅读原课器材与接口表。本人结构件统一 3D 打印；低压模块和简单标准件可购买；接线与转动件由成人协助复核。',note=('方法补给可按需返回，不是前进门槛。' if mode=='support' else '教学模拟、公开实测与本人实物记录分别标明。')+' 前站配置不能自动替代本站校准；点击自检不等于实物或教师验收通过。'))
for project,station in [('build-a-solar-tracker','harvest'),('design-a-wind-rotor','harvest'),('store-energy-for-later','storage'),('write-energy-dispatch-rules','storage'),('build-a-wind-solar-station','integration'),('run-an-energy-mission','integration')]:
 tree=read(public/project/'course/tree/knowledge_tree.json')
 for m in tree['modules']:add(project,m,station,'guided',tree['version'])
project='pvlib-solar-forecast-station';tree=read(idea/'projects_data'/project/'tree/knowledge_tree.json')
for m in tree['modules']:
 n=int(m['module_id'][1:]);station='measurement' if n<=20 else 'forecast' if n<=40 else 'validation' if n<=53 else 'handover';add(project,m,station,'full')
for project,station,anchor in [('compare-energy-settings','harvest','build-a-solar-tracker:M03'),('design-a-printed-transmission','harvest','design-a-wind-rotor:M02'),('build-a-printed-generator','integration','build-a-wind-solar-station:M02')]:
 tree=read(public/project/'course/tree/knowledge_tree.json')
 for m in tree['modules']:add(project,m,station,'guided',tree['version'],'support',anchor)
for i,(slug,title,goal,output) in enumerate(zip(data['micro'],['接住一束阳光','给风找到一副翅膀','让信号灯多亮一会儿'],['固定负载，只改变板的倾角，比较两次结果。','固定风况，只改变叶片角度，比较两次输出。','调整供电策略，比较信号灯服务时间。'],['两版角度与功率比较','两版风轮配置与输出','供电策略与服务时间记录'])):
 data['tasks'].insert(i,dict(id='micro:'+slug,code=f'01.0{i+1}',title=title,station='discovery',role='micro',category='3 分钟启程',goal=goal,actions=[goal,'保存自己的发现，并说明还有什么需要实测。'],outputs=[output],checks=['亲自运行并保留了两次对照','明确记录来自教学模拟'],minutes=3,resources=[],preparation='浏览器即可；无需先购买硬件。',note='三个体验任选一个启程，其余可随时返回。'))
path=out/'energy-mission.json';path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stations':len(data['stations']),'main':sum(len(s['steps']) for s in data['stations']),'support':sum(m['mode']=='support' for m in data['modules']),'micro':len(data['micro'])}))
