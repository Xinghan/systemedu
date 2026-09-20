"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Circle, FlaskConical, Package, Play } from "lucide-react"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { learningRecords, type LearningScope, type LearningBody } from "@/lib/api/learning-records"
import { learningCacheKey } from "@/lib/learning-record-session"
import type { GuidedCourse, GuidedModule } from "@/lib/project-lines/guided-course"
import { deliveryScope } from "@/lib/project-lines/driving-delivery"
import { verifiedDrivingArtifact } from "@/lib/project-lines/guided-progress"
import { SPACE_IDS, NAMES, SOURCE_IMAGES, SITES, SAMPLES, EQUIPMENT, MODEL_NOTE, freshArtifact, checkedArtifact, artifactChecks, addRun, type SpaceId, type SpaceArtifact, type SpaceRun } from "@/lib/project-lines/space-models"
import { LearningRecordStatus } from "./learning-record-status"
import styles from "./space-project-workspace.module.css"
import delivery from "./guided-final-delivery.module.css"

export function workScope(id:SpaceId):LearningScope { return {library_slug:id,module_id:"WORK",activity_id:"workbench",kind:"classroom",content_version:"1.0"} }
const explanations=["我作出的关键选择","证据支持什么，还不能证明什么","我制作与平台提供的部分"]
const emptyAnswers=explanations.map((question,i)=>({question_id:`explain${i+1}`,question,answer:""}))

function SiteImage({artifact,onChange,readOnly=false}:{artifact:SpaceArtifact;onChange?:(x:number,y:number)=>void;readOnly?:boolean}) {
  const site=SITES.find(s=>s.id===artifact.config.site)??SITES[0], image=SOURCE_IMAGES.find(s=>s.id===site.imageId)!
  return <figure className={styles.sourceFigure}><div className={styles.imageArea} style={{aspectRatio:`${image.width} / ${image.height}`,maxWidth:`${420*image.width/image.height}px`,margin:"0 auto"}}>
    {/* 官方观测影像，不使用概念封面作为证据。 */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={image.image} alt={`${site.title}，来源 ${image.id}`} />
    {!readOnly&&<button className={styles.markLayer} aria-label="在影像上标记特征" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onChange?.(Math.round((e.clientX-r.left)/r.width*100),Math.round((e.clientY-r.top)/r.height*100))}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onChange?.(50,50)}}}/>}
    {artifact.config.marked==="yes"&&<span className={styles.marker} style={{left:artifact.config.x+"%",top:artifact.config.y+"%"}}>1</span>}
  </div><figcaption><a href={image.url} target="_blank" rel="noreferrer">{image.id} · NASA/JPL · 查看来源及完整署名</a><span>图内标记，不是经纬度；各图比例尺不同。</span></figcaption></figure>
}

function SourceImage({source,description}:{source:typeof SOURCE_IMAGES[number];description:string}) {
  const modal=useRef<HTMLDialogElement>(null), title=useId(),[zoom,setZoom]=useState(false)
  return <><button type="button" className={styles.imageButton} aria-label={`放大查看 ${source.id}`} onClick={()=>{setZoom(false);modal.current?.showModal()}}>
    {/* 原始科学影像保留比例，可在弹窗中放大观察。 */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={source.image} alt={`${description} ${source.id}`} loading="lazy"/><span>放大观察</span>
  </button><dialog ref={modal} className={styles.imageDialog} aria-labelledby={title}>
    <header><h4 id={title}>{description} · {source.id}</h4><button type="button" onClick={()=>modal.current?.close()}>关闭影像</button></header>
    <div className={styles.imageViewport} data-zoom={zoom}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source.image} alt={description}/>
    </div><footer><button type="button" onClick={()=>setZoom(!zoom)}>{zoom?"查看全图":"放大细节"}</button><span>{zoom?"可横向和纵向滚动，观察局部纹理。":"完整影像；不同图片的比例尺不相同。"}</span><a href={source.url} target="_blank" rel="noreferrer">原始来源及署名</a></footer>
  </dialog></>
}

