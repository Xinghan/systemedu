"use client"

/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useId, useState } from "react"
import { ArrowLeft, ArrowRight, ClipboardList, Compass, FileCheck2, Flag, Layers, Map, Play, RotateCcw, Wrench } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { JOURNEY_IDS, JOURNEY_LEVELS, JOURNEY_STATIONS, journeyProject } from "@/lib/project-lines/space-journey"
import { hasJourneyEvidence, waitingProgress } from "@/lib/project-lines/space-journey-progress"
import { initialMissionProgress, nodeHasRecord, nodeProgressLabel, readMissionProgress, readMissionProjects, recommendMission } from "@/lib/project-lines/space-mission-progress"
import { MISSION_MODULES, missionLessonHref, missionModule, stationStartHref } from "@/lib/project-lines/space-curriculum"
import { ROVER_CAMPUS_POINTS, RoverCampusSurface, type CampusStop } from "@/components/learning/rover-campus-surface"
import { IntroFilm } from "@/components/learning/rover-mission-center"
import { projectCoverProps } from "@/lib/project-cover"
import type { SpaceStage } from "@/lib/project-lines/space-stage-films"
import { useSpaceStageFilm } from "./space-stage-briefing"
import { SpaceMissionDossier } from "./space-mission-dossier"
import s from "./space-journey.module.css"
import c from "./space-mission-curriculum.module.css"

