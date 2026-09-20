import sources from "../../../public/project-lines/space-exploration/_course-assets/sources.json"
import { verifiedDrivingArtifact } from "./guided-progress"

export const SPACE_IDS = ["pick-an-observation-site", "plan-a-payload", "tune-a-chassis", "label-the-terrain", "assemble-a-rover", "run-an-expedition"] as const
export type SpaceId = typeof SPACE_IDS[number]
export type Config = Record<string, string>
export type SpaceTelemetry = { phase: "出发" | "去程" | "观察" | "返程" | "回到基地"; progress: number; energy: number }
export type SpaceRun = { config: Config; scenario: string; result: { passed: boolean; summary: string; values: Record<string, string | number>; steps: string[]; telemetry?: SpaceTelemetry[] }; signature: string }
export type SpaceArtifact = { schema_version: "space-work/1"; project_id: SpaceId; model_version: "space-lab/1"; config: Config; runs: SpaceRun[]; imports: Record<string, Record<string, unknown>> }
export const NAMES: Record<SpaceId, string> = { "pick-an-observation-site":"观察选址", "plan-a-payload":"运载方案", "tune-a-chassis":"越野底盘", "label-the-terrain":"地形样本", "assemble-a-rover":"探测车组装", "run-an-expedition":"火星远征" }
export const SOURCE_IMAGES = sources
export const SAMPLES = sources.slice(0, 9).map((s, i) => ({ ...s, split: i < 6 ? "train" : "test", reference: i < 3 || i === 6 ? "sand" : i === 8 ? "unknown" : "rock" }))
export const SITES = [
  { id:"delta", title:"扇形沉积", imageId:"PIA23386", feature:"扇形边缘和分支纹理", question:"不同分支的宽度是否相同？", distance:8 },
  { id:"dunes", title:"沙丘波纹", imageId:"PIA20755", feature:"重复的弯曲脊线", question:"大波纹之间还存在小波纹吗？", distance:5 },
  { id:"layers", title:"层状露头", imageId:"PIA06323", feature:"一层层明暗交替的边缘", question:"可见层的厚度是否一致？", distance:6 },
]
export const EQUIPMENT = [ {id:"camera",label:"观察相机",mass:3}, {id:"battery",label:"备用电源",mass:4}, {id:"arm",label:"采样机械臂",mass:5}, {id:"antenna",label:"通信天线",mass:2} ]
export const MODEL_NOTE = "教学模型 space-lab/1；数值为课程设定，不用于真实航天器设计或驾驶。"
export function freshArtifact(id: SpaceId): SpaceArtifact {
  const defaults: Record<SpaceId, Config> = {
    "pick-an-observation-site":{site:"delta",x:"50",y:"50",marked:"no"},
    "plan-a-payload":{camera:"yes",battery:"yes",arm:"yes",antenna:"yes"},
    "tune-a-chassis":{clearance:"8",wheel:"20",speed:"1"},
    "label-the-terrain":Object.fromEntries(SAMPLES.filter(s=>s.split==="train").map(s=>[s.id,""])),
    "assemble-a-rover":{chassis:"platform",reader:"platform",rules:"platform"},
    "run-an-expedition":{target:"delta",route:"short",energy:"8",camera:"yes"},
  }
  return {schema_version:"space-work/1",project_id:id,model_version:"space-lab/1",config:defaults[id],runs:[],imports:{}}
}
const same = (a:unknown,b:unknown) => JSON.stringify(a) === JSON.stringify(b)
function validConfig(id:SpaceId,c:Config) {
  if(!c||typeof c!=="object"||Array.isArray(c)||!Object.values(c).every(v=>typeof v==="string"&&v.length<=300))return false
  if(Object.keys(c).sort().join()!==Object.keys(freshArtifact(id).config).sort().join())return false
  switch(id){
    case "pick-an-observation-site":return SITES.some(s=>s.id===c.site)&&["yes","no"].includes(c.marked)&&[c.x,c.y].every(v=>v.trim()!==""&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100)
    case "plan-a-payload":return Object.values(c).every(v=>["yes","no"].includes(v))
    case "tune-a-chassis":return ["8","14","20"].includes(c.clearance)&&["14","20","26"].includes(c.wheel)&&["1","2"].includes(c.speed)
    case "label-the-terrain":return Object.values(c).every(v=>["","sand","rock","unknown"].includes(v))
    case "assemble-a-rover":return Object.values(c).every(v=>["mine","platform"].includes(v))
    case "run-an-expedition":return SITES.some(s=>s.id===c.target)&&["short","safe"].includes(c.route)&&["8","24","40"].includes(c.energy)&&["yes","no"].includes(c.camera)
  }
}
// 签名只定位配置，验收仍逐项重新计算；不把客户端哈希当防篡改凭据。
function signature(value:unknown){let h=2166136261;for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16)}
export function classify(config:Config, features:number[]) {
  const neighbors = SAMPLES.filter(s=>s.split==="train" && ["sand","rock"].includes(config[s.id])).map(s=>({label:config[s.id],distance:Math.hypot(...s.features.map((v,i)=>(v-features[i]) * (i < 2 ? 1 : 4)))})).sort((a,b)=>a.distance-b.distance)
  if (!neighbors.length || neighbors[0].distance > .26) return "unknown"
  // 两个最近样本标签冲突时保留未知；不会用测试参考标签决定预测。
  if (neighbors[1] && neighbors[0].label !== neighbors[1].label && neighbors[1].distance-neighbors[0].distance < .04) return "unknown"
  return neighbors[0].label
}
function core(a:SpaceArtifact) {
  const chassis = a.config.chassis === "mine" ? (a.imports.chassis as unknown as SpaceArtifact)?.config : {clearance:"14",wheel:"20",speed:"1"}
  const rules = a.config.rules === "mine" ? (a.imports.rules?.program as {rules:Record<string,string>})?.rules : {clear:"forward",sand:"slow",rock:"detour",unknown:"stop"}
  const reader = a.config.reader === "mine" ? (a.imports.reader as unknown as SpaceArtifact)?.config : null
  return {chassis,rules,reader}
}
function chain(a:SpaceArtifact, fault:string) {
  const {chassis,rules,reader}=core(a), steps:string[]=[]
  if (!chassis || !rules) return {passed:false,steps:["模块缺失，请重新读取自己的作品。"]}
  const terrains = ["clear","sand","rock"]
  for (let i=0;i<terrains.length;i++) {
    const actual=terrains[i]
    const observed=fault==="camera" && i===1 ? "unknown" : reader && i>0 ? classify(reader,SAMPLES[i===1?6:7].features) : actual
    const action=rules[observed]
    const terrainName:Record<string,string>={clear:"平地",sand:"软沙",rock:"岩石",unknown:"未知"}
    const actions:Record<string,string>={forward:"前进",slow:"慢行",detour:"绕行",stop:"停止"}
    steps.push(`第 ${i+1} 段：真实情景 ${terrainName[actual]} → 感知 ${terrainName[observed]} → 规则 ${actions[action] ?? "无匹配动作"}`)
    if (fault==="motor" && i===1) return {passed:false,steps:[...steps,"执行层：命令已发出，编码器位移为 0；停止并请求检修。"]}
    if (action==="stop") return {passed:false,steps:[...steps,"车辆停止，未抵达观察点；信息不足时停止是合理结果。"]}
    if (actual==="sand" && action!=="slow") return {passed:false,steps:[...steps,"软沙快行打滑：需要检查识别结果和规则映射。"]}
    if (actual==="rock" && (action!=="detour" || Number(chassis.clearance)<12)) return {passed:false,steps:[...steps,"未能通过岩石侧道：需要绕行且教学离地间隙至少 12 cm。"]}
    steps.push(`执行层：第 ${i+1} 段通过，位移 +1 个教学路段。`)
  }
  return {passed:true,steps:[...steps,"抵达观察点，完成短途行动链。"]}
}
export function runSpace(a:SpaceArtifact, scenario="normal"):SpaceRun {
  const c=a.config, values:Record<string,string|number>={}, steps:string[]=[]
  let telemetry:SpaceTelemetry[]|undefined
  let passed=false, summary=""
  switch(a.project_id) {
    case "pick-an-observation-site": {
      const site=SITES.find(s=>s.id===c.site)
      passed=!!site && c.marked==="yes" && Number(c.x)>=0 && Number(c.x)<=100 && Number(c.y)>=0 && Number(c.y)<=100
      summary=passed?"影像标记已记录，请结合另一个地点作比较。":"请先在影像上标记一处特征。"
      values["候选地点"]=site?.title??"未选择"; values["来源影像"]=site?.imageId??""; values["图内坐标"]=`${c.x}%, ${c.y}%`
      steps.push(`影像 ${site?.imageId}，标记为图内相对位置，不是火星经纬度。`, `虚拟目标 ${site?.id}：模型单程 ${site?.distance} 格，来自课程设定，与真实距离无关。`)
      break
    }
    case "plan-a-payload": {
      const mass=EQUIPMENT.reduce((n,e)=>n+(c[e.id]==="yes"?e.mass:0),0), margin=12-mass
      passed=c.camera==="yes" && c.battery==="yes" && margin>=2
      summary=passed?"观察装备齐备，保留至少 2 kg 教学余量。":margin<2?"超过含余量的预算，请作一次装备取舍。":"观察任务需要相机和电源。"
      Object.assign(values,{"设备合计 kg":mass,"教学上限 kg":12,"余量 kg":margin})
      EQUIPMENT.forEach(e=>steps.push(`${e.label}：${c[e.id]==="yes"?e.mass+" kg":"未装载"}`)); steps.push("本次只核对质量预算，不模拟发射成功率。")
      break
    }
    case "tune-a-chassis": {
      const clearance=Number(c.clearance), wheel=Number(c.wheel), speed=Number(c.speed)
      const obstacle=scenario==="soft"?6:12
      passed=[8,14,20].includes(clearance)&&[14,20,26].includes(wheel)&&[1,2].includes(speed)&&clearance>=obstacle&&wheel>=20&&speed===1
      summary=passed?"同路段三项约束通过。":"车辆在当前路段受阻，展开记录定位原因。"
      Object.assign(values,{"离地间隙 cm":clearance,"轮径 cm":wheel,"教学速度档":speed,"障碍高度 cm":obstacle,"能耗点":Math.round(4+wheel/2+clearance/2+speed*3)})
      steps.push(clearance>=obstacle?"底盘未触及障碍。":"底盘触及障碍。",wheel>=20?"轮径达到教学路段要求。":"轮径不足以通过本路段。",speed===1?"低速通过软沙段。":"高速软沙段打滑。", "增大轮径或间隙也增加模型能耗；这里不是连续物理仿真。")
      break
    }
    case "label-the-terrain": {
      const complete=SAMPLES.filter(s=>s.split==="train").every(s=>["sand","rock","unknown"].includes(c[s.id]))
      passed=complete && Object.values(c).includes("sand") && Object.values(c).includes("rock")
      let correct=0
      SAMPLES.filter(s=>s.split==="test").forEach(s=>{const prediction=classify(c,s.features);if(prediction===s.reference)correct++;steps.push(`${s.id}：预测 ${prediction} / 课程复核标签 ${s.reference}；${prediction===s.reference?"一致":"待讨论"}`)})
      Object.assign(values,{"训练样本":6,"独立测试影像":3,"参考一致数":correct,"特征":"灰度均值、标准差、横向与纵向变化"})
      summary=passed?"已用独立影像测试；错误与未知也是必须保留的证据。":"请完成 6 个标签，至少给出一个沙纹样本和一个岩层样本。"
      break
    }
    case "assemble-a-rover": {
      const result=chain(a,scenario);passed=result.passed; steps.push(...result.steps)
      Object.assign(values,{"底盘":c.chassis==="mine"?"我的作品":"平台提供","识别器":c.reader==="mine"?"我的作品":"平台提供","规则":c.rules==="mine"?"我的作品":"平台提供","故障":scenario})
      summary=passed?"感知、规则与底盘已接通，抵达观察点。":"运行已停止，请沿行动链定位。"
      break
    }
    case "run-an-expedition": {
      const rover=a.imports.rover as unknown as SpaceArtifact|undefined, site=SITES.find(s=>s.id===c.target)??SITES[0]
      const payload=a.imports.payload as unknown as SpaceArtifact|undefined
      const usableCamera=payload?payload.config.camera==="yes":c.camera==="yes"
      const outward=rover?chain(rover,"normal"):{passed:false,steps:["尚未读取自己的已交付探测车。"]}
      const factor=c.route==="safe"?1:2, segments=site.distance+(c.route==="safe"?2:0), required=segments*2*factor+2
      const budget=Number(c.energy), left=budget-required
      passed=outward.passed&&usableCamera&&left>=2
      Object.assign(values,{"目标":site.title,"往返路段":segments*2,"能耗点":required,"初始能量点":budget,"返航余量点":left})
      steps.push("出发前复核探测车的短途行动链：",...outward.steps, `预算：去程 ${segments} 格，${c.route==="safe"?"绕行缓坡每格 1 点":"捷径软沙每格 2 点"}；观察 2 点；返程同距离。`)
      telemetry=[]
      if(passed){
        telemetry.push({phase:"出发",progress:0,energy:budget})
        for(let i=1;i<=segments;i++)telemetry.push({phase:"去程",progress:i/segments,energy:budget-i*factor})
        telemetry.push({phase:"观察",progress:1,energy:budget-segments*factor-2})
        for(let i=1;i<=segments;i++)telemetry.push({phase:i===segments?"回到基地":"返程",progress:1-i/segments,energy:budget-segments*factor-2-i*factor})
        steps.push("模型执行获准：在虚拟目标保留一张模拟观察帧；不是真实火星照片。",`返回基地，保留 ${left} 点余量。逐步回放记录每格位置与模拟能量。`)
      }else steps.push(!outward.passed?"车辆复核未通过，远征未出发。":!usableCamera?"相机缺失，远征未出发。":"往返预算不足，远征未出发；未产生观察帧或完成轨迹。")
      summary=passed?"完成出发、观察与返回，保留了返航余量。":"任务未完成，检查车辆、装备和往返预算。"
      break
    }
  }
  const result={passed,summary,values,steps,...(telemetry?{telemetry}:{})}
  return {config:JSON.parse(JSON.stringify(c)),scenario,result,signature:signature({version:a.model_version,project:a.project_id,config:c,imports:a.imports,scenario})}
}
export function checkedArtifact(value:unknown,id?:SpaceId):value is SpaceArtifact {
  if (!value||typeof value!=="object")return false
  const a=value as SpaceArtifact
  if(a.schema_version!=="space-work/1"||a.model_version!=="space-lab/1"||!SPACE_IDS.includes(a.project_id)||id&&a.project_id!==id||!validConfig(a.project_id,a.config)||!a.imports||typeof a.imports!=="object"||Array.isArray(a.imports)||!Array.isArray(a.runs)||a.runs.length>30)return false
  // 输入只允许从较早的课程流向后续课程，限制递归深度与伪造模块。
  const allowed:Record<string,SpaceId> = a.project_id==="assemble-a-rover"?{chassis:"tune-a-chassis",reader:"label-the-terrain"}:a.project_id==="run-an-expedition"?{rover:"assemble-a-rover",mission:"pick-an-observation-site",payload:"plan-a-payload"}:{}
  for(const [key,input] of Object.entries(a.imports)){
    if(key==="rules"&&a.project_id==="assemble-a-rover"){if(!verifiedDrivingArtifact(input))return false}
    else if(!allowed[key]||!checkedArtifact(input,allowed[key])||!artifactChecks(input).every(c=>c.passed))return false
  }
  if(a.project_id==="assemble-a-rover"&&["chassis","reader","rules"].some(k=>a.config[k]==="mine"&&!a.imports[k]))return false
  try{return a.runs.every(r=>r&&validConfig(a.project_id,r.config)&&["normal","ridge","soft","camera","motor"].includes(r.scenario)&&same(r,runSpace({...a,config:r.config},r.scenario)))}catch{return false}
}
export function artifactChecks(a:SpaceArtifact):{title:string;passed:boolean}[] {
  const current=a.runs.filter(r=>same(r.config,a.config)), last=current.at(-1)
  const distinct=new Set(a.runs.map(r=>JSON.stringify(r.config))).size>=2
  switch(a.project_id){
    case "pick-an-observation-site":return [{title:"比较至少两个来源影像并留下标记",passed:new Set(a.runs.filter(r=>r.result.passed).map(r=>r.config.site)).size>=2},{title:"当前选址有可回看的图内标记",passed:!!last?.result.passed}]
    case "plan-a-payload":return [{title:"保留两版装备的预算核对",passed:distinct},{title:"当前相机、电源齐备且余量至少 2 kg",passed:!!last?.result.passed}]
    case "tune-a-chassis":return [{title:"同一路段仅改变一个参数进行对照",passed:a.runs.some((r,i)=>a.runs.slice(i+1).some(s=>r.scenario===s.scenario&&Object.keys(r.config).filter(k=>r.config[k]!==s.config[k]).length===1))},{title:"当前底盘在岩石路段通过",passed:current.some(r=>r.scenario==="ridge"&&r.result.passed)}]
    case "label-the-terrain":return [{title:"6 个训练标签和两类样本齐备",passed:!!last?.result.passed},{title:"当前标签版本已用三张独立影像测试",passed:!!last&&last.result.steps.length===3}]
    case "assemble-a-rover":return [{title:"至少接入一个已验收的自制核心模块",passed:["chassis","reader","rules"].some(k=>a.config[k]==="mine"&&!!a.imports[k])},{title:"当前组合抵达观察点",passed:current.some(r=>r.scenario==="normal"&&r.result.passed)},{title:"同一组合实际执行故障注入并停止",passed:current.some(r=>["camera","motor"].includes(r.scenario)&&!r.result.passed)}]
    case "run-an-expedition":return [{title:"使用自己的已验收探测车",passed:!!a.imports.rover},{title:"保留一次方案修订前后的证据",passed:distinct},{title:"当前方案完成观察与返航，余量至少 2 点",passed:!!last?.result.passed}]
  }
}
export function addRun(a:SpaceArtifact,scenario:string):SpaceArtifact { return {...a,runs:[...a.runs.slice(-29),runSpace(a,scenario)]} }
