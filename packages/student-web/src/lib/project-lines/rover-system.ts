// 有限课堂模型与实物证据完整性核对；不充当设备认证或学习评分。
export const ROVER_VERSION = "2.0"
export const DEFAULT_DESIGN = { wheel:"large", battery:"compact", deck:"light", pace:"fast", route:"direct", width:"100", thickness:"3", sand:"forward", unknown:"forward", perception:"camera", controller:"terrain", actuator:"" } as const
export type RoverDesign = { [K in keyof typeof DEFAULT_DESIGN]: string }
export type RunMode = "training" | "transfer" | "diagnostic"
export type Probe = "camera" | "decision" | "motor"
export type Diagnosis = { caseId:"A7"|"B4"|"C9"; probes:Probe[]; hypothesis:string; repair:string }
export type SystemRun = { design:RoverDesign; mode:RunMode; diagnosis:Diagnosis; result:ReturnType<typeof simulateRover> }
export type PhysicalTest = { id:string; kind:"straight"|"turn"|"stop"; target:string; measured:string; surface:string; revision:string; note:string }
export type EvidencePhoto = { id:string; caption:string; data:string }
export type PhysicalEvidence = { designKey:string; cadSource:string; controlSource:string; width:string; material:string; fitBefore:string; fitAfter:string; cadChange:string; board:string; motor:string; supply:string; codeChange:string; adultChecked:boolean; tests:PhysicalTest[]; photos:EvidencePhoto[] }
export type RoverSystem = { schema_version:"rover-system/2"; design:RoverDesign; diagnosis:Diagnosis; runs:SystemRun[]; sources:Record<string,string>; physical:PhysicalEvidence }
export const EMPTY_PHYSICAL:PhysicalEvidence = {designKey:"",cadSource:"",controlSource:"",width:"",material:"",fitBefore:"",fitAfter:"",cadChange:"",board:"",motor:"",supply:"",codeChange:"",adultChecked:false,tests:[],photos:[]}
export function newRoverSystem():RoverSystem {return {schema_version:"rover-system/2",design:{...DEFAULT_DESIGN},diagnosis:{caseId:"A7",probes:[],hypothesis:"",repair:""},runs:[],sources:{},physical:JSON.parse(JSON.stringify(EMPTY_PHYSICAL))}}
const choices:Record<keyof RoverDesign,readonly string[]>={wheel:["small","large"],battery:["compact","extended"],deck:["light","reinforced"],pace:["slow","fast"],route:["direct","detour"],width:["100","120"],thickness:["3","4"],sand:["forward","slow"],unknown:["forward","stop"],perception:["","camera","battery"],controller:["","terrain","camera"],actuator:["","action","battery"]}
export function validDesign(d:unknown):d is RoverDesign {if(!d||typeof d!=="object"||Array.isArray(d))return false;const v=d as RoverDesign;return Object.keys(v).length===Object.keys(choices).length&&Object.entries(choices).every(([k,values])=>values.includes(v[k as keyof RoverDesign]))}
export function designBudget(d:RoverDesign){
  const mass=160+(d.wheel==="large"?65:30)+(d.battery==="extended"?120:50)+(d.deck==="reinforced"?100:50)+(d.width==="120"?10:0)+(d.thickness==="4"?10:0)
  const capacity=d.battery==="extended"?74:42,limit=d.deck==="reinforced"?480:330
  return {mass,capacity,limit,cost:3+(d.wheel==="large"?2:0)+(d.battery==="extended"?1:0)+(d.deck==="reinforced"?1:0)+(d.pace==="fast"?3:0)}
}
const faults={A7:"camera",B4:"controller",C9:"motor"} as const
const repairs={camera:"reconnect",controller:"restore-stop",motor:"reseat-motor"} as const
export const PROBE_NAMES:Record<Probe,string>={camera:"查看相机输入",decision:"追踪判断与命令",motor:"检查驱动反馈"}
export const REPAIR_NAMES:Record<string,string>={reconnect:"重新连接相机数据线","restore-stop":"恢复未知时停止的分支","reseat-motor":"断电后重新连接电机端子"}
export function probeResult(d:Diagnosis,p:Probe){
  const fault=faults[d.caseId]
  return p==="camera"?(fault==="camera"?"连续三次输入为空，时间戳没有更新。":"图像输入持续更新，路面标签为未知。"):
    p==="decision"?(fault==="controller"?"判断层收到未知，仍发出前进命令。":"判断层按停止分支工作；先前前进命令格式有效。"):
    fault==="motor"?"先前发出前进命令，但驱动没有位移反馈。":"前次命令有位移反馈，当前停止时位移为零。"
}
export function simulateRover(d:RoverDesign,mode:RunMode,diagnosis:Diagnosis){
  const b=designBudget(d),issues:string[]=[],steps:string[]=[]
  const segments=(mode==="transfer"?8:5)+(d.route==="detour"?3:0),spent=segments*b.cost+4
  if(d.perception!=="camera")issues.push("感知模块没有收到相机数据。")
  if(d.controller!=="terrain")issues.push("判断模块需要地形标签，不能直接接图像或电源。")
  if(d.actuator!=="action")issues.push("驱动模块尚未接到动作命令。")
  if(b.mass>b.limit)issues.push(`设计质量 ${b.mass} g 超出结构教学限值 ${b.limit} g。`)
  if(d.sand!=="slow"||d.pace!=="slow")issues.push("软沙区的前进速度过快，模型记录到打滑。")
  if(d.unknown!=="stop")issues.push("看不清地面时仍前进，停止条件未满足。")
  if(d.wheel==="small"&&d.route==="direct")issues.push("小轮无法直接越过本路线凸起，可以改轮子或绕路。")
  if(mode==="transfer"&&d.width==="120")issues.push("新路线包含 110 mm 窄门，120 mm 设计无法通过。")
  if(b.capacity-spent<2)issues.push(`往返需 ${spent} 点，当前容量 ${b.capacity} 点，无法保留 2 点余量。`)
  let faultResolved=true
  if(mode==="diagnostic"){
    faultResolved=diagnosis.hypothesis===faults[diagnosis.caseId]&&diagnosis.repair===repairs[faults[diagnosis.caseId]]&&new Set(diagnosis.probes).size>=2
    if(!faultResolved)issues.push("测试站出现异常：观察任务未完成。请采集证据后判断，再执行有依据的修复。")
  }
  steps.push(`相机数据 → ${d.perception==="camera"?"感知模块":"连接待检查"} → ${d.controller==="terrain"?"地形判断":"连接待检查"} → ${d.actuator==="action"?"驱动命令":"驱动未连接"}`)
  steps.push(`结构：${b.mass}/${b.limit} g；电量：${b.capacity} 点；${segments} 段 × ${b.cost} 点 + 观察 4 点。`)
  if(!issues.length)steps.push("平地：前进；软沙：慢行；未知：停止确认后继续。",d.route==="detour"?"绕开凸起，增加三个路段。":"大轮通过凸起。",`完成模型任务，余量 ${b.capacity-spent} 点。`)
  else steps.push(...issues)
  return {passed:issues.length===0,issues,steps,mass:b.mass,limit:b.limit,capacity:b.capacity,spent,remaining:b.capacity-spent,segments,faultResolved}
}
export function runSystem(a:RoverSystem,mode:RunMode):RoverSystem {const run={design:{...a.design},mode,diagnosis:structuredClone(a.diagnosis),result:simulateRover(a.design,mode,a.diagnosis)};return {...a,runs:[...a.runs.slice(-19),run]}}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
export function prototypeChecks(a:RoverSystem){
  const current=a.runs.filter(r=>same(r.design,a.design))
  return [
    {title:"自己接通感知、判断与驱动",passed:a.design.perception==="camera"&&a.design.controller==="terrain"&&a.design.actuator==="action"},
    {title:"完成至少两项会影响结果的设计修改",passed:Object.keys(DEFAULT_DESIGN).filter(k=>!['perception','controller','actuator'].includes(k)&&a.design[k as keyof RoverDesign]!==DEFAULT_DESIGN[k as keyof RoverDesign]).length>=2},
    {title:"保留方案对比，当前设计通过训练路线",passed:new Set(a.runs.map(r=>JSON.stringify(r.design))).size>=2&&current.some(r=>r.mode==="training"&&r.result.passed)},
    {title:"用至少两种检查定位异常，并保留修复前后结果",passed:current.some(r=>r.mode==="diagnostic"&&!r.result.faultResolved&&r.diagnosis.caseId===a.diagnosis.caseId)&&current.some(r=>r.mode==="diagnostic"&&r.result.passed&&same(r.diagnosis,a.diagnosis))},
    {title:"同一版设计通过新路线",passed:current.some(r=>r.mode==="transfer"&&r.result.passed)},
  ]
}
function text(v:unknown,max=800):v is string{return typeof v==="string"&&v.length<=max}
export function validPhysical(p:unknown):p is PhysicalEvidence{
  if(!p||typeof p!=="object")return false;const x=p as PhysicalEvidence
  return ['designKey','width','material','fitBefore','fitAfter','cadChange','board','motor','supply','codeChange'].every(k=>text(x[k as keyof PhysicalEvidence]))&&text(x.cadSource,16000)&&text(x.controlSource,16000)&&typeof x.adultChecked==='boolean'&&Array.isArray(x.tests)&&x.tests.length<=12&&x.tests.every(t=>t&&['straight','turn','stop'].includes(t.kind)&&['id','target','measured','surface','revision','note'].every(k=>text(t[k as keyof PhysicalTest])))&&Array.isArray(x.photos)&&x.photos.length<=2&&x.photos.every(p=>text(p.id,80)&&text(p.caption,300)&&text(p.data,60000)&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(p.data))
}
export function physicalChecks(p:PhysicalEvidence,design?:RoverDesign){
  const filled=(k:keyof PhysicalEvidence)=>typeof p[k]==='string'&&(p[k] as string).trim().length>0
  return [
    {title:"实测对应已冻结的当前设计",passed:!!p.designKey&&(!design||p.designKey===JSON.stringify(design))},
    {title:"自己的打印件修改、试配前后尺寸和材料记录",passed:['width','material','fitBefore','fitAfter','cadChange'].every(k=>filled(k as keyof PhysicalEvidence))&&Number(p.width)>0&&Number.isFinite(Number(p.width))},
    {title:"修改后的 CAD 源文件与控制程序已附入作品",passed:p.cadSource.trim().length>0&&p.controlSource.trim().length>0},
    {title:"实物器件、供电、程序修改及成人通电检查",passed:['board','motor','supply','codeChange'].every(k=>filled(k as keyof PhysicalEvidence))&&p.adultChecked},
    {title:"记录前进、转向、触碰停止，每项至少一次达到自检目标",passed:['straight','turn','stop'].every(kind=>p.tests.some(t=>t.kind===kind&&[t.target,t.measured,t.surface,t.revision,t.note].every(s=>s.trim())&&Number.isFinite(Number(t.target))&&Number(t.target)>0&&Number.isFinite(Number(t.measured))&&Number(t.measured)>=0&&(kind==='straight'?Number(t.target)>=30&&Math.abs(Number(t.measured)-Number(t.target))<=Number(t.target)*.2:kind==='turn'?Number(t.target)===90&&Math.abs(Number(t.measured)-90)<=30:Number(t.target)<=10&&Number(t.measured)<=Number(t.target))))},
    {title:"两张实物证据照片及对应说明",passed:p.photos.length===2&&p.photos.every(f=>f.caption.trim())},
  ]
}
export function isRoverSystem(v:unknown):v is RoverSystem{
  try{
    if(!v||typeof v!=='object')return false;const a=v as RoverSystem,d=a.diagnosis
    return a.schema_version==='rover-system/2'&&validDesign(a.design)&&!!d&&['A7','B4','C9'].includes(d.caseId)&&Array.isArray(d.probes)&&d.probes.length<=3&&d.probes.every(p=>['camera','decision','motor'].includes(p))&&text(d.hypothesis,30)&&text(d.repair,30)&&!!a.sources&&typeof a.sources==='object'&&!Array.isArray(a.sources)&&Object.keys(a.sources).length<=3&&Object.values(a.sources).every(s=>text(s,500))&&validPhysical(a.physical)&&Array.isArray(a.runs)&&a.runs.length<=20&&a.runs.every(r=>validDesign(r.design)&&['training','transfer','diagnostic'].includes(r.mode)&&r.diagnosis&&['A7','B4','C9'].includes(r.diagnosis.caseId)&&Array.isArray(r.diagnosis.probes)&&r.diagnosis.probes.length<=3&&r.diagnosis.probes.every(p=>['camera','decision','motor'].includes(p))&&same(r.result,simulateRover(r.design,r.mode,r.diagnosis)))
  }catch{return false}
}
export function isPhysicalRover(v:unknown):v is RoverSystem{return isRoverSystem(v)&&prototypeChecks(v).every(c=>c.passed)&&physicalChecks(v.physical,v.design).every(c=>c.passed)}