const scenarioNames:Record<string,string>={normal:"正常条件",ridge:"岩石路段",soft:"低障碍路段",camera:"相机丢失",motor:"电机停转"}
function currentRun(artifact:SpaceArtifact){return artifact.runs.findLast(r=>JSON.stringify(r.config)===JSON.stringify(artifact.config))}

function MissionMap({artifact}:{artifact:SpaceArtifact}) {
  const run=currentRun(artifact), target=artifact.config.target??"delta", position=target==="dunes"?[310,230]:target==="layers"?[420,120]:[430,260]
  const key=useId(),soil=`soil-${key}`,grid=`grid-${key}`
  const safe=artifact.config.route==="safe", track=safe?`M80 280 L150 180 L260 115 L${position[0]} ${position[1]}`:`M80 280 L${position[0]} ${position[1]}`
  return <div className={styles.missionMap}><svg viewBox="0 0 560 360" role="img" aria-label="由当前任务配置绘制的虚拟远征路线与观测点">
    <defs><linearGradient id={soil} x2="0" y2="1"><stop stopColor="#c79b76"/><stop offset="1" stopColor="#744a34"/></linearGradient><pattern id={grid} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ead4b4" strokeWidth=".5" opacity=".3"/></pattern></defs>
    <rect width="560" height="360" rx="12" fill={`url(#${soil})`}/><rect width="560" height="360" fill={`url(#${grid})`}/>
    {[0,1,2,3,4,5,6].map(i=><path key={i} d={`M${260+i*13} 310q-40 -65 10 -125t-25 -100`} fill="none" stroke="#d6b790" opacity=".45" strokeWidth="5"/>)}
    {[0,1,2,3,4].map(i=><path key={i} d={`M${410+i*14} ${75+i*8}l40 20 -20 25 -30 -8Z`} fill="#4c3b30" opacity=".35" stroke="#d6b790"/>)}
    <path d={track} stroke="#f8e8c4" strokeWidth="3" fill="none" strokeDasharray={run?.result.passed?undefined:"8 6"}/><path d={track} transform="translate(5 7)" stroke="#a7c9ba" strokeWidth="2" fill="none" strokeDasharray="3 5"/>
    <rect x="64" y="266" width="32" height="25" rx="3" fill="#e5e1d3"/><path d="M80 266v-18m-8 0h16" stroke="#e5e1d3" strokeWidth="3"/><circle cx={position[0]} cy={position[1]} r="18" fill="none" stroke="#fbe6bb" strokeWidth="2"/><circle cx={position[0]} cy={position[1]} r="4" fill="#fbe6bb"/>
    <g fill="#fff4e1" fontSize="13"><text x="32" y="36">远征教学地图 / 非真实火星坐标</text><text x="50" y="320">基地</text><text x="370" y="320">{SITES.find(s=>s.id===target)?.title}</text><text x="32" y="62">{run?.result.passed?"此配置已完成往返核对":"配置预览 · 运行后查看实际日志"}</text></g>
  </svg><p>实线为去程方案，点线为返程方案。日志未通过时不计为完成轨迹。</p></div>
}

