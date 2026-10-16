"""Compose existing lessons into one mission; never write source course content."""
import argparse, copy, csv, hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'packages/student-web/src/lib/project-lines/biomed-mission.json'
AUDIT=ROOT/'artifacts/biomed-integration-20261013'
BEFORE=AUDIT/'before-curriculum.json'
P={'m':'molecule-monster-hunter','t':'teachopencadd-candidate-research','f':'build-a-candidate-filter','p':'check-a-prediction','a':'assemble-a-discovery-desk','c':'challenge-an-unseen-library'}
def refs(spec):
 return [P[token[0]]+':M'+token[1:].zfill(2) for token in spec.split()]
def group(id,station,title,spec,input,output,transfer,track):
 return dict(id=id,station=station,title=title,steps=refs(spec),input=input,output=output,transfer=transfer,track=track)
GROUPS=[
 group('research-question','protocol','领取同一个研究问题','m1 t1 t2','第一张分子观察卡','研究对象与来源卡','沿用同一个研究问题；真药故事只解释动机，不替代靶点和端点核对。','target'),
 group('read-a-structure','protocol','搭起能读懂分子的工具台','m2 m3 m4 t3 m5 m6','对象与结构标识','可运行的结构识读工作台','把环境、原子/键与 SMILES 对照带到数据环节；不同表示不能直接当作不同分子。','method'),
 group('freeze-question','protocol','约定我们要证明什么','t4 t5','对象卡与结构识读结果','研究协议 v1：靶点、主要端点和可比条件','后续数据和标签必须按这份协议解释；修改协议另存版本，不能追着成绩改。','target'),
 group('collect-and-read','data','把来源变成可处理的记录','m7 m8 m9 m10 m11 t6','已冻结的研究协议','原始快照、来源清单与读取脚本','练习取数和编程后，正式研究只消费本协议下的快照；原始数据只读保留。','mixed'),
 group('normalize-records','data','逐条核对单位、身份和冲突','t7 t8 t9 m12 t10 m13 m14 t11','原始快照与读取脚本','逐行处理账本、单位与缺失/冲突说明','先核对单位、关系符和结构身份，再合并；不能用删掉困难样本让结果变好。','mixed'),
 group('release-dataset','data','交接一份能追查的数据集','m15 m16 t12','处理账本与原始快照','原始/清洗/排除三份表和数据字典','分子猎人的练习标签与正式靶点标签分开保存；每一行须能回查来源。','mixed'),
 group('describe-structures','filter','把结构变成可解释的特征','t13 m17 t14 m18 t15 m19 m20 t16','经检查的结构表','按分子 ID 对齐的描述符表','核对数值含义、单位及 ID；描述符不是药效、安全性或实测活性。','mixed'),
 group('compare-filters','filter','把筛选规则变成可复查的决定','f1 f2 f3 f4 t17 t18','描述符表与同条件教学样本','两套练习规则和正式描述符过滤器','ESOL 规则只作方法练习。正式过滤器重新核对研究表、阈值和警报，不自动导入教学结论。','mixed'),
 group('compare-structures','filter','让相似也有明确算法','m21 t19 m22 t20 m23','结构标识与描述符表','可复算指纹和相似度对照','保存指纹配置、半径和版本；相似性只提供线索，不等于相同作用。','mixed'),
 group('freeze-feature-baseline','filter','冻结特征、结构分组和基线','m24 m25 m26 t21 t22 t23','描述符、指纹及来源 ID','特征字典、结构划分与相似性基线','缩放只拟合训练部分；正式保留集封存。每个数据集单独记分组，不能共享练习成绩。','mixed'),
 group('baseline-before-model','prediction','先定义答案，再建立简单方法','m27 p1 p2 t24 t25','研究协议与冻结数据划分','标签规则、简单基线与验证计划','先分清连续属性与分类标签；同一评价中的方法使用同一批样本和分母。','mixed'),
 group('train-and-inspect','prediction','看清树和森林怎样作决定','m28 t26 t27 m29 t28 m30 t29 t30','开发数据、特征与基线','可复查的树/森林开发记录','超参数选择留在开发数据；保留集仍不打开，保留过拟合和失败证据。','mixed'),
 group('challenge-easy-scores','prediction','检查漂亮分数背后的代价','m31 m32 p3 p4','开发记录与教学验证结果','模型对照、误差案例与适用范围说明','XGBoost 和随机切分是方法对照；ESOL 的误差报告不能当靶点分类的独立评价。','method'),
 group('wire-the-workbench','systems','让自己的部件在同一条流程里工作','a1 a2 a3 a4 a5 a6','练习筛选器与预测报告','可追查 ID 的工作台、故障诊断与预算对照','浏览器实验消费原小课作品；默认部件须明示。正式 Notebook 接口须另按原课核对。','method'),
 group('seal-the-challenge','systems','在看答案前封存挑战','c1 c2','工作台、规则与判断标准','未揭晓的新数据挑战方案','此处只封存教学挑战。正式研究的保留集另在模型评估舱按自己的协议开启。','method'),
 group('audit-leakage','evaluation','检查模型有没有见过答案','m33 m34 m35 m36','冻结的结构分组与开发模型','随机/骨架切分对照与概率说明','本组用原课开发材料检验泄漏；不得为了演示打开正式研究保留集。','method'),
 group('audit-metrics','evaluation','让评价完整呈现失败','t31 m37 t32 m38 m39 t33 m40 m41 t34','开发预测、基线与适用范围','混淆矩阵、阈值/ROC、回归误差及公平对照','分类与回归各用自己的指标，保留分母与失败案例；原课模型包仍独立保存。','mixed'),
 group('freeze-and-open','evaluation','保留不可改写的第一次结果','t35 c3 c4 c5 t36','封存的模型配置及独立教学挑战','正式保留集首次评价＋单独的教学挑战档案','教学挑战按原课程打开；正式评价只执行一次原定方案。探索修订另存，不覆盖首次快照。','mixed'),
 group('candidate-pipeline','delivery','将规则串成候选筛选管线','m42 t37 m43 m44','冻结规则、模型和首次评价','可追查的筛选流水线与排序配置','Lipinski 和综合排序是研究线索；真正筛选使用声明的数据、规则和适用范围。','mixed'),
 group('review-candidates','delivery','为支持、拒绝和未知都留证据','t38 m45 t39 m46 t40 t41 t42','候选表、排除表与首次结果','候选证据清单、反例和待验证问题','不为凑候选数量改写首次规则；多样性和适用范围一同交给下一位研究者。','mixed'),
 group('assemble-research','delivery','让整份研究从一个入口运行','t43 m47','各阶段可复跑材料与证据清单','研究入口、原课工作台与版本索引','保留两个原课程收口。统一档案引用它们的准确位置，不能声称两个不同数据流程已自动接通。','mixed'),
 group('handover-research','delivery','请另一位研究者复跑同一问题','t44 t45 t46','研究入口与版本索引','可复跑候选研究档案及复核记录','清点来源、环境、首次结果和已知限制。允许结论不支持假设，不把候选称作已证实的新药。','target'),
]
ORDER=['observation','protocol','data','filter','prediction','systems','evaluation','delivery']
STATIONS={
 'observation':('亲手留下一条观察，领取研究委托','浏览器与一个想追问的问题','带分子 ID 的观察卡','任选一个微体验；观察模型不能证明药效'),
 'protocol':('先确定对象，再约定这次研究如何判断','观察卡与原课提供的公开来源','结构识读台、研究协议与对象标识','核对同一靶点、主要端点与可比条件；协议在看成绩前形成'),
 'data':('让每一条研究记录都能找到来处','研究协议、原始来源与编程工具','原始快照、处理账本和可复查研究表','练习与正式数据分开；单位、重复、冲突和缺失处理留痕'),
 'filter':('从分子结构建立能解释的筛选规则','结构与数据字典、处理账本','描述符过滤器、特征表、结构分组与相似性基线','练习配置迁移需核对，正式保留集仍封存'),
 'prediction':('先做简单方法，再训练可检查的模型','研究表、划分、特征和基线','开发模型、对照与误差说明','只在开发部分选择方法；回归和分类成绩分开'),
 'systems':('接通自己的部件，并封存一次挑战','教学筛选器、预测方法和接口约定','工作台、故障诊断、预算对照及封存方案','说明自己的输入与默认模块；教学挑战不代替正式研究'),
 'evaluation':('在独立证据面前保留第一次答案','封存配置、挑战方案与评价标准','完整独立评价、首次结果和事后修订','不偷看、不挑样本、不覆盖首次结果；未知范围单独标明'),
 'delivery':('交付候选，也交付别人能复跑的证据','评价记录、筛选规则与来源版本','候选理由、失败案例、运行入口与复核档案','可从候选追溯到原始数据；不宣称疗效或安全性'),
}
def build(idea):
 old=json.loads(BEFORE.read_text());data=copy.deepcopy(old);original_tasks={t['id']:t for t in old['tasks']};nodes={n['ref']:n for n in data['modules']}
 ordered=[ref for g in GROUPS for ref in g['steps']]
 assert len(ordered)==len(set(ordered))==len(nodes)==112
 assert set(ordered)==set(nodes),'Every existing node must have exactly one mission position'
 tasks=[];modules=[];stations=[]
 for i,id in enumerate(ORDER):
  st=copy.deepcopy(next(s for s in old['stations'] if s['id']==id));message,input,handoff,gate=STATIONS[id]
  st.update(code=f'{i+1:02}',message=message,input=input,handoff=handoff,gate=gate,dependsOn=ORDER[i-1:i] if i else [],steps=[r for g in GROUPS if g['station']==id for r in g['steps']])
  stations.append(st)
  for n,ref in enumerate(st['steps']):
   g=next(g for g in GROUPS if ref in g['steps']);node=nodes[ref];node.update(station=id,mode='lesson',anchor=None,group=g['id'])
   modules.append(node);t=copy.deepcopy(original_tasks[ref]);t.update(station=id,role='lesson',code=f'{i+1:02}.{n+1:02}',category='靶点研究' if node['project']==P['t'] else '方法实验',note=g['transfer'])
   # Never change checks: persisted check-0/check-1 labels keep their original meaning.
   assert t['checks']==original_tasks[ref]['checks'];tasks.append(t)
 micro=[copy.deepcopy(t) for t in old['tasks'] if t['role']=='micro']
 data.update(schema=old['schema'],revision='integrated-20261013',stations=stations,modules=modules,tasks=micro+tasks,groups=GROUPS)
 foundation=[];source_dependencies=[];source_hashes={};positions={r:i for i,r in enumerate(ordered)}
 for alias in ['m','t']:
  slug=P[alias];tree_path=(AUDIT/'molecule-monster-hunter-published-tree.json') if alias=='m' else idea/'projects_data'/slug/'tree/knowledge_tree.json'
  raw=tree_path.read_bytes();tree=json.loads(raw);source_hashes[slug]=hashlib.sha256(raw).hexdigest()
  for m in tree['modules']:
   ref=slug+':'+m['module_id'];assert nodes[ref]['title']==m['title']
   for prior in m.get('depends_on',[]):
    before=slug+':'+prior;assert positions[before]<positions[ref],(before,ref)
    source_dependencies.append({'from':before,'to':ref})
  if alias=='t':
   for f in sorted((idea/'projects_data'/slug/'practice/foundations').glob('*.md')):
    uses=[slug+':'+m['module_id'] for m in tree['modules'] if f.stem in m.get('foundation_ids',[])]
    assert uses
    foundation.append(dict(id=f.stem,title=f.read_text().splitlines()[0].lstrip('# '),path='practice/foundations/'+f.name,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),uses=uses))
 data.update(foundations=foundation,sourceDependencies=source_dependencies,preservation={'sourceNodes':len(nodes),'micro':len(micro),'foundations':len(foundation),'taskIdsUnchanged':True,'checksUnchanged':True,'sourceHashes':source_hashes,'previousMainSteps':65,'sourceCommit':'e204a58fe5799b06eaec27c00c28d6ce262461e3'})
 assert {t['id'] for t in data['tasks']}==set(original_tasks)
 OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 with (AUDIT/'node-allocation.tsv').open('w',newline='') as f:
  w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['source','original_title','old_station','old_role','new_station','task_group','mission_order','record_id'])
  for t in data['tasks']:
   g=next((g for g in GROUPS if t['id'] in g['steps']),None);o=original_tasks[t['id']]
   w.writerow([t['id'],t['title'],o['station'],o['role'],t['station'],g['title'] if g else '任选启程',t['code'],t['id']])
 print(json.dumps({'classroom_nodes':len(modules),'micro':len(micro),'groups':len(GROUPS),'foundations':len(foundation),'source_dependencies_checked':len(source_dependencies),'stations':{s['id']:len(s['steps']) for s in stations}}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--idea',type=Path,default=Path('/Users/xinghan/Dev/systemeduidea'));build(p.parse_args().idea)
