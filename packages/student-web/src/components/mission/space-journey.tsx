"use client"

/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useId, useState } from "react"
import { ArrowLeft, ArrowRight, Check, ChevronRight, Compass, FileCheck2, Flag, Layers, Map, Play, RotateCcw, Wrench } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { JOURNEY_IDS, JOURNEY_LEVELS, JOURNEY_STATIONS, journeyProject, journeyStationFor } from "@/lib/project-lines/space-journey"
import { hasJourneyEvidence, readJourneyProject, recommendJourneyProject, waitingProgress } from "@/lib/project-lines/space-journey-progress"
import { ROVER_CAMPUS_POINTS, RoverCampusSurface, type CampusStop } from "@/components/learning/rover-campus-surface"
import { IntroFilm } from "@/components/learning/rover-mission-center"
import { projectCoverProps } from "@/lib/project-cover"
import type { SpaceStage } from "@/lib/project-lines/space-stage-films"
import { useSpaceStageFilm } from "./space-stage-briefing"
import s from "./space-journey.module.css"

export function SpaceJourney() {
  const identity=useLearningIdentity()
  const search=useSearchParams()
  const [film,setFilm]=useState(false)
  const [stage,setStage]=useState<SpaceStage | null>(null)
  const { replay, dialog }=useSpaceStageFilm(stage,!film)
  return <>
    <JourneySession key={`${identity.owner}:${search.get("station")||""}`} {...identity} openFilm={()=>setFilm(true)} stageReady={setStage} replayStage={replay} />
    {dialog}
    {film&&<IntroFilm close={()=>setFilm(false)} autoPlay onEnded={()=>setFilm(false)} returnLabel="回到星际远航任务中心" description="这是星际远航中的火星探索序章：先观察、选择路线、带回照片。整条项目线还会走向方法设计、实物制造、自主探测与行星数据研究。"/>}
  </>
}
function JourneySession({token,owner,openFilm,stageReady,replayStage}:{token:string|null;owner:string;openFilm:()=>void;stageReady:(level:SpaceStage)=>void;replayStage:()=>void}) {
  const search=useSearchParams()
  const initial=JOURNEY_STATIONS.find(station=>station.id===search.get("station"))?.id
  const [selected,setSelected]=useState<string>(initial||"")
  const [progress,setProgress]=useState(waitingProgress)
  const [attempt,setAttempt]=useState(0)
  const [mapUnavailable,setMapUnavailable]=useState(false)
  const unavailable=useCallback(()=>setMapUnavailable(true),[])
  const taskId=useId()
  useEffect(()=>{
    let active=true
    for (const id of JOURNEY_IDS) void readJourneyProject(id,token,owner).then(value=>{if(active)setProgress(previous=>({...previous,[id]:value}))})
    return()=>{active=false}
  },[token,owner,attempt])
  const ready=JOURNEY_IDS.every(id=>progress[id].state!=="loading")
  const next=journeyProject(recommendJourneyProject(progress))
  const station=JOURNEY_STATIONS.find(value=>value.id===(selected||next.station.id))??JOURNEY_STATIONS[0]
  const level=JOURNEY_LEVELS.find(value=>value.level===station.level)!
  useEffect(()=>{
    // Explicit station arrivals need not wait for remote progress. Recommendations do.
    if(selected||ready) stageReady(station.level)
  },[selected,ready,station.level,stageReady])
  const choose=(id:string)=>{setSelected(id)}
  const completed=JOURNEY_IDS.filter(id=>hasJourneyEvidence(progress[id]))
  const failed=JOURNEY_IDS.filter(id=>progress[id].state==="unknown")
  const stops:CampusStop[]=JOURNEY_STATIONS.map((place,i)=>{
    const values=place.projects.map(id=>progress[id]),count=values.filter(hasJourneyEvidence).length
    const state=values.some(v=>v.state==="loading")?"loading":values.some(v=>v.state==="unknown")?"unknown":count===values.length?"submitted":count||values.some(v=>["draft","active","review"].includes(v.state))?"draft":"new"
    return {...ROVER_CAMPUS_POINTS[i],id:place.id,label:place.place,state,
      statusLabel:state==="loading"?"读取进展":state==="unknown"?"进展待读取":values.length===1&&values[0].total?`${values[0].count} / ${values[0].total} 节点`:`阶段 0${place.level} · ${count} / ${values.length} 件作品`}
  })
  // The two final destinations are parallel specialisms, not a prerequisite chain.
  stops[6].path=undefined
  stops[5].path="M952 794 Q825 786 750 766 Q642 753 553 753 M952 794 Q773 860 535 837 Q316 807 215 655"
  return <main className={s.journey} data-space-journey>
    <header className={s.topbar}><Link href="/library?view=lines"><ArrowLeft size={16}/>所有项目线</Link><span>星际远航 / 任务中心</span><a href="#journey-portfolio"><FileCheck2 size={15}/>我的作品档案</a></header>
    <section className={s.hero}>
      <img src="/mission/rover/pointing-1920.webp" alt="林岚在控制席邀请你加入星际远航" fetchPriority="high" />
      <div className={s.heroCopy}><p className={s.kicker}>一条项目线，一段持续成长的旅程</p><h1>从第一张星球照片，<br/>到自己的探索工程。</h1><p>先用 3 分钟动手。再学会设计、造车、带队远征，<br/>最终挑战自主探测车，或用真实数据研究行星。</p><div className={s.heroActions}><Link href={next.href} data-journey-start><Compass size={18}/>{ready&&next.id!=="spot-a-world"?"继续我的下一项挑战":"从第一个 3 分钟开始"}<ArrowRight size={17}/></Link><button onClick={openFilm}><Play size={15}/>火星探索序章 · 29 秒</button></div><a className={s.heroMap} href="#journey-map">先看看整条成长路线 <Map size={14}/></a><small>12 个项目 · 5 段成长 · 2 条高阶方向</small></div>
      <div className={s.heroNote}>任务搭档 / 林岚<small>AI 生成的虚构场景与角色</small></div>
    </section>
    <div className={s.body}>
      <section className={s.roleSection} aria-label="五段能力成长"><header><span>你的挑战会怎样变化</span><small>操作 → 方法 → 系统 → 实地验证 → 完整工程与研究</small></header><div className={s.roles}>{JOURNEY_LEVELS.map(item=><button key={item.level} data-journey-level={item.level} aria-pressed={item.level===station.level} onClick={()=>{choose(JOURNEY_STATIONS.find(s=>s.level===item.level)!.id);document.getElementById("journey-map")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}}><small>0{item.level}</small><strong>{item.role}</strong><span>{item.task}</span></button>)}</div></section>
      <section className={s.next} aria-label="建议下一步"><Flag size={23}/><div><p>{ready?completed.length?"从已有作品继续":"今天先做这一件":"先选一个项目体验"} / {next.station.place}</p><h2>{next.title}</h2><span>{next.outcome}</span></div><Link href={next.href}>进入项目 <ArrowRight size={17}/></Link></section>
      <section id="journey-map" className={s.mapSection}><header className={s.sectionHead}><div><p>YOUR EXPLORATION MAP</p><h2>每一站，都把你带得更远。</h2></div><span>8 个任务站 / 覆盖全部 12 个项目</span></header><p className={s.note}>选择地点查看任务群。地图上的地点是项目站；进入项目后，再按它自己的课程节点学习。高阶两条路线可独立选择。</p>
        <RoverCampusSurface stops={stops} current={next.station.id} selected={station.id} onSelect={choose} onUnavailable={unavailable} title="星际远航 · 全线任务地图" subtitle="从第一件作品，到完整工程与研究" mapMotto="把好奇，变成自己的探索能力。" taskId={taskId}/>
        <div className={s.mapGuide}><span>拖动探索 · ＋ / − 缩放 · 点击地点查看项目</span><span>07 自主工程 / 08 行星研究：高阶分流</span></div>
        <section id={taskId} className={s.station} aria-label="当前任务站" data-journey-station={station.id}>
          <div className={s.stationIntro}><div className={s.operator}><img src="/mission/rover/engineer-960.webp" alt="任务搭档林岚"/><div><p>林岚的任务简报 / {level.role}</p><h3>{station.place}</h3></div></div><button type="button" className={s.stageReplay} data-stage-replay={station.level} onClick={replayStage}><Play size={14}/>阶段 0{station.level} · 重播任务短片</button><p className={s.message}>{station.message}</p><div className={s.handoff}><Layers size={17}/><div><strong>这一站怎样连到下一站</strong><p>{station.handoff}</p></div></div><p className={s.preparation}><Wrench size={15}/>{level.support}</p></div>
          <div className={s.projects}>{station.projects.map(id=>{const p=journeyProject(id),state=progress[id];return <article key={id} data-journey-project={id}>{p.cover?<img {...projectCoverProps(id,p.cover,"card")} alt="" loading="lazy"/>:<div className={s.researchVisual}><Compass size={30}/><small>LIGHTKURVE</small><strong>真实数据<br/>行星调查</strong></div>}<div><div className={s.projectMeta}><span>{p.duration}</span><span data-progress-state={state.state}>{state.label}</span></div><h4>{p.title}</h4><p><small>带回的作品</small>{p.outcome}</p><Link href={p.href}>{p.full?"查看完整课程":p.micro?"开始 3 分钟体验":state.state==="submitted"?"查看作品与课程":"进入任务课程"}<ArrowRight size={16}/></Link></div></article>})}</div>
        </section>
      </section>
      <section id="journey-portfolio" className={s.portfolio}><header className={s.sectionHead}><div><p>YOUR EXPLORATION PORTFOLIO</p><h2>把作品留下，把能力带走。</h2></div><button onClick={()=>{setProgress(waitingProgress());setAttempt(n=>n+1)}} disabled={!ready}><RotateCcw size={14}/>刷新进展</button></header>
        <p className={s.note}>{token?"当前账号的课程交付与完成标记。三分钟体验仍使用本机相册，未自动归入账号。":"当前显示本机短体验与课程交付。大项目登录后读取账号进展。"}浏览地图和观看短片不会增加完成数量。</p>
        {failed.length>0&&<p className={s.warning} role="status">{failed.length} 个项目的进展暂未读全，原作品没有改动。可以刷新重试。</p>}
        <details className={s.allProjects} open={mapUnavailable||undefined}><summary><span><FileCheck2 size={17}/>全线项目与作品档案</span><span>{ready?`${completed.length} 项已有作品记录`:'正在读取…'}<ChevronRight size={16}/></span></summary><div>{JOURNEY_LEVELS.map(item=><section key={item.level}><h3>0{item.level} / {item.role}</h3>{JOURNEY_IDS.filter(id=>journeyStationFor(id)?.level===item.level).map(id=>{const p=journeyProject(id),state=progress[id];return <Link href={p.href} key={id} data-journey-record={id}><span className={s.recordMark}>{hasJourneyEvidence(state)?<Check size={16}/>:<FileCheck2 size={15}/>}</span><div><strong>{p.title}</strong><span>{state.label}</span><small>{state.note}</small></div><ArrowRight size={16}/></Link>})}</section>)}</div></details>
      </section>
      <section className={s.parents}><div><p>给一起出发的家长</p><h2>陪他开始，逐步把决定交给他。</h2><span>先留下一个小成果，再增加阅读、设计、制作和独立判断。成长靠作品与检验，不靠看完多少视频。</span></div><ol>{JOURNEY_LEVELS.map(item=><li key={item.level}><span>0{item.level}</span><div><strong>{item.role}</strong><p>{item.support}</p><small>这一阶段看什么：{item.evidence}</small></div></li>)}</ol></section>
      <p className={s.boundary}>地图和角色表达学习挑战的深度。作品提交、课程完成标记与能力评阅是不同的；完成项目线不等于取得工程师职业资质。</p>
    </div>
  </main>
}
