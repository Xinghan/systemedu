"use client"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Circle, ClipboardList, Flag, Map, CalendarDays, Clock3, FolderOpen, Search, AlertTriangle, Radio, RefreshCw } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { useMissionOperations, type MissionRecord } from "@/lib/hooks/use-mission-operations"
import { STATUS_LABELS, taskState, canFinish, duration, weekSeconds, localDay, type MissionTask, type TaskStatus, type MissionOperations } from "@/lib/project-lines/mission-operations-core"
import type { MissionControlConfig } from "./mission-control-config"
import { nodeProgressLabel } from "@/lib/project-lines/space-mission-progress"
import { RoverCampusSurface, ROVER_CAMPUS_POINTS, type CampusStop } from "@/components/learning/rover-campus-surface"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { LearningRecordStatus } from "@/components/learning/learning-record-status"

import { WorkClock } from "./mission-work-strip"
import { MissionRoomBackdrop, MissionRoomArrival, missionRoomLabel } from "./mission-room-environment"
import s from "./space-mission-control.module.css"

const VIEWS = [{id:"desk",label:"工作台",icon:ClipboardList},{id:"map",label:"任务地图",icon:Map},{id:"schedule",label:"时间表",icon:CalendarDays},{id:"log",label:"工作日志",icon:Clock3},{id:"dossier",label:"工程档案",icon:FolderOpen}] as const
const roles:Record<string,string>={lesson:"主线任务",micro:"启程体验",support:"随用随学",optional:"选修探索",replaced:"旧方案对照"}
const shortDate=(value:string)=>new Date(value).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})

