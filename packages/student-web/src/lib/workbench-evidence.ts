export const WB_SCENES = ['overview','acceptance','assembly','contract','report','evaluation','run','repair','tasks','handoff'] as const
export const WB_FEATURES = [
  {key:'MW',unit:'g/mol',rdkit:'amw'}, {key:'LogP',unit:'1',rdkit:'CrippenClogP'},
  {key:'HBD',unit:'count',rdkit:'NumHBD'}, {key:'HBA',unit:'count',rdkit:'NumHBA'},
  {key:'TPSA',unit:'Å²',rdkit:'tpsa'}, {key:'RotB',unit:'count',rdkit:'NumRotatableBonds'},
  {key:'Rings',unit:'count',rdkit:'NumRings'}, {key:'AromaticRings',unit:'count',rdkit:'NumAromaticRings'},
] as const
export const WB_MOLECULES = [
  {id:'E',name:'乙醇',smiles:'CCO',values:[46.069,-.0014,1,1,20.23,0,0,0]},
  {id:'O',name:'正辛烷',smiles:'CCCCCCCC',values:[114.232,3.3668,0,0,0,5,0,0]},
  {id:'A',name:'阿司匹林',smiles:'CC(=O)Oc1ccccc1C(=O)O',values:[180.15899,1.3101,1,3,63.6,2,1,1]},
] as const
export const WB_DATA_NOTE = '结构与描述符由 RDKit 核对；预测与评估行是明确编造的教学数据，不是这些分子的真实毒性、溶解度或模型性能。'
// The stub exercises an interface, not chemistry inference. No real model exists here.
export const MOCK_PREDICTIONS: Record<string,{risk:number;logS:number}> = {E:{risk:.12,logS:-1.2},O:{risk:.72,logS:-5.1},A:{risk:.28,logS:-2.4}}
export function checkFeatureContract(names:readonly string[],values:readonly number[],units:readonly string[]=WB_FEATURES.map(f=>f.unit)) {
  const errors:string[]=[]
  if(names.length!==8||values.length!==8||units.length!==8)errors.push('必须恰好有 8 列名称、值和单位')
  if(new Set(names).size!==names.length)errors.push('列名重复')
  WB_FEATURES.forEach((f,i)=>{if(names[i]!==f.key)errors.push(`第 ${i+1} 列：需要 ${f.key}，收到 ${names[i]??'缺失'}`);if(units[i]!==f.unit)errors.push(`${f.key} 单位需要 ${f.unit}`);if(!Number.isFinite(values[i]))errors.push(`${f.key} 值缺失或无效`)})
  return {ok:errors.length===0,errors}
}
export type EvaluationMode='disjoint'|'leak'|'missing'
export type EvaluationRow={id:string;group:string;label:number;score:number;truth:number;prediction:number}
export const MOCK_TEST_ROWS:EvaluationRow[]=[
  {id:'T1',group:'C',label:0,score:.1,truth:-1,prediction:-1.5},
  {id:'T2',group:'C',label:1,score:.7,truth:-2,prediction:-1.5},
  {id:'T3',group:'D',label:1,score:.4,truth:-3,prediction:-2},
  {id:'T4',group:'D',label:0,score:.6,truth:-4,prediction:-4},
]
export function metricValues(rows:EvaluationRow[]) {
  if(!rows.length||new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>![0,1].includes(r.label)||![r.score,r.truth,r.prediction].every(Number.isFinite)||r.score<0||r.score>1))throw Error('无效的评估记录')
  const positive=rows.filter(r=>r.label===1),negative=rows.filter(r=>r.label===0)
  if(!positive.length||!negative.length)throw Error('ROC-AUC 需要两类样本')
  const pairs=positive.flatMap(p=>negative.map(n=>({positive:p.id,negative:n.id,credit:p.score>n.score?1:p.score===n.score?.5:0})))
  const errors=rows.map(r=>Math.abs(r.prediction-r.truth))
  return {auc:pairs.reduce((s,p)=>s+p.credit,0)/pairs.length,mae:errors.reduce((s,e)=>s+e,0)/errors.length,pairs,errors}
}
export function auditEvaluation(mode:EvaluationMode) {
  if(!['disjoint','leak','missing'].includes(mode))throw Error('Unknown evaluation case')
  const trainGroups=mode==='leak'?['A','C']:['A','B'],rows=mode==='missing'?[]:MOCK_TEST_ROWS
  const testGroups=[...new Set(rows.map(r=>r.group))],overlap=trainGroups.filter(g=>testGroups.includes(g))
  return {mode,trainGroups,testGroups,rows,overlap,groupCheck:rows.length>0&&overlap.length===0,metrics:rows.length?metricValues(rows):null,realModelEvidence:false,
    source:'mock-evaluation-v1; synthetic group IDs, not computed chemical scaffolds',
    note:mode==='missing'?'未提供评估行：指标留空，不能填 0。':overlap.length?'训练与测试组重叠：分数能算，不代表划分合格。':'教学分组无重叠；仍需你的真实 scaffold 分组、标签和预测记录。'}
}
export const WB_STAGES=[
  {name:'读通与画结构',from:'SMILES + candidate_id',to:'分子对象 / 结构图',check:'字符串能被 RDKit 解析；ID 不变'},
  {name:'特征与接口',from:'有效分子对象',to:'8 列名称、值、单位',check:'方法、版本、列名与顺序和训练时一致'},
  {name:'模型接口',from:'对齐的特征向量',to:'risk + logS + model_id',check:'模型包存在、契约一致，输出带版本；教学替身必须明示'},
  {name:'过滤与排序',from:'预测 + 描述符 + 规则',to:'决定、理由、排名',check:'先过规则，再排序；拒绝行不能回流'},
  {name:'汇总与导出',from:'候选证据 + 评估记录',to:'可追溯 JSON 报告',check:'来源、局限和缺失证据不能省略'},
] as const
export type RunScenario='demo'|'invalid'|'columns'|'missing-model'
export function pipelineTrace(scenario:RunScenario) {
  if(!['demo','invalid','columns','missing-model'].includes(scenario))throw Error('Unknown run case')
  const stop=scenario==='invalid'?0:scenario==='columns'?1:scenario==='missing-model'?2:5
  const outputs=['E / CCO → 有效分子；结构由 RDKit 绘制','[MW, LogP, HBD, HBA, TPSA, RotB, Rings, AromaticRings]','mock-model-v1 → risk=0.12, logS=−1.2（编造的接口测试值）','教学规则通过 → Go（教学）；真实决策仍需证据','教学报告生成；真实模型与 scaffold 评估尚缺']
  const failures=['CC( → 无效 SMILES，停止；不生成特征','收到 [LogP, MW, …]，与训练契约错位；停止调用模型','模型缺失；不能用 0 或随机数替代预测']
  return WB_STAGES.slice(0,Math.min(stop+1,5)).map((s,stage)=>({...s,stage,status:stage===stop?'blocked':'pass',output:stage===stop?failures[stage]:outputs[stage]}))
}
export function workbenchReport(riskLimit=.4,mode:EvaluationMode='disjoint') {
  if(!Number.isFinite(riskLimit)||riskLimit<0||riskLimit>1)throw Error('风险阈值应在 0 到 1 之间')
  const candidates=WB_MOLECULES.map(row=>{
    const p=MOCK_PREDICTIONS[row.id],limits=[500,5,5,10],violations=limits.filter((v,i)=>row.values[i]>v).length
    const reason=violations>1?`Lipinski 教学初筛：${violations} 项违反 > 1`:p.risk>riskLimit?`教学 risk ${p.risk.toFixed(2)} > ${riskLimit.toFixed(2)}`:p.logS< -4?`教学 logS ${p.logS} < −4`:'教学规则通过；按较低 risk 优先安排复核'
    const pass=violations<=1&&p.risk<=riskLimit&&p.logS>=-4
    return {...row,prediction:p,predictionSource:'mock-model-v1',violations,decision:pass?'Go（教学）':'No-Go（教学）',reason,priority:1-p.risk,realDecision:'需要更多证据'}
  })
  const ranked=candidates.filter(c=>c.decision==='Go（教学）').sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).map((r,i)=>({...r,rank:i+1}))
  return {project:'molecule-monster-hunter',module:'M47',version:'workbench-v1',teachingOnly:true,realProjectReady:false,
    descriptorSource:'RDKit.js 2025.3.4-1.0.0',featureContract:WB_FEATURES,modelSource:'mock-model-v1 (fabricated interface-test values)',
    policy:{lipinskiMaximumViolations:1,riskMaximum:riskLimit,logSMinimum:-4,rank:'1 - mock risk, descending; ID ties',topK:10},
    candidates,top10:ranked.slice(0,10),evaluation:auditEvaluation(mode),missingEvidence:['真实训练模型与预处理配置','真实 scaffold 划分及测试集标签/预测','实际候选库和完整多样性筛选记录'],
    limitation:'教学报告不是已验证的药物筛选结果；Go 不代表安全、有效或可成药，不能用于医疗决定。'}
}
