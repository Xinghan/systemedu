"use client"

import Link from "next/link"
import { useEffect, useId, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowRight, FileCheck2, FileText, RotateCcw } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { missionLessonHref, missionModule, routeStations, routeSteps } from "@/lib/project-lines/space-curriculum"
import { initialMissionProgress, readMissionProgress, nodeHasRecord, nodeProgressLabel } from "@/lib/project-lines/space-mission-progress"
import { TRANSIT_ACTS, TRANSIT_MAP_POINTS, TRANSIT_CAMPUS_IMAGE, TRANSIT_HERO_IMAGE } from "@/lib/project-lines/space-transit-presentation"
import { RoverCampusSurface, type CampusStop } from "@/components/learning/rover-campus-surface"
import { SpaceJourneyTopbar, SpaceJourneyHero, SpaceJourneyRoles, SpaceJourneyNext, SpaceJourneyStationIntro, SpaceJourneyTaskSteps } from "./space-journey-presentation"
import { TransitBriefingDialog, TransitStageBriefing } from "./space-transit-briefing"
import s from "./space-journey.module.css"
import c from "./space-mission-curriculum.module.css"

const stations = routeStations("transit"), steps = routeSteps("transit")

export function SpaceTransitJourney() {
  const identity = useLearningIdentity(), search = useSearchParams()
  return <TransitSession key={`${identity.owner}:${search.get("station") || ""}`} {...identity}/>
}
function TransitSession({ token, owner }: { token: string | null; owner: string }) {
  const search = useSearchParams(), taskId = useId()
  const [selected, setSelected] = useState(stations.find(s => s.id === search.get("station"))?.id || "")
  const [nodes, setNodes] = useState(initialMissionProgress), [attempt, setAttempt] = useState(0)
  const [briefing, setBriefing] = useState(false)
  useEffect(() => {
    let active = true
    void readMissionProgress(token, owner, (ref, value) => { if (active) setNodes(n => ({ ...n, [ref]: value })) })
    return () => { active = false }
  }, [token, owner, attempt])
  const next = steps.find(ref => nodes[ref] === "draft") || steps.find(ref => !nodeHasRecord(nodes[ref]))
  const current = next ? missionModule(next)!.station : stations.at(-1)!.id
  const station = stations.find(s => s.id === (selected || current))!
  const act = TRANSIT_ACTS.find(item => item.id === station.id)!
  const done = steps.filter(ref => nodeHasRecord(nodes[ref])).length
  const failed = steps.filter(ref => nodes[ref] === "unknown").length
  const ready = steps.every(ref => nodes[ref] !== "loading")
  const nextHref = next ? missionLessonHref(next) : "#mission-dossier"
  const nextTitle = next ? missionModule(next)!.title : "复查完整研究档案"
  const controlHref = `/mission/space/control?task=${encodeURIComponent(next || steps.at(-1)!)}`
  const stops: CampusStop[] = stations.map((place, i) => ({ ...TRANSIT_MAP_POINTS[i], id: place.id, label: place.place,
    state: place.steps.some(ref => nodes[ref] === "loading") ? "loading" : place.steps.some(ref => nodes[ref] === "unknown") ? "unknown" : place.steps.some(ref => nodeHasRecord(nodes[ref]) || nodes[ref] === "draft") ? "draft" : "new",
    statusLabel: `${place.steps.filter(ref => nodeHasRecord(nodes[ref])).length} / ${place.steps.length} 步留有学习记录`,
  }))
  return <main className={s.journey} data-transit-journey data-space-journey data-journey-format="space-v1">
    <SpaceJourneyTopbar route="transit" title="凌星调查" controlHref={controlHref} dossierLabel="我的研究档案"/>
    <SpaceJourneyHero image={TRANSIT_HERO_IMAGE} alt="任务搭档林岚在观测控制席邀请你一起调查恒星光变" kicker="一个问题，同一份证据，逐步验证。" title={<>从一次短暂变暗，<br/>到可复查的行星证据。</>} description={<>接下任务，寻找恒星亮度里的线索。<br/>再用反例和另一段观测，检验自己的猜想。</>} nextHref={nextHref} nextLabel={done || steps.some(ref => nodes[ref] === "draft") ? "接着我的调查继续" : "从第一项可检查的猜想开始"} action={<button onClick={() => setBriefing(true)}><FileText size={15}/>凌星调查简报 · 文字</button>} summary="6 个任务站 · 32 个原课程节点 · 同一份研究档案"/>
    <div className={s.body}>
      <SpaceJourneyRoles title="这次调查，怎样一步步完成" subtitle="从提出猜想，到让同伴独立复跑" items={[...TRANSIT_ACTS]} selected={station.id} onSelect={setSelected}/>
      <SpaceJourneyNext ready={ready} place={stations.find(s => s.id === current)!.place} title={nextTitle} description={next ? "本节记录仍存放在原课堂。留下当前证据，再接下一步调查。" : "完成标记不等于能力验收。回查首次结果、复跑记录与结论边界。"} href={nextHref}/>
      <section id="journey-map" className={s.mapSection} data-journey-section="map">
        <header className={s.sectionHead}><div><p>YOUR EXOPLANET TRANSIT INVESTIGATION</p><h2>每一站，都接着你的证据继续。</h2></div><span>6 个任务站 / 从猜想到复现</span></header>
        <p className={s.note}>地图连线给出推荐研究顺序；你可以随时回查原记录。先封存预测，再到独立观测验证站打开 Q4。无需先完成火星车路线。</p>
        <RoverCampusSurface stops={stops} current={current} selected={station.id} onSelect={setSelected} title="星际远航 · 凌星调查" subtitle="猜想 → 数据处理 → 周期 → 反例 → 独立验证 → 复现" mapMotto="让下一步，接住你已经留下的证据。" taskId={taskId} imageSrc={TRANSIT_CAMPUS_IMAGE} imageAlt="无人观测研究基地鸟瞰示意，六个任务站由道路连接。"/>
        <div className={s.mapGuide}><span>拖动探索 · ＋ / − 缩放 · 选择地点查看任务步骤</span><span>05 检验封存预测，06 复跑并交付 · 场景示意</span></div>
        <section id={taskId} className={s.station} aria-label="当前任务站" data-journey-station={station.id} data-transit-station={station.id}>
          <SpaceJourneyStationIntro station={station} role={act.role} nodes={nodes} portrait="/mission/space/transit/briefing-v1-960.webp" briefing={<TransitStageBriefing key={station.id} stationId={station.id}/>}/>
          <div><SpaceJourneyTaskSteps steps={station.steps} nodes={nodes} courseLabel="研究课程"/><Link className={c.stageAction} href={`/mission/space/control?task=${encodeURIComponent(station.steps.find(ref => !nodeHasRecord(nodes[ref])) || station.steps[0])}`}>打开本站任务单<ArrowRight size={16}/></Link></div>
        </section>
      </section>
      <SpaceTransitDossier/>
      <section id="journey-portfolio" className={s.portfolio} data-journey-section="records">
        <header className={s.sectionHead}><div><p>ORIGINAL WORK · STILL YOURS</p><h2>原来的证据和课程，随时可查。</h2></div><button onClick={() => { setNodes(initialMissionProgress()); setAttempt(n => n + 1) }} disabled={!ready}><RotateCcw size={14}/>刷新进展</button></header>
        <p className={s.note}>{token ? "读取当前账号的原课程完成标记。" : "登录后读取原课程进展；访客任务自检与计时保存在本机。"}课堂回答、实验产物、作业和历史版本仍在原位置；学习记录、个人自检和能力评阅分别看待。</p>
        {failed > 0 && <p role="status" className={s.warning}>{failed} 节学习记录暂未读全，请刷新重试；不会将读取失败算作未完成。</p>}
        <details className={s.allProjects}><summary><span><FileCheck2 size={17}/>原课程入口与历史作品</span><span>{ready ? done : "—"} / 32 节有原课完成标记</span></summary><div>{stations.map(place => <section key={place.id}><h3>{place.code} · {place.place}</h3>{place.steps.map(ref => <Link key={ref} href={missionLessonHref(ref)} data-journey-record={ref}><FileCheck2 size={16}/><div><strong>{missionModule(ref)!.module} · {missionModule(ref)!.title}</strong><span>{nodeProgressLabel(nodes[ref])}</span></div><ArrowRight size={16}/></Link>)}</section>)}</div></details>
      </section>
      <aside className={c.sideQuest}><div><small>星际远航 / 另一条研究路线</small><h3>也想动手探索地形？接下火星探测任务。</h3><p>从观察出发，设计、打印、训练并测试自己的探测车。两条路线可以分别开始，原课程和任务记录持续保留。</p></div><Link href="/mission/space?route=rover#journey-map">进入火星探索地图<ArrowRight size={14}/></Link></aside>
      <section className={s.parents} data-journey-section="support"><div><p>给一起出发的家长</p><h2>陪他提问，把判断交给证据。</h2><span>一台电脑即可开始。陪伴的重点是保留问题、失败和第一次判断，让孩子逐步解释自己的选择。</span></div><ol>{TRANSIT_ACTS.map((item, i) => <li key={item.id}><span>{String(i + 1).padStart(2, "0")}</span><div><strong>{item.role}</strong><p>{item.support}</p><small>这一站留下：{stations[i].handoff}</small></div></li>)}</ol></section>
      <p className={s.boundary}>本线复现已知目标的凌星信号，并检查结论边界；候选周期、保存成功或个人自检完成，都不等于发现新行星或通过能力评阅。</p>
    </div>
    {briefing && <TransitBriefingDialog stationId={current} close={() => setBriefing(false)}/>}
  </main>
}

