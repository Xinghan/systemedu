/** Educational, explicitly synthetic model. mW, seconds, joules, volts. Not a device rating. */
export const RENEWABLE_VERSION = 'wind-solar/1' as const
export type Mode = 'solar' | 'wind' | 'storage' | 'dispatch' | 'station' | 'mission'
export const CASES = { clear: '稳定光风', cloud: '云影经过', calm: '风速下降', demand: '新增负载', missing: '储能读数中断', unit:'接口单位故障复测', front:'首次组合新工况' } as const
export type Scenario = keyof typeof CASES
export type Config = { tilt: number; pitch: number; radius: number; resistance: number; capacitance: number; initialVoltage: number; critical: number; optional: number; pause: number; resume: number; missing: 'critical' | 'off'; control: 'always' | 'hysteresis' | 'forecast'; tracking: boolean; source: 'solar' | 'wind' | 'best'; bore: number; sensorUnit:'V'|'mV' }
export const DEFAULT: Config = { tilt: 25, pitch: 25, radius: 55, resistance: 470, capacitance: .22, initialVoltage: 2.65, critical: 0.7, optional: 7, pause: 2.35, resume: 2.55, missing: 'off', control: 'hysteresis', tracking: false, source: 'best', bore: 2.2, sensorUnit:'mV' }
export const LIMITS = { tilt: [0,85,1], pitch:[5,55,1], radius:[35,65,1], resistance:[100,1500,10], capacitance:[.22,1.5,.01], initialVoltage:[2.2,2.7,.01], critical:[.3,3,.1], optional:[1,15,.5], pause:[2.22,2.5,.01], resume:[2.3,2.68,.01], bore:[2,3,.05] } as const
export const MODES: Record<string,Mode> = { 'catch-a-sunbeam':'solar','tune-a-wind-rotor':'wind','keep-the-beacon-on':'storage','build-a-solar-tracker':'solar','design-a-wind-rotor':'wind','store-energy-for-later':'storage','write-energy-dispatch-rules':'dispatch','build-a-wind-solar-station':'station','run-an-energy-mission':'mission' }
export function validConfig(x: unknown): x is Config {
  if(!x||typeof x!=='object')return false
  const c=x as Config
  return Object.entries(LIMITS).every(([k,[lo,hi]])=>typeof c[k as keyof Config]==='number'&&Number.isFinite(c[k as keyof Config])&&Number(c[k as keyof Config])>=lo&&Number(c[k as keyof Config])<=hi)&&c.pause<c.resume&&['critical','off'].includes(c.missing)&&['always','hysteresis','forecast'].includes(c.control)&&['solar','wind','best'].includes(c.source)&&['mV','V'].includes(c.sensorUnit)&&typeof c.tracking==='boolean'
}
export const stableJSON = (value:unknown):string => JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
export const key = (c: Config) => stableJSON(c)
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x))
const rad=(x:number)=>x*Math.PI/180
// A normalized source/load matching curve, not a panel I–V curve or an MPPT algorithm.
const match=(r:number,opt:number)=>4*r*opt/(r+opt)**2
export function solarPower(c:Config,elevation:number,light:number){return 12*light*Math.max(0,Math.cos(rad(90-elevation-(c.tracking?90-elevation:c.tilt))))*match(c.resistance,470)}
export function windPower(c:Config,speed:number){const cp=.24*Math.exp(-(((c.pitch-27)/20)**2));return .5*1.225*Math.PI*(c.radius/1000)**2*speed**3*cp*.3*1000*match(c.resistance,330)}
export type Point = { t:number; solar:number; wind:number; input:number; voltage:number; load:number; optional:boolean; sensed:number|null; forecast:number }
export type Run = { id:string; at:string; scenario:Scenario; config:Config; mode:Mode; points:Point[]; inputJ:number; loadJ:number; lossJ:number; spillJ:number; startJ:number; endJ:number; alive:number; switches:number; meanPower:number }
export function conditions(t:number,scenario:Scenario){return { elevation:25+t/3, light:scenario==='front'?(t<22?.9:t<96?.08:.45):scenario==='cloud'&&t>=35&&t<85?.12:1, wind:scenario==='front'?(t<40?3.4:1.3):scenario==='calm'&&t>=35?1.1:3.2 } }
/** Integrates at 1 s, records every 3 s; no use of future weather by the controller. */
export function simulate(c:Config,mode:Mode,scenario:Scenario, id='preview',at=''):Run {
  if(!validConfig(c))throw Error('参数超出范围，或恢复阈值不高于暂停阈值。')
  const maxE=.5*c.capacitance*2.7**2,minE=.5*c.capacitance*2.2**2
  let e=.5*c.capacitance*c.initialVoltage**2, on=false,alive=0,loadJ=0,inputJ=0,lossJ=0,spillJ=0,switches=0,last=0
  const startJ=e,points:Point[]=[];let sumPower=0
  for(let t=0;t<120;t++){
    const weather=conditions(t,scenario),solar=solarPower(c,weather.elevation,weather.light),wind=windPower(c,weather.wind)
    const raw=mode==='solar'?solar:mode==='wind'?wind:mode==='storage'?0:c.source==='solar'?solar:c.source==='wind'?wind:Math.max(solar,wind)
    const voltage=Math.sqrt(2*e/c.capacitance),sensed=scenario==='missing'&&t>=40&&t<70?null:voltage*(scenario==='unit'&&c.sensorUnit==='V'?1000:1)
    // One-step forecast uses the previous observation only; learned coefficient is fitted on separate history.
    const forecast=clamp(FORECAST.a*last+FORECAST.b,0,30);last=raw
    const prev:boolean=on
    if(c.control==='always')on=true
    else if(sensed===null)on=false
    else if(sensed<=c.pause)on=false
    else if(sensed>=c.resume)on=true
    if(c.control==='forecast'&&forecast<c.critical+c.optional)on=false
    if(on!==prev)switches++
    let requested=mode==='solar'||mode==='wind'?0:(sensed===null&&c.missing==='off'?0:c.critical+(on?c.optional:0))
    if(scenario==='demand'&&t>=60)requested*=1.7
    const input=raw*.78,conversion=raw-input,tracker=c.tracking&&mode!=='wind'&&mode!=='storage'?.2:0
    const available=Math.max(0,e+input/1000-minE),load=Math.min(requested,Math.max(0,available*1000-tracker))
    const loss=Math.min(tracker,available*1000),unclamped=e+(input-load-loss)/1000,spill=Math.max(0,unclamped-maxE)
    e=clamp(unclamped,minE,maxE);inputJ+=raw/1000;loadJ+=load/1000;lossJ+=(conversion+loss)/1000;spillJ+=spill
    if(load>=c.critical-1e-8&&requested>0)alive++
    sumPower+=raw
    if(t%3===0||t===119)points.push({t:t+1,solar,wind,input:raw,voltage:Math.sqrt(2*e/c.capacitance),load,optional:on,sensed,forecast})
  }
  return {id,at,scenario,config:{...c},mode,points,inputJ,loadJ,lossJ,spillJ,startJ,endJ:e,alive,switches,meanPower:sumPower/120}
}
/** Fixed synthetic history, never presented as measured weather. Chronological split. */
export const HISTORY = Array.from({length:96},(_,i)=>Math.max(0,8+5*Math.sin(i/8)+2*Math.cos(i/3)+(i>=72?-3:0)))
export function fitAR(values:number[]){const xs=values.slice(0,-1),ys=values.slice(1),n=xs.length,mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;const d=xs.reduce((s,x)=>s+(x-mx)**2,0);const a=d?xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/d:0;return{a,b:my-a*mx}}
export const FORECAST=fitAR(HISTORY.slice(0,48))
export function forecastRows(start:number,end:number){return HISTORY.slice(start,end).map((actual,j)=>{const i=start+j,previous=HISTORY[i-1];return{i,actual,baseline:previous,predicted:Math.max(0,FORECAST.a*previous+FORECAST.b)}})}
export function mae(rows:ReturnType<typeof forecastRows>,method:'baseline'|'predicted'){return rows.reduce((s,r)=>s+Math.abs(r.actual-r[method]),0)/rows.length}
export function program(c:Config){return `pause = ${c.pause.toFixed(2)}\nresume = ${c.resume.toFixed(2)}\nmissing = ${c.missing}\ncontrol = ${c.control}`}
export function parseProgram(code:string,c:Config):Config {
  const values:Record<string,string>={};for(const line of code.trim().split('\n')){const m=line.trim().match(/^(pause|resume|missing|control)\s*=\s*([\w.]+)$/);if(!m||values[m[1]])throw Error('每行写一个 pause、resume、missing 或 control；不能重复。');values[m[1]]=m[2]}
  if(Object.keys(values).length!==4)throw Error('需要完整的四行规则。')
  const next={...c,pause:Number(values.pause),resume:Number(values.resume),missing:values.missing,control:values.control} as Config
  if(!validConfig(next))throw Error('pause 必须低于 resume；missing 用 off/critical；control 用 always/hysteresis/forecast。')
  return next
}
export type Photo={id:string;data:string;caption:string;revision:string}
export type Physical={revision:string;material:string;part:string;before:string;change:string;after:string;wiring:string;source:string;csv:string;photos:Photo[]}
export type Frozen={at:string;question:string;target:number;config:Config;first:Run|null;realFirst:string|null;prediction:ReturnType<typeof forecastRows>|null}
export type Workspace={schema:'renewable-energy/1';config:Config;runs:Run[];decision:string;limit:string;hypothesis:string;probes:string[];repair:string;physical:Physical;sources:{project:string;submission:string}[];frozen:Frozen|null;target:number;question:string}
export function fresh(mode?:Mode):Workspace{return{schema:'renewable-energy/1',config:{...DEFAULT,...(mode==='storage'?{control:'always' as const}:{}),...(mode==='station'||mode==='mission'?{sensorUnit:'V' as const}:{})},runs:[],decision:'',limit:'',hypothesis:'',probes:[],repair:'',physical:{revision:'',material:'',part:'',before:'',change:'',after:'',wiring:'',source:'',csv:'',photos:[]},sources:[],frozen:null,target:90,question:''}}
export function validWorkspace(x:unknown):x is Workspace {
  try {
    if(!x||typeof x!=='object')return false
    const a=x as Workspace,p=a.physical
    const runOK=(r:Run)=>!!r&&validConfig(r.config)&&r.scenario in CASES&&Array.isArray(r.points)&&r.points.length<=41&&r.points.every(p=>!!p&&[p.t,p.voltage,p.input,p.load,p.solar,p.wind,p.forecast].every(Number.isFinite))&&[r.startJ,r.endJ,r.inputJ,r.loadJ,r.lossJ,r.spillJ,r.alive,r.meanPower,r.switches].every(Number.isFinite)
    return a.schema==='renewable-energy/1'&&validConfig(a.config)&&Array.isArray(a.runs)&&a.runs.length<=10&&a.runs.every(runOK)&&!!p&&['revision','material','part','before','change','after','wiring','source','csv'].every(k=>typeof p[k as keyof Physical]==='string')&&p.source.length<=16000&&p.csv.length<=6000&&Array.isArray(p.photos)&&p.photos.length<=2&&p.photos.every(f=>typeof f.data==='string'&&f.data.startsWith('data:image/jpeg;base64,')&&f.data.length<=52000&&typeof f.caption==='string'&&typeof f.revision==='string')&&Array.isArray(a.probes)&&a.probes.length<=3&&a.probes.every(p=>['mechanical','electrical','data'].includes(p))&&Array.isArray(a.sources)&&a.sources.length<=4&&a.sources.every(s=>typeof s.project==='string'&&typeof s.submission==='string')&&['decision','limit','hypothesis','repair','question'].every(k=>typeof a[k as keyof Workspace]==='string')&&Number.isFinite(a.target)&&a.target>=1&&a.target<=120&&(a.frozen===null||!!a.frozen&&validConfig(a.frozen.config)&&typeof a.frozen.question==='string'&&Number.isFinite(a.frozen.target)&&(a.frozen.first===null||runOK(a.frozen.first))&&(a.frozen.realFirst===null||typeof a.frozen.realFirst==='string')&&(a.frozen.prediction===null||Array.isArray(a.frozen.prediction)&&a.frozen.prediction.length===24&&a.frozen.prediction.every(r=>[r.i,r.actual,r.baseline,r.predicted].every(Number.isFinite))))
  }catch{return false}
}
/** Keep the original baseline and the first fault alongside recent work. */
export function rememberRun(a:Workspace,run:Run):Workspace {
  const all=[...a.runs,run],pinned=[all[0],all.find(r=>r.scenario==='unit'&&r.config.sensorUnit==='V')].filter((r,i,x):r is Run=>!!r&&x.indexOf(r)===i)
  const remaining=all.filter(r=>!pinned.includes(r)).slice(-(10-pinned.length))
  return {...a,runs:[...pinned,...remaining]}
}
export function csvRows(csv:string){const rows=csv.trim().split(/\r?\n/);if(rows.shift()!=='seconds,voltage,load_ohms,note')throw Error('首行需要 seconds,voltage,load_ohms,note');return rows.map((line,i)=>{const [t,v,r,...note]=line.split(',');const row={t:Number(t),v:Number(v),r:Number(r),note:note.join(',')};if(!t||!v||!r||![row.t,row.v,row.r].every(Number.isFinite)||row.t<0||row.v<0||row.v>5||row.r<=0||!row.note.trim())throw Error(`第 ${i+2} 行：时间≥0，电压 0–5 V，电阻>0，还要有观察。`);return row})}
export function physicalChecks(a:Workspace){let rows:ReturnType<typeof csvRows>=[];try{rows=csvRows(a.physical.csv)}catch{}const p=a.physical;return[{title:'实物证据对应当前设计版本',passed:p.revision===key(a.config)},{title:'打印设置、实购部件和接线记录齐全',passed:[p.material,p.part,p.wiring].every(v=>v.trim().length>=8)},{title:'保留试配前、自己的改动和试配后结果',passed:[p.before,p.change,p.after].every(v=>v.trim().length>=6)},{title:'本人修改的 CAD 或控制程序源文件',passed:p.source.length>=80},{title:'至少 3 个有顺序的实测数据点（不是模拟数据）',passed:rows.length>=3&&rows.every((r,i)=>i===0||r.t>rows[i-1].t)},{title:'两张同版本的装配与测量照片及说明',passed:p.photos.length===2&&p.photos.every(p=>p.revision===a.physical.revision&&p.caption.trim().length>=6)}]}
export function effectiveKey(c:Config,mode:Mode){
  const fields:(keyof Config)[]=mode==='solar'?['tilt','resistance','tracking']:mode==='wind'?['pitch','radius','resistance']:mode==='storage'?['capacitance','initialVoltage','critical','optional','pause','resume','control','missing']:['tilt','pitch','radius','resistance','capacitance','initialVoltage','critical','optional','pause','resume','control','missing','source','tracking']
  return JSON.stringify(fields.map(f=>c[f]))
}
export function checks(id:string,a:Workspace){
  const mode=MODES[id],current=a.runs.filter(r=>key(r.config)===key(a.config))
  const comparison=a.runs.some((r,i)=>a.runs.some((s,j)=>i!==j&&r.scenario===s.scenario&&effectiveKey(r.config,mode)!==effectiveKey(s.config,mode)))
  const base=[{title:'保留同一工况下的两版有效参数对照',passed:comparison},{title:'当前版本已经重新运行',passed:current.length>0},{title:'自己的选择与证据边界',passed:a.decision.trim().length>=10&&a.limit.trim().length>=10}]
  if(mode==='dispatch'||mode==='station'||mode==='mission')base.push({title:'当前规则经过云影、负载变化和缺测测试',passed:['cloud','demand','missing'].every(s=>current.some(r=>r.scenario===s))})
  if(mode==='station'||mode==='mission')base.push(
    {title:'接入自己的前作，或在课内改过光、风和控制设计',passed:a.sources.length>=2||(a.config.tilt!==DEFAULT.tilt&&a.config.pitch!==DEFAULT.pitch&&(a.config.pause!==DEFAULT.pause||a.config.resume!==DEFAULT.resume))},
    {title:'提出假设、检查数据和另一个接口、写出修复依据',passed:a.hypothesis.length>=10&&a.probes.length>=2&&a.probes.includes('data')&&a.repair.length>=10},
    {title:'保留单位修复前的故障结果，并用当前版本修复复测',passed:a.runs.some(r=>r.scenario==='unit'&&r.config.sensorUnit==='V')&&a.config.sensorUnit==='mV'&&current.some(r=>r.scenario==='unit')},
    {title:'当前版本完成减风工况',passed:current.some(r=>r.scenario==='calm')})
  if(mode==='mission')base.push({title:'冻结事前目标并保留首次数字结果与新数据预测',passed:!!a.frozen?.first&&!!a.frozen.prediction},{title:'首次检验后改变有效设计并复测，标为事后探索',passed:!!a.frozen?.first&&effectiveKey(a.config,mode)!==effectiveKey(a.frozen.config,mode)&&current.length>0})
  return base
}