export function MissionControl({config}:{config:MissionControlConfig}) {
  const {owner}=useLearningIdentity()
  return <ControlSession key={owner+config.line} config={config}/>
}
function ControlSession({config}:{config:MissionControlConfig}) {
  const {stations:MISSION_STATIONS, steps:MISSION_STEPS, control:CONTROL_HREF, sourceNode, classroomHref:taskClassroomHref, initialProgress:initialMissionProgress, readProgress:readMissionProgress, Dossier}=config
  const {TASKS,taskById,changeTask,mainProgress}=config.engine
  const missionStation=(id:string)=>MISSION_STATIONS.find(s=>s.id===id)
  const model=useMissionOperations(config.engine),{record,ops}=model,search=useSearchParams(),router=useRouter()
  const view=VIEWS.find(v=>v.id===search.get("view"))?.id||"desk"
  const [nodes,setNodes]=useState(initialMissionProgress),[attempt,setAttempt]=useState(0)
  const [query,setQuery]=useState("")
  const root=useRef<HTMLElement>(null),[replay,setReplay]=useState(0)
  const fallback=ops ? TASKS.find(t=>taskState(ops,t.id).status==="active") || TASKS.find(t=>t.role==="micro"&&taskState(ops,t.id).status!=="done") || taskById(MISSION_STEPS.find(id=>taskState(ops,id).status!=="done")||MISSION_STEPS[0])! : TASKS[0]
  const task=taskById(search.get("task")||"")||fallback
  const station=missionStation(task.station)!
  const select=(id:string,nextView=view)=>{const q=new URLSearchParams({task:id});if(nextView!=="desk")q.set("view",nextView);router.replace(`${CONTROL_HREF}?${q}`,{scroll:false})}
  const selectStation=(id:string,nextView=view)=>{
    const options=TASKS.filter(t=>t.station===id&&(t.role==="lesson"||t.role==="micro"))
    const next=options.find(t=>!ops||taskState(ops,t.id).status!=="done")||options[0]
    if(next){setQuery("");select(next.id,nextView)}
  }
  useEffect(()=>{
    let active=true
    void readMissionProgress(record.identity.token,record.identity.owner,(ref,value)=>{if(active)setNodes(prev=>({...prev,[ref]:value}))})
    return ()=>{active=false}
  },[record.identity.token,record.identity.owner,attempt,readMissionProgress])
  const progress=ops?mainProgress(ops):{done:0,total:MISSION_STEPS.length}
  const total=ops?Object.values(ops.time.totals).reduce((a,b)=>a+b,0):0
  const blocked=ops?TASKS.filter(t=>taskState(ops,t.id).status==="blocked"):[]
  const sourceReady=Object.values(nodes).every(v=>v!=="loading")
  const stops:CampusStop[]=MISSION_STATIONS.map((place,i)=>{
    const ids=place.steps.length?place.steps:TASKS.filter(t=>t.station===place.id&&t.role==="micro").map(t=>t.id)
    const done=ops?ids.filter(id=>taskState(ops,id).status==="done").length:0
    return {...(config.mapPoints||ROVER_CAMPUS_POINTS)[i],id:place.id,label:place.place,state:!record.ready?"loading":done?"draft":"new",statusLabel:`自检 ${done} / ${ids.length}${!place.steps.length?" · 任选体验":""}`}
  })
  const patch=(value:Parameters<typeof changeTask>[2])=>model.update(o=>changeTask(o,task.id,value,new Date().toISOString()))
  const editable=record.ready&&!record.attention&&!record.conflict&&!record.pending&&!!ops
  const shown=TASKS.filter(t=>query.trim()?`${t.code} ${t.title} ${t.id}`.toLowerCase().includes(query.trim().toLowerCase()):t.station===station.id)
  const nextTaskId=task.role==="micro"?MISSION_STEPS[0]:sourceNode(task)?.anchor||MISSION_STEPS[MISSION_STEPS.indexOf(task.id)+1]
  const stationDone=ops?station.steps.filter(id=>taskState(ops,id).status==="done").length:0
  return <main ref={root} className={s.center} data-mission-control data-room={station.id}>
    <MissionRoomArrival key={`${station.id}:${view}:${replay}`} station={station} skin={config.skin} moduleName={VIEWS.find(v=>v.id===view)!.label} root={root}/>
    <header className={s.topbar}><Link href={config.home}><ArrowLeft size={15}/>任务首页</Link><span><Radio size={15}/> {config.title} / 任务中心</span><Link href={`/library?view=lines&line=${config.line}`}>项目资料库<ArrowUpRight size={14}/></Link></header>
    <section className={s.command} aria-label="远征总览">
      <MissionRoomBackdrop key={station.id} station={station.id} skin={config.skin} className={s.roomScene}/>
      <div className={s.commandCopy} data-room-reveal="title"><p className={s.eyebrow}>{config.identity}</p><h1><small>{station.code} / 当前任务站</small><span>{station.place}</span></h1><p className={s.missionGoal}>{station.message}。</p><div className={s.identity}><span className={s.signal}/> {record.identity.token?"个人任务档案 · 登录账号":"个人任务档案 · 本机访客"}<span>{config.motto}</span></div></div>
      <div className={s.roomCaption}><span>{missionRoomLabel(station.id,config.skin)}</span><small>科研场景示意 · AI 生成</small><button className={s.replayArrival} onClick={()=>setReplay(n=>n+1)}><RefreshCw size={12}/>重播入场</button></div>
      <div className={s.stats} data-room-reveal="chrome"><div><small>主线自检完成</small><strong data-main-progress>{record.ready?progress.done:"—"}<span> / {progress.total}</span></strong><progress value={progress.done} max={progress.total} aria-label="主线自检进度"/></div><div><small>实际记录的工作时间</small><strong className={s.timeTotal} data-total-time>{record.ready?duration(total):"读取中"}</strong><span>从主动开始计时起累计</span></div><div><small>需要解决的阻碍</small><strong>{record.ready?blocked.length:"—"}<span> 项</span></strong><span>发现问题也是工程的一部分</span></div></div>
    </section>
    <div className={s.content}>
      {config.Briefing&&<config.Briefing stationId={station.id} auto={false}/>}
      <div className={s.consoleDock} data-room-reveal="chrome"><nav className={s.tabs} aria-label="任务中心模块">{VIEWS.map(v=><button type="button" key={v.id} aria-current={v.id===view?"page":undefined} onClick={()=>select(task.id,v.id)}><v.icon size={17}/>{v.label}</button>)}</nav><div className={s.activeStation} role="status" aria-label="当前任务站"><span className={s.stationIndicator}/><span><small>当前任务站</small>{station.code} · {station.place}</span></div></div>
      {!record.ready&&<div className={s.loading}><LoadingSpinner label="正在读取个人任务记录"/></div>}
      <div className={s.saveBar}><span>{record.ready ? record.message : "读取完成后可编辑；任务说明随时可查看。"}</span><details><summary>保存与恢复</summary><LearningRecordStatus record={record}/></details></div>
      {model.message&&<p className={s.warning} role="alert">{model.message}</p>}
      {record.ready&&!ops&&<p className={s.warning} role="alert">这份任务记录暂时无法读取，原数据已保留。请在“保存与恢复”导出核对；不会用空白记录覆盖。</p>}
      {view==="desk"&&<>
        <div className={s.stationRail} data-room-reveal="chrome" aria-label="任务站选择">{MISSION_STATIONS.map(place=><button key={place.id} aria-pressed={place.id===station.id} onClick={()=>selectStation(place.id)}><small>{place.code}</small><span>{place.place}</span></button>)}</div>
        <div className={s.workbench}>
          <aside className={s.directory} data-room-reveal="left"><div className={s.sectionLabel}><span>子任务清单</span><small>{station.code} / {station.steps.length?`${stationDone} / ${station.steps.length} 主线自检`:"启程体验任选一个"}</small></div><label className={s.search}><Search size={15}/><input aria-label="搜索全部子任务" value={query} onChange={e=>setQuery(e.target.value)} placeholder={`搜索 ${TASKS.length} 个任务与材料`}/></label>
            <div className={s.taskList}>{[true,false].map(primary=>{const items=shown.filter(t=>(t.role==="lesson"||t.role==="micro")===primary);return items.length>0&&<div key={String(primary)}><p>{query?"搜索结果 · ":""}{primary?"推荐推进顺序":"按需调用的任务材料"} <span>{items.length}</span></p>{items.map(t=>{const state=ops?taskState(ops,t.id):null;return <button key={t.id} data-task-choice={t.id} aria-pressed={task.id===t.id} onClick={()=>select(t.id)}><span className={s.taskSymbol} data-state={state?.status}>{state?.status==="done"?<Check size={14}/>:state?.status==="blocked"?<AlertTriangle size={14}/>:<Circle size={11}/>}</span><span><small>{t.code} · {t.category}</small><strong>{t.title}</strong><em>{state?STATUS_LABELS[state.status]:"读取记录中"}{t.role!=="lesson"?` · ${roles[t.role]}`:""}</em></span></button>})}</div>})}{shown.length===0&&<p className={s.note}>没有匹配的子任务，试试课程名称或任务编号。</p>}</div>
          </aside>
          <article className={s.taskOrder} data-room-reveal="body" data-task-order={task.id} id="mission-task-order">
            <div className={s.screenBezel}><span><ClipboardList size={13}/>电子任务单</span><small>{task.code}</small></div>
            <div className={s.orderHeader}><span>{task.code} / {roles[task.role]}</span><span>{task.category}</span></div><h2>{task.title}</h2><p className={s.taskGoal}>{task.goal}</p>
            {task.note&&<p className={s.context}>{task.note}</p>}
            <div className={s.output}><Flag size={19}/><div><h3>这一步要带回</h3>{task.outputs.map((o,i)=><p key={i}>{o}</p>)}</div></div>
            <section className={s.orderSection}><h3><span>01</span>执行步骤</h3><ol>{task.actions.map((action,i)=><li key={i}>{action}</li>)}</ol><Link className={s.primary} data-task-classroom href={taskClassroomHref(task)}>进入{task.role==="micro"?"任务体验":"原课堂完成这一步"}<ArrowRight size={16}/></Link><p className={s.note}>课堂中的讲解、视频、动画、实验和作业沿用原有位置与记录。</p></section>
            <section className={s.orderSection}><h3><span>02</span>自检与交接</h3><p className={s.note}>对照自己的作品逐项确认。自检完成不等于通过教师评阅。</p><fieldset disabled={!editable} className={s.checks}><legend className={s.srOnly}>子任务自检清单</legend>{task.checks.map((item,i)=>{const id=`check-${i}`,checked=!!ops&&taskState(ops,task.id).checks.includes(id);return <label key={id}><input type="checkbox" checked={checked} onChange={e=>model.update(o=>{const before=taskState(o,task.id);return changeTask(o,task.id,{checks:e.target.checked?[...new Set([...before.checks,id])]:before.checks.filter(c=>c!==id)},new Date().toISOString())})}/><span>{item}</span></label>})}
              <label className={s.field}>我的证据摘要<textarea rows={2} maxLength={300} value={ops?taskState(ops,task.id).evidence:""} placeholder={`例如：我完成了“${task.outputs[0]}”；记录中保留了自己的选择、结果和一个待验证问题。`} onChange={e=>patch({evidence:e.target.value})}/><small>写自己的结果或原课堂中的文件名。完整作业仍在课堂提交。</small></label>
              <label className={s.field}>交给下一步的提醒<input maxLength={200} value={ops?taskState(ops,task.id).next:""} onChange={e=>patch({next:e.target.value})} placeholder="例如：下一步需要保留首次结果与当前配置"/></label>
              <button type="button" className={s.primary} disabled={!ops||!canFinish(task,taskState(ops,task.id))||taskState(ops,task.id).status==="done"} onClick={()=>patch({status:"done"})}><Check size={16}/>{ops&&taskState(ops,task.id).status==="done"?"这一步已自检完成":"标记这一步自检完成"}</button>
              {ops&&!canFinish(task,taskState(ops,task.id))&&<small>逐项自检、填写证据摘要并处理阻碍后，可以标记完成。</small>}
            </fieldset>{nextTaskId&&<button className={s.textButton} data-next-mission-task onClick={()=>select(nextTaskId,"desk")}>接下一步任务：{taskById(nextTaskId)?.title}<ArrowRight size={15}/></button>}</section>
            <section className={s.orderSection}><h3><span>03</span>任务资料</h3><div className={s.resourceList}><Link href={taskClassroomHref(task)}><FolderOpen size={17}/><div><strong>完整课堂与正式资料</strong><small>任务说明、操作演示、视频、参考资料和作业入口</small></div><ArrowUpRight size={14}/></Link>{task.resources.map((r,i)=><a key={i} href={r.url} target="_blank" rel="noreferrer"><span className={s.resourceKind}>{r.kind==="video"?"视频":"参考"}</span><div><strong>{r.title}</strong><small>{r.purpose}</small></div><ArrowUpRight size={14}/></a>)}</div></section>
            <footer className={s.orderFooter}><small>来源：{task.id} · 原课程标识保留</small><span>{task.role==="micro"?"体验作品请在原体验中查看":`原课堂状态：${nodeProgressLabel(nodes[task.id])}`}</span></footer>
          </article>
          <aside className={s.console} data-room-reveal="right"><div className={s.panel}><p className={s.sectionLabel}>工作状态</p><label className={s.field}>我的子任务状态<select aria-label="我的子任务状态" disabled={!editable} value={ops?taskState(ops,task.id).status:"todo"} onChange={e=>patch({status:e.target.value as TaskStatus})}>{Object.entries(STATUS_LABELS).map(([key,label])=><option key={key} value={key} disabled={key==="done"&&(!ops||!canFinish(task,taskState(ops,task.id)))}>{label}</option>)}</select></label><WorkClock key={task.id} model={model} taskId={task.id}/><p className={s.note}>本任务累计：{duration(ops?.time.totals[task.id]||0)}</p><p className={s.note}>{task.minutes?`原课预计约 ${task.minutes} 分钟，仅作计划参考。`:"原课尚未标定用时，按自己的节奏分次完成。"}离开页面的工作时间不自动计入。</p></div>
            <div className={s.panel}><p className={s.sectionLabel}>输入与准备</p><p>{station.input}</p><p className={s.note}>{task.preparation}</p>{station.dependsOn.length>0&&<div className={s.dependencies}><small>需要带来的阶段材料</small>{station.dependsOn.map(id=>{const prior=missionStation(id)!;return <button key={id} onClick={()=>selectStation(id)}>{prior.code} {prior.place}<ArrowUpRight size={13}/></button>})}</div>}{sourceNode(task)?.anchor&&<button className={s.textButton} onClick={()=>select(sourceNode(task)!.anchor!)}>回到此材料服务的主线任务<ArrowRight size={13}/></button>}</div>
            <div className={s.panel}><p className={s.sectionLabel}><AlertTriangle size={14}/>记录一个阻碍</p><label className={s.field}>现在卡在哪里？<textarea rows={3} maxLength={160} disabled={!editable} value={ops?taskState(ops,task.id).blocker:""} placeholder="例如：原始记录缺少单位，暂时不能与其他结果比较" onChange={e=>{const value=e.target.value;patch({blocker:value,...(!value.trim()&&ops&&taskState(ops,task.id).status==="blocked"?{status:"active" as const}:{})})}}/></label><button disabled={!editable||!ops||!taskState(ops,task.id).blocker.trim()} className={s.secondary} onClick={()=>patch({status:"blocked"})}>标记为遇到阻碍</button><small className={s.note}>清空已解决的阻碍后，可以重新自检。需要协助时，带上失败记录。</small></div>
            <div className={s.panel}><label className={s.field}>这一步计划完成日期<input type="date" disabled={!editable} value={ops?taskState(ops,task.id).due:""} onChange={e=>patch({due:e.target.value})}/></label><button className={s.textButton} onClick={()=>select(task.id,"schedule")}>查看阶段时间表<ArrowRight size={13}/></button></div>
          </aside>
        </div>
      </>}
      {view==="map"&&<section className={s.mapPanel} data-room-reveal="body"><div className={s.viewHeading}><div><p className={s.eyebrow}>MISSION TERRAIN</p><h2>任务地图，每一站都有明确交接。</h2><p>连线是推荐路线。每一站接收上游材料，交接自己的作品；地图显示个人自检进度。</p></div></div><RoverCampusSurface stops={stops} current={fallback.station} selected={station.id} onSelect={id=>selectStation(id)} imageSrc={config.mapImage} title={`${config.title} · 任务部署图`} subtitle={config.mapSubtitle} mapMotto={config.motto} taskId="selected-station-order"/><div className={s.stationCard} id="selected-station-order"><span className={s.stationNumber}>{station.code}</span><div><h3>{station.place} · {station.message}</h3><p>带来：{station.input}</p><p>带走：{station.handoff}</p><small>自检标准：{station.gate}</small></div><button className={s.primary} onClick={()=>select(task.id,"desk")}>打开本站任务单<ArrowRight size={15}/></button></div></section>}
      {view==="schedule"&&<Schedule config={config} model={model} select={id=>select(id,"desk")}/>}
      {view==="log"&&<WorkLog config={config} ops={ops} blocked={blocked} select={id=>select(id,"desk")}/>}
      {view==="dossier"&&<section className={s.archive} data-room-reveal="body"><div className={s.viewHeading}><div><p className={s.eyebrow}>ENGINEERING EVIDENCE</p><h2>让作品、数据和决定都有来处。</h2><p>任务中心里的自检摘要帮助交接，正式作品与提交历史保留在原课堂。</p></div></div><Dossier/><div className={s.archiveChecklist}><h3>一次完整任务，应留下什么？</h3>{["任务定义：问题、范围与成功条件","工作基线：输入来源、配置与版本","验证证据：同条件比较、首次结果与后续修订","交付说明：复现步骤、已知限制与后续验证"].map(v=><p key={v}><FolderOpen size={17}/>{v}</p>)}</div></section>}
      <footer className={s.centerFooter}><p>课程提交、个人自检与能力评阅分别记录。这里只累计主动记录的用时，不补算过去的学习时间。</p><button disabled={!sourceReady} onClick={()=>{setNodes(initialMissionProgress());setAttempt(n=>n+1)}}><RefreshCw size={13}/>{sourceReady?"刷新原课堂状态":"正在读取原课堂状态"}</button></footer>
    </div>
  </main>
}