export function SpaceTransitDossier() {
  return <section id="mission-dossier" className={c.dossier} data-transit-dossier aria-label="我的研究档案">
    <header><p>ONE INVESTIGATION · YOUR EVIDENCE</p><h2>同一个问题，一路积累的证据。</h2><span>六次交接回到原课堂的正式作品和历史版本。保留自己的问题、处理规则、首次结果与后来修订，让同伴能复查整个调查过程。</span></header>
    <details className={c.evidenceList} open><summary><FileCheck2 size={16}/>查看各阶段原作品<small>6 次交接 · 保存不等于验收通过</small></summary><p>正式作品在对应课堂提交；任务中心只记录自检、阻碍与用时。</p>{stations.map(station => <article key={station.id} data-transit-evidence={station.id}><div><strong>{station.code} · {station.place}</strong><span>{station.handoff}</span></div><Link className={c.stageAction} href={missionLessonHref(station.steps.at(-1)!)}>查看原作品<ArrowRight size={14}/></Link></article>)}</details>
    <Link className={c.stageAction} href={missionLessonHref("lightkurve-transit-detective:M32")}>打开最终交付与历史作业<ArrowRight size={16}/></Link><p className={c.hint}><Link href="/library/lightkurve-transit-detective">原课程目录与正式资料 →</Link></p>
  </section>
}
