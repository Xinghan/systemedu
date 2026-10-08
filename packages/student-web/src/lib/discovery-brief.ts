/** M01's explicit teaching dataset: no ID corresponds to a real molecule. */
export const DISCOVERY_NOTE = '12 条记录、排序分和揭晓结果均为构造教学数据；不是已训练模型、真实化学性质或实验结果。分数不是概率。'
export const DISCOVERY_ROWS = [
  {id:'A',score:92,soluble:true,lowRisk:true,hit:false},
  {id:'B',score:88,soluble:true,lowRisk:true,hit:true},
  {id:'C',score:84,soluble:true,lowRisk:true,hit:true},
  {id:'D',score:79,soluble:true,lowRisk:true,hit:false},
  {id:'E',score:74,soluble:true,lowRisk:true,hit:true},
  {id:'F',score:69,soluble:true,lowRisk:false,hit:false},
  {id:'G',score:64,soluble:true,lowRisk:false,hit:true},
  {id:'H',score:58,soluble:true,lowRisk:false,hit:false},
  {id:'I',score:51,soluble:false,lowRisk:true,hit:true},
  {id:'J',score:44,soluble:false,lowRisk:true,hit:false},
  {id:'K',score:35,soluble:false,lowRisk:false,hit:false},
  {id:'L',score:22,soluble:false,lowRisk:false,hit:true},
] as const
export type DiscoveryId = typeof DISCOVERY_ROWS[number]['id']
export const DISCOVERY_SCENES = ['overview','roles','roadmap','honesty','funnel','budget','brief','handoff'] as const
export function selection(count:number){
  if(!Number.isInteger(count)||count<1||count>12)throw Error('保留数必须为 1–12 的整数')
  return [...DISCOVERY_ROWS].sort((a,b)=>b.score-a.score).slice(0,count)
}
export function discoveryStages(){
  const all=[...DISCOVERY_ROWS],sol=all.filter(r=>r.soluble),risk=sol.filter(r=>r.lowRisk),short=risk.slice(0,3)
  return [
    {title:'读取候选库',rows:all,note:'12 个匿名教学记录；每个 ID 必须一路保留。'},
    {title:'条件一：溶解字段',rows:sol,note:'按本例预设的 soluble=true 保留 8 条。不是实际溶解度预测。'},
    {title:'条件二：风险字段',rows:risk,note:'再按 lowRisk=true 保留 5 条。通过教学字段不代表安全。'},
    {title:'按分数取 Top3',rows:short,note:'A、B、C 优先排入教学验证队列；其余只是未优先，不等于无效。'},
    {title:'揭晓构造验证结果',rows:short,note:'A 失败，B/C 通过本例测试。一次测试通过，也不是药物有效/安全的结论。'},
  ]
}
export function testCandidate(tested:DiscoveryId[],id:DiscoveryId,keep:number){
  if(tested.length>5||new Set(tested).size!==tested.length||tested.some(x=>!DISCOVERY_ROWS.some(r=>r.id===x)))throw Error('无效测试记录')
  if(tested.includes(id))return {tested,reason:'已经揭晓；不重复消耗预算。'}
  if(tested.length===5)return {tested,reason:'5 次预算已用完；未测结果仍未知。'}
  if(!selection(keep).some(r=>r.id===id))return {tested,reason:'不在当前保留范围内。'}
  return {tested:[...tested,id],reason:'新增一条构造验证记录，消耗 1 次预算。'}
}
export function discoveryEvidence(tested:DiscoveryId[],keep:number){
  return {teachingOnly:true,keep,budget:5,spent:tested.length,remaining:5-tested.length,
    tested:tested.map(id=>{const r=DISCOVERY_ROWS.find(x=>x.id===id);if(!r)throw Error('未知记录');return {id,score:r.score,result:r.hit?'通过本例测试':'未通过本例测试'}}),
    untested:DISCOVERY_ROWS.filter(r=>!tested.includes(r.id)).map(r=>({id:r.id,result:'未知'})),limitation:DISCOVERY_NOTE}
}
export type ProjectBrief={question:string;deliverable:string;properties:string[];honesty:boolean}
export const BRIEF_KEY='systemedu:molecule:M01:project-brief:v1'
export const EMPTY_BRIEF:ProjectBrief={question:'',deliverable:'',properties:[],honesty:false}
export const BRIEF_PROPERTIES=['溶解度相关指标','指定数据集的毒性标签','类药性规则符合情况']
export function briefProblems(b:ProjectBrief){return [!b.question.trim()&&'写清一个研究问题',!b.deliverable.trim()&&'写清交付物',!b.properties.length&&'至少选择一项预测/检查任务',!b.honesty&&'确认预测不替代实验的边界'].filter(Boolean) as string[]}
export function parseBrief(raw:string|null):ProjectBrief|null{
  if(!raw)return null
  try{const o=JSON.parse(raw),b=o.brief;if(o.schema!=='m01-project-brief-v1'||!b||typeof b.question!=='string'||typeof b.deliverable!=='string'||typeof b.honesty!=='boolean'||!Array.isArray(b.properties)||b.properties.some((s:unknown)=>typeof s!=='string'||!BRIEF_PROPERTIES.includes(s)))return null;return b}catch{return null}
}
export function briefArtifact(b:ProjectBrief){return {schema:'m01-project-brief-v1',project:'molecule-monster-hunter',module:'M01',brief:b,complete:briefProblems(b).length===0,honestyStatement:'本课只给出研究优先级；预测不是实验事实，也不是医疗建议。',next:'M02：安装 RDKit 并记录实际版本号；本卡未执行安装。'}}
export const DISCOVERY_MILESTONES=[
  {name:'干净分子库',input:'来源记录与结构写法',output:'candidate_id、SMILES、来源与清洗记录',file:'molecules.csv'},
  {name:'特征表',input:'通过检查的结构',output:'ID、同名同序的描述符列、计算版本',file:'features.csv'},
  {name:'诚实的模型',input:'特征、标签和明确的划分',output:'模型文件、测试记录、指标与局限',file:'model + evaluation.json'},
  {name:'候选报告',input:'预测、规则和排序/多样性策略',output:'实际候选数量、理由、下一步证据需求',file:'candidate-report.json'},
  {name:'可跑工作台',input:'上面全部零件与接口约定',output:'SMILES 输入 → 可追溯报告；不是药品',file:'workbench + acceptance.md'},
]
