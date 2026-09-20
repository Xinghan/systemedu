import {designBudget,validDesign,validPhysical,EMPTY_PHYSICAL,type RoverDesign,type EvidencePhoto} from './rover-system'
export type ExpeditionSource={id:string;createdAt:string;design:RoverDesign;codeChange:string;reportedWidth:string}
export type MissionPlan={route:'short'|'wide';distance:'6'|'10';reserve:'4'|'10';goal:string}
export type FieldTrial={id:string;distance:string;seconds:string;surface:string;observation:string;reached:'yes'|'no'|'';returned:'yes'|'no'|'';revision:string}
export type ExpeditionSystem={schema_version:'expedition-system/2';source:ExpeditionSource|null;plan:MissionPlan;runs:{key:string;plan:MissionPlan;result:ReturnType<typeof simulateMission>}[];fieldKey:string;routeNotes:string;measuredWidth:string;gateWidth:string;change:string;trials:FieldTrial[];photos:EvidencePhoto[]}
export function newExpedition():ExpeditionSystem{return {schema_version:'expedition-system/2',source:null,plan:{route:'short',distance:'10',reserve:'4',goal:''},runs:[],fieldKey:'',routeNotes:'',measuredWidth:'',gateWidth:'',change:'',trials:[],photos:[]}}
export function missionKey(a:ExpeditionSystem){return JSON.stringify({source:a.source,plan:a.plan})}
export function simulateMission(design:RoverDesign|null,plan:MissionPlan){
  if(!design)return {passed:false,cost:0,remaining:0,steps:['先读取已正式交付的 2.0 实物探测车。旧版虚拟车不能代替实物。']}
  const budget=designBudget(design),segments=Number(plan.distance)+(plan.route==='wide'?2:0),cost=segments*budget.cost+(plan.route==='short'?14:4),remaining=budget.capacity-cost,steps=[]
  if(plan.route==='short'&&design.wheel==='small')steps.push('捷径的凸起不适合当前小轮设计。')
  if(remaining<Number(plan.reserve))steps.push(`预计余量 ${remaining} 点，低于任务保留 ${plan.reserve} 点。`)
  if(!plan.goal.trim())steps.push('先写一个可以观察、带回结果的任务目标。')
  const passed=!steps.length
  steps.unshift(`${segments} 个往返路段 × ${budget.cost} 点，加路线与观察 ${plan.route==='short'?14:4} 点；总计 ${cost} 点。`)
  if(passed)steps.push('数字任务预算通过；实际电压、通过宽度、打滑和观察结果须现场测量。')
  return {passed,cost,remaining,steps}
}
export function runMission(a:ExpeditionSystem){return {...a,runs:[...a.runs.slice(-11),{key:missionKey(a),plan:{...a.plan},result:simulateMission(a.source?.design??null,a.plan)}]}}
const str=(v:unknown,max=800):v is string=>typeof v==='string'&&v.length<=max
function planValid(v:MissionPlan){return v&&['short','wide'].includes(v.route)&&['6','10'].includes(v.distance)&&['4','10'].includes(v.reserve)&&str(v.goal)}
export function isExpedition(v:unknown):v is ExpeditionSystem{
  try{if(!v||typeof v!=='object')return false;const a=v as ExpeditionSystem
    return a.schema_version==='expedition-system/2'&&(!a.source||(str(a.source.id)&&str(a.source.createdAt)&&validDesign(a.source.design)&&str(a.source.codeChange)&&str(a.source.reportedWidth)))&&planValid(a.plan)&&['fieldKey','routeNotes','measuredWidth','gateWidth','change'].every(k=>str(a[k as keyof ExpeditionSystem],2500))&&Array.isArray(a.runs)&&a.runs.length<=12&&a.runs.every(r=>str(r.key,2500)&&planValid(r.plan)&&r.key===missionKey({...a,plan:r.plan})&&JSON.stringify(r.result)===JSON.stringify(simulateMission(a.source?.design??null,r.plan)))&&Array.isArray(a.trials)&&a.trials.length<=8&&a.trials.every(t=>['id','distance','seconds','surface','observation','revision'].every(k=>str(t[k as keyof FieldTrial]))&&['','yes','no'].includes(t.reached)&&['','yes','no'].includes(t.returned))&&validPhysical({...EMPTY_PHYSICAL,photos:a.photos})
  }catch{return false}
}
export function expeditionChecks(a:ExpeditionSystem){
  const measured=(s:string)=>s.trim()!==''&&Number.isFinite(Number(s))&&Number(s)>0
  const validTrial=(t:FieldTrial)=>[t.surface,t.observation,t.revision].every(s=>s.trim())&&measured(t.distance)&&measured(t.seconds)&&!!t.reached&&!!t.returned
  return [
    {title:'带入已交付实物车的版本与参数',passed:!!a.source},
    {title:'比较任务方案，当前方案通过数字预算',passed:new Set(a.runs.map(r=>r.key)).size>=2&&a.runs.some(r=>r.key===missionKey(a)&&r.result.passed)},
    {title:'现场路线对应当前方案，整车宽与门距实测有余量',passed:a.fieldKey===missionKey(a)&&!!a.routeNotes.trim()&&measured(a.measuredWidth)&&measured(a.gateWidth)&&Number(a.gateWidth)>Number(a.measuredWidth)},
    {title:'两次完整现场尝试，记录调整且至少一次到达、观察并返回',passed:a.trials.length>=2&&a.trials.every(validTrial)&&a.trials.some(t=>t.reached==='yes'&&t.returned==='yes')&&!!a.change.trim()},
    {title:'两张现场证据照片及说明',passed:a.photos.length===2&&a.photos.every(p=>p.caption.trim())},
  ]
}