function Schedule({config,model,select}:{config:MissionControlConfig;model:MissionRecord;select:(id:string)=>void}) {
  const {TASKS}=config.engine, MISSION_STATIONS=config.stations
  const {ops,record}=model,editable=record.ready&&!!ops&&!record.attention&&!record.conflict
  const week=ops?weekSeconds(ops,new Date()):0,today=localDay(new Date())
  const dated=TASKS.filter(t=>ops&&taskState(ops,t.id).due).sort((a,b)=>taskState(ops!,a.id).due.localeCompare(taskState(ops!,b.id).due))
  return <section className={s.schedule} data-room-reveal="body"><div className={s.viewHeading}><div><p className={s.eyebrow}>MISSION SCHEDULE</p><h2>把任务，安排进自己的生活。</h2><p>{config.scheduleNote}</p></div><div className={s.weekPlan}><label className={s.field}>每周计划投入<select aria-label="每周计划投入" disabled={!editable} value={ops?.plan.weeklyMinutes||120} onChange={e=>model.update(o=>({...o,plan:{...o.plan,weeklyMinutes:Number(e.target.value)}}))}>{[30,60,90,120,180,240,360].map(n=><option key={n} value={n}>{n} 分钟 / 周</option>)}</select></label><p>本周已记录 <strong>{duration(week)}</strong></p><progress value={Math.min(week,(ops?.plan.weeklyMinutes||120)*60)} max={(ops?.plan.weeklyMinutes||120)*60} aria-label="本周计划进度"/></div></div>
    <div className={s.scheduleTable}><div className={s.scheduleHead}><span>阶段与交接物</span><span>个人自检</span><span>实际记录用时</span><span>目标日期</span></div>{MISSION_STATIONS.map(station=>{const tasks=TASKS.filter(t=>t.station===station.id),main=tasks.filter(t=>t.role==="lesson"||t.role==="micro"),done=ops?main.filter(t=>taskState(ops,t.id).status==="done").length:0,time=ops?tasks.reduce((sum,t)=>sum+(ops.time.totals[t.id]||0),0):0,date=ops?.plan.milestones[station.id]||"";const late=date&&date<today&&done<(station.steps.length||1);return <div key={station.id} className={s.scheduleRow}><div><button onClick={()=>select(main[0].id)}><small>{station.code}</small><strong>{station.place}</strong><ArrowUpRight size={14}/></button><p>{station.handoff}</p>{!station.steps.length&&<small>体验任选一个即可继续</small>}</div><span>{done} / {main.length}<progress value={done} max={main.length} aria-label={`${station.place}自检进度`}/></span><span>{duration(time)}</span><label><span className={s.srOnly}>{station.place}目标日期</span><input type="date" disabled={!editable} value={date} onChange={e=>model.update(o=>({...o,plan:{...o.plan,milestones:{...o.plan.milestones,[station.id]:e.target.value}}}))}/>{late&&<small className={s.overdue}>已过计划日期，可重新安排</small>}</label></div>})}</div>
    <p className={s.note}>日期是自己的计划，没有自动锁课。部分节点尚未标定时长，因此暂不推算整条项目线的完工日期。</p>
    <section className={s.panel}><h3>单步任务的日期</h3>{dated.length?dated.map(t=><button className={s.datedTask} key={t.id} onClick={()=>select(t.id)}><span>{taskState(ops!,t.id).due}</span><strong>{t.code} · {t.title}</strong><small>{STATUS_LABELS[taskState(ops!,t.id).status]}</small><ArrowRight size={15}/></button>):<p className={s.note}>在任务单右侧，可以为某一步设置完成日期。</p>}</section>
  </section>
}
function WorkLog({config,ops,blocked,select}:{config:MissionControlConfig;ops:MissionOperations|null;blocked:MissionTask[];select:(id:string)=>void}) {
  const {taskById}=config.engine
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const day=localDay(d);return {day,seconds:ops?.time.days[day]||0}}),max=Math.max(60,...days.map(d=>d.seconds))
  return <section className={s.log} data-room-reveal="body"><div className={s.viewHeading}><div><p className={s.eyebrow}>ENGINEERING LOGBOOK</p><h2>看得见投入，也记得住问题。</h2><p>日志记录主动计时的工作段与状态变化。离开页面后的用时暂不自动记录。</p></div></div><div className={s.logGrid}><div className={s.panel}><h3>最近七天</h3><div className={s.dayChart}>{days.map(d=><div key={d.day}><small>{duration(d.seconds)}</small><div><span style={{height:`${d.seconds/max*100}%`}}/></div><time dateTime={d.day}>{d.day.slice(5)}</time></div>)}</div></div><div className={s.panel}><h3>待解决的阻碍 · {blocked.length}</h3>{blocked.length?blocked.map(t=><button className={s.blockedTask} key={t.id} onClick={()=>select(t.id)}><AlertTriangle size={16}/><div><strong>{t.code} · {t.title}</strong><p>{taskState(ops!,t.id).blocker}</p></div><ArrowRight size={14}/></button>):<p className={s.note}>目前没有标记的阻碍。遇到困难时，在任务单记下现象和试过的方法。</p>}</div></div>
    <div className={s.logGrid}><div className={s.panel}><h3>工作时间记录</h3>{ops?.time.recent.length?<ol className={s.timeline}>{ops.time.recent.toReversed().map(r=><li key={r.id}><span className={s.timelineDot}/><div><button onClick={()=>select(r.task)}>{taskById(r.task)?.title}<ArrowUpRight size={13}/></button><small>{shortDate(r.startedAt)} — {shortDate(r.endedAt)} · {r.reason}</small></div><strong>{duration(r.seconds)}</strong></li>)}</ol>:<div className={s.emptyLog}><Clock3 size={28}/><p>第一次主动开始工作后，<br/>这里就会留下你的记录。</p></div>}<p className={s.note}>展示最近 80 段工作；日统计保留最近 730 个记录日，各任务累计用时持续保留。</p></div><div className={s.panel}><h3>任务状态变化</h3>{ops?.events.length?<ol className={s.timeline}>{ops.events.toReversed().map((e,i)=><li key={i}><span className={s.timelineDot}/><div><button onClick={()=>select(e.task)}>{taskById(e.task)?.code} · {taskById(e.task)?.title}</button><small>{shortDate(e.at)}</small></div><span>{STATUS_LABELS[e.status]}</span></li>)}</ol>:<p className={s.note}>从待开始到自检完成，每一次状态变化都会留下记录。</p>}<p className={s.note}>展示最近 80 次状态变化；完整作品与提交历史在原课堂。</p></div></div>
  </section>
}