function ExpeditionReplay({run}:{run:SpaceRun}) {
  const [index,setIndex]=useState(0),frames=run.result.telemetry??[],frame=frames[Math.min(index,frames.length-1)],key=useId()
  if(!frame)return null
  const target=SITES.find(s=>s.id===run.config.target)!, atTarget=frame.progress===1
  return <div className={styles.replay} data-expedition-replay><h4>这一次的逐步回放</h4>
    <div className={styles.replayRail}><span style={{left:`${frame.progress*100}%`}} aria-hidden="true"><Package size={20}/></span></div>
    <div className={styles.replayLabels}><span>基地</span><span>{target.title}</span></div>
    <label className={styles.field}>第 {index+1} / {frames.length} 帧 · {frame.phase} · 剩余 {frame.energy} 点<input aria-label="远征回放进度" type="range" min="0" max={frames.length-1} value={index} onChange={e=>setIndex(Number(e.target.value))}/></label>
    <p>拖动查看每格的位置和能量。全部帧由保存的参数重新计算；这是教学模型回放。</p>
    {atTarget&&<figure className={styles.observationFrame} data-observation-frame><svg viewBox="0 0 640 300" role="img" aria-label={`${target.title}的模拟观察帧`}>
      <defs><linearGradient id={`frame-${key}`} x2="0" y2="1"><stop stopColor="#b1886f"/><stop offset=".44" stopColor="#dcc0a1"/><stop offset="1" stopColor="#845337"/></linearGradient></defs>
      <rect width="640" height="300" fill={`url(#frame-${key})`}/><path d="M0 140L48 121 82 132 138 105 215 123 302 101 386 130 441 114 512 140 576 110 640 128V300H0Z" fill="#a88163"/>
      {run.config.target==="dunes"?Array.from({length:16},(_,i)=><path key={i} d={`M-40 ${150+i*12}Q150 ${75+i*11} 345 ${162+i*12}T690 ${110+i*16}`} fill="none" stroke={i%2?"#ead0a6":"#6f4937"} strokeWidth={i%2?2:6} opacity=".6"/>):run.config.target==="layers"?Array.from({length:12},(_,i)=><path key={i} d={`M120 ${245-i*8}L192 ${180-i*8} 470 ${166-i*5} 560 ${251-i*5}Z`} fill={i%2?"#b08766":"#78523c"} stroke="#d0ac85" strokeWidth="1.5"/>):Array.from({length:12},(_,i)=><path key={i} d={`M300 130Q${185+i*18} 183 ${30+i*54} 290`} fill="none" stroke={i%2?"#684332":"#d4b18a"} strokeWidth={i%2?7:3} opacity=".75"/>)}
      <g stroke="#fff1d8" strokeWidth="1" fill="none" opacity=".8"><path d="M22 48V22H52M588 22H618V48M22 252V278H52M588 278H618V252M306 150H334M320 136V164"/></g><text x="36" y="46" fill="#fff1d8" fontSize="12">模拟观察帧 / {target.title}</text><text x="36" y="262" fill="#fff1d8" fontSize="12">{run.config.route==="safe"?"缓坡路线":"捷径路线"} · 教学能量 {frame.energy} 点</text>
    </svg><figcaption>依据你的目标绘制的教学场景，不是 NASA 原图或真实相机照片。观察帧随作品参数一并保存。</figcaption></figure>}
  </div>
}