export function SpaceJourney() {
  const identity = useLearningIdentity(), search = useSearchParams()
  const [film, setFilm] = useState(false)
  const [stage, setStage] = useState<SpaceStage | null>(null)
  const { replay, dialog } = useSpaceStageFilm(stage, !film)
  return <><JourneySession key={`${identity.owner}:${search.get("station") || ""}`} {...identity} openFilm={() => setFilm(true)} stageReady={setStage} replayStage={replay}/>{dialog}{film && <IntroFilm close={() => setFilm(false)} autoPlay onEnded={() => setFilm(false)} returnLabel="回到远征任务中心" description="火星探索序章：从观察开始，逐步设计、制造并升级自己的探测车，完成一次可以复查的远征。"/>}</>
}
function JourneySession({ token, owner, openFilm, stageReady, replayStage }: { token: string | null; owner: string; openFilm: () => void; stageReady: (stage: SpaceStage | null) => void; replayStage: () => void }) {
  const search = useSearchParams()
  const stationParam = search.get("station") === "planet-science" ? "delivery" : search.get("station")
  const [selected, setSelected] = useState(JOURNEY_STATIONS.find(s => s.id === stationParam)?.id || "")
  const [projects, setProjects] = useState(waitingProgress)
  const [nodes, setNodes] = useState(initialMissionProgress)
  const [attempt, setAttempt] = useState(0)
  const taskId = useId()
  useEffect(() => {
    let active = true
    void readMissionProgress(token, owner, (ref, value) => { if (active) setNodes(previous => ({ ...previous, [ref]: value })) })
    void readMissionProjects(token, owner, (id, value) => { if (active) setProjects(previous => ({ ...previous, [id]: value })) })
    return () => { active = false }
  }, [token, owner, attempt])
  const ready = Object.values(nodes).every(s => s !== "loading") && JOURNEY_IDS.every(id => projects[id].state !== "loading")
  const recommended = recommendMission(nodes, projects)
  const station = JOURNEY_STATIONS.find(s => s.id === (selected || recommended.station)) || JOURNEY_STATIONS[0]
  const level = JOURNEY_LEVELS.find(l => l.level === station.level)!
  const next = recommended.ref && missionModule(recommended.ref)
  const nextHref = next ? missionLessonHref(next.ref) : recommended.station === "delivery" ? "/mission/space?station=delivery#mission-dossier" : "/explore/space-exploration/spot-a-world?mission=space"
  const nextTitle = next ? next.title : recommended.station === "delivery" ? "复查完整任务档案" : "我的第一张星球照片"
  useEffect(() => { if (selected || ready) stageReady(station.film) }, [selected, ready, station.film, stageReady])
  const records = JOURNEY_IDS.filter(id => hasJourneyEvidence(projects[id]))
  const failed = Object.values(nodes).filter(v => v === "unknown").length
  const stops: CampusStop[] = JOURNEY_STATIONS.map((place, i) => {
    const values = place.steps.map(ref => nodes[ref]), count = values.filter(nodeHasRecord).length
    const state = values.some(v => v === "loading") ? "loading" : values.some(v => v === "unknown") ? "unknown" : count || values.some(v => v === "draft") ? "draft" : "new"
    return { ...ROVER_CAMPUS_POINTS[i], id: place.id, label: place.place, state,
      statusLabel: i === 0 ? "任选一个体验即可出发" : `${count} / ${values.length} 步留有学习记录` }
  })
  const resources = MISSION_MODULES.filter(m => m.station === station.id && m.mode !== "lesson")
  return <main className={s.journey} data-space-journey data-curriculum-version="1.0">
    <header className={s.topbar}><Link href="/library?view=lines"><ArrowLeft size={16}/>所有项目线</Link><span>星际远航 / 火星地形观察远征</span><Link href="/mission/space/control" data-mission-center-entry><ClipboardList size={15}/>任务中心</Link><a href="#mission-dossier"><FileCheck2 size={15}/>我的远征档案</a></header>
    <section className={s.hero}><img src="/mission/rover/pointing-1920.webp" alt="任务搭档林岚在控制席邀请你加入远征" fetchPriority="high"/><div className={s.heroCopy}><p className={s.kicker}>一个目标，同一辆车，持续升级。</p><h1>从第一次观察，<br/>到自己的火星探测任务。</h1><p>接下任务，设计并打印你的车。<br/>再为它训练视觉、接通控制，带着证据完成远征。</p><div className={s.heroActions}><Link href={nextHref} data-journey-start><Compass size={18}/>{next ? "接着我的任务继续" : recommended.station === "delivery" ? "复查我的任务档案" : "从 3 分钟观察开始"}<ArrowRight size={17}/></Link><button onClick={openFilm}><Play size={15}/>火星探索序章 · 29 秒</button></div><a className={s.heroMap} href="#journey-map">展开我的任务地图<Map size={14}/></a><small>8 个任务站 · 同一份工程档案 · 从观察到远征</small></div><div className={s.heroNote}>任务搭档 / 林岚<small>AI 生成的虚构场景与角色</small></div></section>
    <div className={s.body}>
      <section className={s.roleSection} aria-label="五幕远征任务"><header><span>这次远征，怎样一步步完成</span><small>从提出问题，到拿出自己的测试证据</small></header><div className={s.roles}>{JOURNEY_LEVELS.map(item => <button key={item.level} data-journey-level={item.level} aria-pressed={item.level === station.level} onClick={() => { setSelected(JOURNEY_STATIONS.find(s => s.level === item.level)!.id); document.getElementById("journey-map")?.scrollIntoView({ behavior: "smooth" }) }}><small>0{item.level}</small><strong>{item.role}</strong><span>{item.task}</span></button>)}</div></section>
      <section className={s.next} aria-label="建议下一步"><Flag size={23}/><div><p>{ready ? "从已有记录继续" : "正在读取记录，也可以直接开始"} / {JOURNEY_STATIONS.find(s => s.id === recommended.station)?.place}</p><h2>{nextTitle}</h2><span>{next ? "本节记录仍存放在原课堂。完成当前任务后，再接下一步。" : "三个体验任选一个，不必全部通关才开始设计。"}</span></div><Link href={nextHref}>进入这一步<ArrowRight size={17}/></Link></section>
      <section id="journey-map" className={s.mapSection}><header className={s.sectionHead}><div><p>YOUR MARS OBSERVATION MISSION</p><h2>每一站，都接着你的作品继续。</h2></div><span>8 个任务站 / 从观察到交付</span></header><p className={s.note}>地图连线给出推荐顺序；等待打印时可以先去视觉训练站。短体验不是制作的硬性前置，学习记录也不等于能力验收。</p>
        <RoverCampusSurface stops={stops} current={recommended.station} selected={station.id} onSelect={setSelected} title="星际远航 · 火星地形观察远征" subtitle="观察 → 设计 → 制造 → 视觉与控制 → 远征交付" mapMotto="让下一步，接住你已经做出的作品。" taskId={taskId}/>
        <div className={s.mapGuide}><span>拖动探索 · ＋ / − 缩放 · 选择地点查看任务步骤</span><span>打印车与模型在 06 汇合，07 执行远征，08 交付</span></div>
        <section id={taskId} className={s.station} aria-label="当前任务站" data-journey-station={station.id}>
          <div className={s.stationIntro}><div className={s.operator}><img src="/mission/rover/engineer-960.webp" alt="任务搭档林岚"/><div><p>{station.code} / {level.role}</p><h3>{station.place}</h3></div></div>{station.film && <button type="button" className={s.stageReplay} data-stage-replay={station.film} onClick={replayStage}><Play size={14}/>重播这段任务简报</button>}<p className={s.message}>{station.message}</p><div className={s.handoff}><Layers size={17}/><div><strong>接着已有作品，带回新的证据</strong><p>{station.handoff}</p></div></div><p className={s.preparation}><Wrench size={15}/>{station.input}</p><p className={s.note}>{station.gate}</p>{station.steps.length > 0 && <Link className={c.stageAction} href={missionLessonHref(station.steps.find(ref => !nodeHasRecord(nodes[ref])) || station.steps[0])}>进入本站下一步<ArrowRight size={16}/></Link>}
            {station.id === "autonomy" && <div className={c.bridge}><strong>工程衔接 · 待样机验证</strong><p>Pi 与 Pico 通讯、供电和安装件，以及目标路线闭环尚需验证。旧车型材料供学习原理，不能照旧采购金属底盘或宣称打印车已完成自主验收。</p></div>}
          </div>
          <div>{station.id === "first-contact" ? <div className={s.projects}>{station.projects.map(id => { const p = journeyProject(id); return <article key={id} data-journey-project={id}><img {...projectCoverProps(id,p.cover,"card")} alt="" loading="lazy"/><div><div className={s.projectMeta}><span>约 3 分钟</span><span>{projects[id].label}</span></div><h4>{p.title}</h4><p>{p.outcome}</p><Link href={`${p.href}?mission=space`}>开始体验<ArrowRight size={16}/></Link></div></article> })}<Link className={c.stageAction} href={stationStartHref("mission-design")}>已有一次观察，去设计任务<ArrowRight size={16}/></Link></div> : <ol className={c.taskSteps} aria-label="本站课程步骤">{station.steps.map((ref,i) => { const node = missionModule(ref)!; return <li key={ref}><Link href={missionLessonHref(ref)} data-mission-step={ref} data-recorded={nodeHasRecord(nodes[ref])}><span>{String(i + 1).padStart(2,"0")}</span><div><strong>{node.title}</strong><small>{node.kind === "full" ? "工程课程" : "引导课程"} · {node.module} · <em>{nodeProgressLabel(nodes[ref])}</em></small></div><ArrowRight size={16}/></Link></li> })}</ol>}
            {resources.length > 0 && <details className={c.taskResources}><summary>合并材料与选修说明 · {resources.length} 项</summary>{resources.map(node => <Link href={missionLessonHref(node.ref)} key={node.ref}>{node.module} · {node.title}<br/><small>{node.mode === "optional" ? "选修，不阻塞主线" : node.mode === "replaced" ? "旧金属底盘操作已由打印课承接" : "作为当前任务材料，复用同一份交付"}</small></Link>)}</details>}
          </div>
        </section>
      </section>
      <SpaceMissionDossier/>
      <section id="journey-portfolio" className={s.portfolio}><header className={s.sectionHead}><div><p>ORIGINAL WORK · STILL YOURS</p><h2>原来的作品和课程，随时可查。</h2></div><button onClick={() => { setNodes(initialMissionProgress()); setProjects(waitingProgress()); setAttempt(n => n + 1) }} disabled={!ready}><RotateCcw size={14}/>刷新进展</button></header><p className={s.note}>{token ? "读取当前账号的原课程记录。三分钟体验仍使用本机相册，未自动归入账号。" : "访客记录保存在本机；完整工程登录后读取账号进展。"}提交记录、完成标记和能力评阅分别看待。</p>{failed > 0 && <p className={s.warning} role="status">{failed} 项学习记录暂未读全，请刷新重试；不会将读取失败算作未完成。</p>}<details className={s.allProjects}><summary><span><FileCheck2 size={17}/>原项目入口与历史作品</span><span>{records.length} 项已有作品记录</span></summary><div>{[JOURNEY_IDS.slice(0,6),JOURNEY_IDS.slice(6)].map((ids,i) => <section key={i}>{ids.map(id => { const p = journeyProject(id); return <Link key={id} href={p.href} data-journey-record={id}><FileCheck2 size={16}/><div><strong>{p.title}</strong><span>{projects[id].label}</span><small>{projects[id].note}</small></div><ArrowRight size={16}/></Link> })}</section>)}</div></details></section>
      <aside className={c.sideQuest}><div><small>独立研究支线 / 不计入探测车必修</small><h3>想继续追问远方？寻找行星的影子。</h3><p>Lightkurve 用真实光变数据研究行星候选信号。它不要求你先造完探测车，也不会成为本次远征的前置锁。正式课堂接入待确认，可以先返回项目库了解这条研究支线。</p></div><Link href="/library?view=lines&line=space-exploration">返回项目库查看<ArrowRight size={14}/></Link></aside>
      <section className={s.parents}><div><p>给一起出发的家长</p><h2>陪他开始，逐步把决定交给他。</h2><span>先做出一点成果，再增加阅读、设计、制作与独立判断。地图让孩子知道当前为哪一个目标学习。</span></div><ol>{JOURNEY_LEVELS.map(item => <li key={item.level}><span>0{item.level}</span><div><strong>{item.role}</strong><p>{item.support}</p><small>这一幕留下：{item.evidence}</small></div></li>)}</ol></section><p className={s.boundary}>本线执行地面类比任务；轨道影像模型能否适用于地面相机需要实测。工程档案保存不代表通过能力评阅或获得工程师职业资质。</p>
    </div>
  </main>
}