// 当前尺寸的源文件，孩子可在 OpenSCAD 中继续改变开孔、固定方式和结构。
export function roverCAD(d:RoverDesign){return `// SystemEdu 桌面探测车 2.0，单位 mm；未做实机制造验证。\n// part: deck / strap / bumper / coupon。先打印 coupon 试配。\npart="deck";\nwidth=${d.width}; length=150; thickness=${d.thickness}; hole=3.4;\n$fn=48;\nmodule deck(){difference(){translate([-width/2,-length/2,0])cube([width,length,thickness]);for(x=[-width/2+12,width/2-12])for(y=[-55,-35,0,35,55])translate([x,y,-1])cylinder(h=thickness+2,d=hole);for(x=[-width/2+8,width/2-8])for(y=[-43,-25])translate([x-2,y-5,-1])cube([4,10,thickness+2]);for(x=[-20,20])translate([x-2,10,-1])cube([4,28,thickness+2]);}}\nmodule strap(){difference(){cube([32,12,3]);for(x=[4,28])translate([x,6,-1])cylinder(h=5,d=hole);}}\nmodule bumper(){union(){cube([width-16,12,3]);translate([0,9,0])cube([width-16,3,16]);}}\nmodule coupon(){difference(){cube([60,16,3]);for(i=[0:4])translate([8+i*11,8,-1])cylinder(h=5,d=3+i*0.2);}}\nif(part=="deck")deck();else if(part=="strap")strap();else if(part=="bumper")bumper();else coupon();\n`}