function ArtifactView({artifact,showMedia=true}:{artifact:SpaceArtifact;showMedia?:boolean}) {
  return <div className={styles.artifactView} data-space-artifact-preview>
    {showMedia&&artifact.project_id==="pick-an-observation-site"&&<SiteImage artifact={artifact} readOnly/>}
    {showMedia&&artifact.project_id==="run-an-expedition"&&<MissionMap artifact={artifact}/>}
    <h4>操作与验证记录 · {artifact.runs.length} 次</h4>
    {artifact.runs.map((run,i)=><details key={i} className={styles.run}><summary>第 {i+1} 次 · {run.result.passed?"条件核对通过":"保留的未通过记录"} · {scenarioNames[run.scenario]}</summary><p>{run.result.summary}</p><dl>{Object.entries(run.result.values).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><ol>{run.result.steps.map((step,j)=><li key={j}>{step}</li>)}</ol>{run.result.telemetry&&<ExpeditionReplay key={run.signature} run={run}/>}</details>)}
    {Object.keys(artifact.imports).length>0&&<p className={styles.note}>已保存输入模块快照：{Object.keys(artifact.imports).join("、")}。修改上游作品不会悄悄改变这一版。</p>}
  </div>
}

function FinalDelivery({course,node,body,ready}:{course:GuidedCourse;node:GuidedModule;body:LearningBody;ready:boolean}) {
  const record=useLearningRecord(deliveryScope(course,node),{answers:[]})
  const artifact=checkedArtifact(body.artifact)?body.artifact:null
  const checks=artifact?artifactChecks(artifact):[{title:"有效的实验作品与实际记录",passed:false}]
  const explained=body.answers.length===3&&body.answers.every(a=>a.answer.trim().length>0)
  const complete=ready&&!!artifact&&checks.every(c=>c.passed)&&explained
  const prepared:LearningBody={...body,client_context:{delivery:{schema_version:"project-delivery/1",title:course.final_deliverable?.title,verifier:"space-lab/1",assessment:"ungraded"}}}
  const unchanged=JSON.stringify(record.body)===JSON.stringify(prepared),submitted=!!record.submittedAt&&unchanged
  const saved=record.history[0]??(record.submittedAt?{body:record.body,created_at:record.submittedAt}:null)
  async function submit(){if(!record.ready||record.busy||record.conflict)return;if(!record.pending){if(!complete)return;record.session.update(JSON.parse(JSON.stringify(prepared)))}await record.session.submit()}
  return <section id="project-delivery" data-project-delivery className={delivery.delivery}>
    <div className={delivery.heading}><Package size={24}/><div><p>最终交付物</p><h3>{course.final_deliverable?.title}</h3></div></div>
    <ul className={delivery.checks}>{[...checks,{title:"选择、证据边界与贡献说明已填写",passed:explained}].map((c,i)=><li key={i} data-passed={ready&&c.passed}>{c.passed?<Check size={18}/>:<Circle size={18}/>}<div><strong>{c.title}</strong><p>{c.passed?"已具备；解释内容仍需自评或评阅。":"待完成；请回到本节工作台和作品说明。"}</p></div></li>)}</ul>
    <p className={delivery.boundary}>验收核对保存的参数与计算记录，不把填写完整当作掌握。交付会保留独立快照；重新交付时账号历史保留旧版本。</p>
    <button className={delivery.submit} onClick={submit} disabled={!record.ready||record.busy||record.conflict||(!record.pending&&(!complete||submitted))}>{record.pending?"重试上次交付":submitted?"当前版本已保存":record.identity.token?"提交项目作品":"保存项目作品到本机"}</button>
    {saved&&<details data-delivered-version className={delivery.savedVersion}><summary>查看已交付作品 · {new Date(saved.created_at).toLocaleString()}</summary>{checkedArtifact(saved.body.artifact)&&<ArtifactView artifact={saved.body.artifact}/>} {saved.body.answers.map(a=><div key={a.question_id} className={delivery.explanation}><strong>{a.question}</strong><p>{a.answer}</p></div>)}</details>}
    <LearningRecordStatus record={record}/>
    <Link className={styles.nextLink} href={course.id==="run-an-expedition"?"/library/mars-analog-rover":`/explore/space-exploration/${course.id==="assemble-a-rover"?"run-an-expedition":"assemble-a-rover"}`}>{course.id==="run-an-expedition"?"继续：真实火星车课程":"下一站：让作品继续工作"}<ArrowRight size={15}/></Link>
  </section>
}

export function SpaceProjectWorkspace({course,node}:{course:GuidedCourse;node:GuidedModule}) {
  const id=course.id as SpaceId
  const record=useLearningRecord(workScope(id),{answers:emptyAnswers,artifact:freshArtifact(id) as unknown as Record<string,unknown>})
  const artifact=checkedArtifact(record.body.artifact,id)?record.body.artifact:freshArtifact(id)
  const [message,setMessage]=useState(""),[loading,setLoading]=useState(false),[scenario,setScenario]=useState(id==="tune-a-chassis"?"ridge":"normal")
  const locked=!record.ready||record.pending||record.conflict||loading
  function update(next:SpaceArtifact){record.session.update({...record.body,artifact:next as unknown as Record<string,unknown>})}
  function set(key:string,value:string){update({...artifact,config:{...artifact.config,[key]:value,...(key==="site"?{marked:"no"}:{})}})}
  const dependencies=id==="assemble-a-rover"?[
    {key:"chassis",id:"tune-a-chassis",label:"底盘"},{key:"reader",id:"label-the-terrain",label:"地形识别器"},{key:"rules",id:"write-driving-rules",label:"驾驶规则"},
  ]:id==="run-an-expedition"?[
    {key:"rover",id:"assemble-a-rover",label:"探测车（必需）"},{key:"mission",id:"pick-an-observation-site",label:"观察选址（可选）"},{key:"payload",id:"plan-a-payload",label:"运载方案（可选）"},
  ]:[]
  async function importWork(){
    setLoading(true);setMessage("")
    try {
      const imports:SpaceArtifact["imports"]={...artifact.imports},config={...artifact.config},found:string[]=[],missing:string[]=[]
      for(const d of dependencies){
        const scope:LearningScope={library_slug:d.id,module_id:d.id==="write-driving-rules"?"M04":"M03",activity_id:"final-deliverable",kind:"assignment",content_version:"1.0"}
        let body:LearningBody|undefined
        if(record.identity.token){const history=await learningRecords.read(record.identity.token,scope);body=history.submissions[0]?.body}
        else {const cached=JSON.parse(localStorage.getItem(learningCacheKey(record.identity.owner,scope))||"null");if(cached?.submittedAt)body=cached.body}
        const a=body?.artifact,valid=d.id==="write-driving-rules"?verifiedDrivingArtifact(a):checkedArtifact(a,d.id as SpaceId)&&artifactChecks(a).every(c=>c.passed)
        if(valid&&a){imports[d.key]=a;if(id==="assemble-a-rover")config[d.key]="mine";found.push(d.label);if(d.key==="mission")config.target=(a as unknown as SpaceArtifact).config.site;if(d.key==="payload")config.camera=(a as unknown as SpaceArtifact).config.camera}
        else missing.push(d.label)
      }
      if(found.length)update({...artifact,imports,config,runs:[]})
      setMessage(`已读取：${found.join("、")||"暂无"}。${missing.length?"尚未交付："+missing.join("、")+"。":""}${found.length?"输入已更新，请重新运行以建立这组模块的证据。":"先进入对应课程交付作品，再回来读取。"}`)
    }catch{setMessage("作品读取未完成，当前配置保留。请检查登录或网络后重试。")}finally{setLoading(false)}
  }
  const last=artifact.runs.at(-1),final=node.module_id===course.final_deliverable?.module_id
  const select=(label:string,key:string,options:[string,string][])=> <label className={styles.field}>{label}<select aria-label={label} value={artifact.config[key]} disabled={locked} onChange={e=>set(key,e.target.value)}>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
  return <><section className={styles.workbench} data-space-workbench={id} aria-label={`${NAMES[id]}工作台`}>
    <header><span><FlaskConical size={18}/> 本节实践工具</span><h3>{NAMES[id]}工作台</h3><p>从本节任务开始，改变一项选择，留下自己的实验记录。各节点共用这份作品草稿。</p></header>
    {(!checkedArtifact(record.body.artifact,id)&&record.ready)&&<p role="alert">保存的作品版本不兼容，请先从记录选项备份。新操作将创建兼容草稿。</p>}
    <fieldset disabled={locked} className={styles.controls}>
      {id==="pick-an-observation-site"&&<>
        {select("比较哪处影像","site",SITES.map(s=>[s.id,s.title]))}
        <SiteImage artifact={artifact} onChange={(x,y)=>update({...artifact,config:{...artifact.config,x:String(x),y:String(y),marked:"yes"}})}/>
        <p className={styles.note}>点击图片标记一处特征，或用下面的坐标控件定位。换图后请重新确认标记。</p>
        <div className={styles.twoCols}>{["x","y"].map(k=><label className={styles.field} key={k}>{k==="x"?"横向位置":"纵向位置"} {artifact.config[k]}%<input type="range" min="0" max="100" value={artifact.config[k]} onChange={e=>update({...artifact,config:{...artifact.config,[k]:e.target.value,marked:"yes"}})}/></label>)}</div><button type="button" onClick={()=>set("marked","yes")}>确认当前位置标记</button>
      </>}
      {id==="plan-a-payload"&&<><div className={styles.budget}><span>装载区 / 观察任务</span><strong>{EQUIPMENT.reduce((n,e)=>n+(artifact.config[e.id]==="yes"?e.mass:0),0)} <small>/ 12 kg</small></strong><p>包含至少 2 kg 余量；必须携带相机与电源。</p><div className={styles.cargo}>{EQUIPMENT.map(e=><div key={e.id} data-loaded={artifact.config[e.id]==="yes"}><Package size={30}/><b>{e.label}</b><span>{e.mass} kg</span></div>)}</div></div><div className={styles.twoCols}>{EQUIPMENT.map(e=><label key={e.id} className={styles.equipment}><input type="checkbox" checked={artifact.config[e.id]==="yes"} onChange={ev=>set(e.id,ev.target.checked?"yes":"no")}/><span>{e.label} · {e.mass} kg</span></label>)}</div></>}
      {(id==="tune-a-chassis"||id==="assemble-a-rover")&&<><iframe className={styles.roverFrame} src="/project-lines/space-exploration/_course-assets/rover-inspector.html" title="六轮探测车结构观察，可拖动旋转"/><p className={styles.note}>拖动查看六轮、悬挂与相机连接。模型用于结构观察；参数的运行影响以下方实验记录为准。</p></>}
      {id==="tune-a-chassis"&&<div className={styles.threeCols}>{select("离地间隙","clearance",[["8","8 cm"],["14","14 cm"],["20","20 cm"]])}{select("轮径","wheel",[["14","14 cm"],["20","20 cm"],["26","26 cm"]])}{select("速度档","speed",[["1","低速 1 档"],["2","高速 2 档"]])}</div>}
      {id==="label-the-terrain"&&<><p className={styles.note}>先按纹理标记 6 张训练影像。沙纹 = sand，岩层 = rock，无法确定 = unknown。参考类别针对主导形态，不是地质鉴定。</p><div className={styles.samples}>{SAMPLES.filter(s=>s.split==="train").map(s=><div key={s.id} className={styles.sample}>
        <SourceImage source={s} description="训练影像"/><a href={s.url} target="_blank" rel="noreferrer">{s.id} · 来源</a>{select(`${s.id} 标签`,s.id,[["","请选择"],["sand","沙纹"],["rock","岩层"],["unknown","不能确定"]])}</div>)}</div><details className={styles.method}><summary>识别器怎样使用我的标注？</summary><p>平台将每张原图转为 64 × 64 灰度图，读取均值、标准差、横纵相邻灰度差。按这四个数寻找最近的已标注样本；距离大于 0.26 或相近样本标签冲突时输出 unknown。它不会读取测试参考标签，也不是深度学习模型。</p></details></>}
      {dependencies.length>0&&<div className={styles.dependencies}><h4>带上已经交付的作品</h4><p>{id==="assemble-a-rover"?"至少一个核心模块来自你自己的作品，其余可以使用标明来源的平台模块。":"先交付一辆自己的组装探测车；选址和运载方案可以选用。"}</p>{dependencies.map(d=><div key={d.key} className={styles.dependency}><Link href={`/explore/space-exploration/${d.id}?node=M${d.id==="write-driving-rules"?"04":"03"}#project-delivery`}>{d.label}<ArrowRight size={14}/></Link><span>{artifact.imports[d.key]?"已载入我的作品快照":"尚未载入"}</span>{id==="assemble-a-rover"&&<select aria-label={`${d.label}来源`} value={artifact.config[d.key]} onChange={e=>set(d.key,e.target.value)}><option value="platform">平台模块</option><option value="mine" disabled={!artifact.imports[d.key]}>我的作品</option></select>}</div>)}<button type="button" onClick={importWork} disabled={loading}>{loading?"正在读取…":"读取我已交付的作品"}</button><p className={styles.note}>重新读取会更新输入快照并清空本工作台的旧运行记录；已经交付的版本仍保留。</p></div>}
      {id==="run-an-expedition"&&<><MissionMap artifact={artifact}/><div className={styles.threeCols}>{select("观察目标","target",SITES.map(s=>[s.id,s.title]))}{select("路线方案","route",[["short","捷径：软沙耗能高"],["safe","缓坡：稍远但省能"]])}{select("初始能量","energy",[["8","8 点"],["24","24 点"],["40","40 点"]])}</div><p className={styles.note}>未带入运载作品时使用平台相机。带入后按实际装备清单检查；这里的能量点不等于真实电池容量。</p></>}
      <div className={styles.runActions}>
        {(id==="tune-a-chassis"||id==="assemble-a-rover")&&<label>本次条件<select aria-label="本次条件" value={scenario} onChange={e=>setScenario(e.target.value)}>{(id==="tune-a-chassis"?[["ridge","岩石路段"],["soft","低障碍路段"]]:[["normal","正常运行"],["camera","注入相机丢失"],["motor","注入电机停转"]]).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>}
        <button type="button" className={styles.runButton} onClick={()=>{update(addRun(artifact,scenario));setMessage("本次运行已记录；修改参数后需要重新运行，旧结果仍保留供比较。")}}><Play size={15}/>{id==="pick-an-observation-site"?"记录这个候选地点":id==="plan-a-payload"?"核对这版预算":id==="label-the-terrain"?"用独立影像测试":"运行并留下证据"}</button>
      </div>
    </fieldset>
    {message&&<p role="status" className={styles.message}>{message}</p>}
    {last&&<div className={styles.result} data-space-result>{JSON.stringify(last.config)!==JSON.stringify(artifact.config)&&<p className={styles.stale}>这是上次运行结果。参数已修改，请重新运行后再交付。</p>}<strong>{last.result.summary}</strong><div>{Object.entries(last.result.values).map(([k,v])=><p key={k}><span>{k}</span><b>{v}</b></p>)}</div></div>}
    {id==="label-the-terrain"&&last&&<div className={styles.samples}>{SAMPLES.filter(s=>s.split==="test").map((s,i)=><figure key={s.id}><SourceImage source={s} description="独立测试影像"/><figcaption><a href={s.url} target="_blank" rel="noreferrer">{s.id} · 独立测试来源</a><p>{last.result.steps[i]}</p></figcaption></figure>)}</div>}
    <ArtifactView artifact={artifact} showMedia={false}/>
    {final&&<div className={styles.explanation}><h4>给你的作品写三句说明</h4><p>例子：我为纸桥选了折叠桥面；同一重量下做了两次测试；纸张由老师提供。现在换成你这次的选择和证据，不用写长报告。</p>{record.body.answers.map((a,i)=><label key={a.question_id} className={styles.field}>{a.question}<input aria-label={a.question} maxLength={600} value={a.answer} disabled={locked} placeholder={["我选择了什么，为什么？","写一个实测结果和一个还没验证的情况","指出你的改动与平台已有部分"][i]} onChange={e=>record.session.update({...record.body,answers:record.body.answers.map((old,j)=>j===i?{...old,answer:e.target.value}:old)})}/></label>)}</div>}
    <p className={styles.note}>{MODEL_NOTE}</p><LearningRecordStatus record={record}/>
  </section>{final&&<FinalDelivery course={course} node={node} body={record.body} ready={record.ready}/>}</>
}

export function isSpaceCourse(id:string):id is SpaceId {return (SPACE_IDS as readonly string[]).includes(id)}
