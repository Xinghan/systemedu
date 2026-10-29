"use client"

import Link from "next/link"
import { useEffect, useId, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { missionLessonHref, missionModule, routeStations, routeSteps } from "@/lib/project-lines/space-curriculum"
import { initialMissionProgress, readMissionProgress, nodeHasRecord, nodeProgressLabel } from "@/lib/project-lines/space-mission-progress"
import { RoverCampusSurface, type CampusStop } from "@/components/learning/rover-campus-surface"
import { SpaceRouteNavigation } from "./space-route-navigation"
import s from "./space-transit-journey.module.css"

export const TRANSIT_MAP_POINTS = [
  {x:260,y:260,path:"M260 260 H760"}, {x:760,y:260,path:"M760 260 H1260"},
  {x:1260,y:260,path:"M1260 260 V720"}, {x:1260,y:720,path:"M1260 720 H760"},
  {x:760,y:720,path:"M760 720 H260"}, {x:260,y:720},
]
const stations = routeStations("transit"), steps = routeSteps("transit")
const title = "抓住行星的影子"

export function SpaceTransitJourney() {
  const identity = useLearningIdentity(), search = useSearchParams()
  return <TransitSession key={`${identity.owner}:${search.get("station") || ""}`} {...identity}/>
}
function TransitSession({token, owner}: {token: string | null; owner: string}) {
  const search = useSearchParams(), taskId = useId()
  const [selected, setSelected] = useState(stations.find(s => s.id === search.get("station"))?.id || "")
  const [nodes, setNodes] = useState(initialMissionProgress), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void readMissionProgress(token, owner, (ref, value) => { if (active) setNodes(n => ({...n, [ref]: value})) })
    return () => { active = false }
  }, [token, owner, attempt])
  const next = steps.find(ref => !nodeHasRecord(nodes[ref]))
  const current = next ? missionModule(next)!.station : stations.at(-1)!.id
  const station = stations.find(s => s.id === (selected || current))!
  const done = steps.filter(ref => nodeHasRecord(nodes[ref])).length
  const failed = steps.filter(ref => nodes[ref] === "unknown").length
  const ready = steps.every(ref => nodes[ref] !== "loading")
  const stops: CampusStop[] = stations.map((place, i) => ({...TRANSIT_MAP_POINTS[i], id: place.id, label: place.place,
    state: place.steps.some(ref => nodes[ref] === "loading") ? "loading" : place.steps.some(ref => nodes[ref] === "unknown") ? "unknown" : place.steps.some(ref => nodeHasRecord(nodes[ref])) ? "draft" : "new",
    statusLabel: `${place.steps.filter(ref => nodeHasRecord(nodes[ref])).length} / ${place.steps.length} 步留有学习记录`,
  }))
  return <main className={s.page} data-transit-journey>
    <header className={s.topbar}><Link href="/library?view=lines"><ArrowLeft size={16}/>所有项目线</Link><span>星际远航 / 凌星调查</span><Link href={`/mission/space/control?task=${encodeURIComponent(next || steps.at(-1)!)}`}>我的任务中心<ArrowRight size={16}/></Link></header>
    <SpaceRouteNavigation route="transit"/>
    <section className={s.hero}><p className={s.eyebrow}>LIGHTKURVE · OBSERVE / QUESTION / REPRODUCE</p><h1>{title}</h1><p>一颗恒星短暂变暗，能告诉我们什么？<br/>从真实观测出发，保留反例，让另一段数据检验自己的判断。</p><div className={s.summary}><span>六阶段 · 32 个原课程节点</span><span>一台电脑即可开始</span><span>无需先完成火星车路线</span></div><Link className={s.primary} href={missionLessonHref(next || steps.at(-1)!)}>{next ? "继续调查：" + missionModule(next)!.title : "复查最终研究档案"}<ArrowRight size={18}/></Link><a href="#journey-map">查看完整调查路线 ↓</a></section>
    <section className={s.status} aria-label="凌星调查进度"><div><strong>{ready ? done : "—"} / 32</strong><span>原课堂有完成标记 · 不等于能力验收</span></div><button disabled={!ready} onClick={() => {setNodes(initialMissionProgress());setAttempt(n => n+1)}}><RefreshCw size={16}/>刷新原记录</button></section>
    {!token && <p className={s.note}>登录后读取原课程完成标记；任务中心的访客自检与计时保存在本机。原课堂回答、作业和实验产物仍在原位置。</p>}
    {failed > 0 && <p role="status" className={s.note}>{failed} 节记录读取失败，未按未完成处理。可以重试或直接选择任务。</p>}
    <section id="journey-map" className={s.map}><h2>带着上一站的证据，进入下一站。</h2><p>原课程的六个阶段完整保留。连线给出研究顺序；你可以随时回查，不会因另一条路线未完成而锁课。</p>
      <RoverCampusSurface stops={stops} current={current} selected={station.id} onSelect={setSelected} title="星际远航 · 凌星调查路线" subtitle="猜想 → 数据处理 → 周期 → 反例 → 独立验证 → 复现" mapMotto="支持、反对和未知，都应留下证据。" taskId={taskId} imageSrc="/mission/space/transit-map.svg" imageAlt="六站观测研究流程示意，按数据和证据的交接顺序连接。"/>
      <section id={taskId} className={s.station} data-transit-station={station.id}><div><p className={s.eyebrow}>{station.code} / {station.place}</p><h2>{station.message}</h2><dl><dt>带着什么来</dt><dd>{station.input}</dd><dt>这一站带走什么</dt><dd>{station.handoff}</dd><dt>怎样检查</dt><dd>{station.gate}</dd></dl><Link className={s.primary} href={`/mission/space/control?task=${encodeURIComponent(station.steps.find(ref => !nodeHasRecord(nodes[ref])) || station.steps[0])}`}>打开本站任务单<ArrowRight size={16}/></Link></div><ol>{station.steps.map(ref => {const node = missionModule(ref)!;return <li key={ref}><Link href={missionLessonHref(ref)} data-mission-step={ref}><small>{node.module} · {nodeProgressLabel(nodes[ref])}</small><strong>{node.title}</strong><ArrowRight size={16}/></Link></li>})}</ol></section>
    </section>
    <SpaceTransitDossier/>
    <details className={s.sources}><summary>查看全部 32 节的来源与去向</summary><p>任务编排沿用原课程稳定标识和版本，不合并或删除原作业。</p>{stations.map(station => <section key={station.id}><h3>{station.code} · {station.place}</h3>{station.steps.map(ref => <Link key={ref} href={missionLessonHref(ref)}>{missionModule(ref)!.module} · {missionModule(ref)!.title}<ArrowRight size={14}/></Link>)}</section>)}</details>
    <p className={s.note}>这里复现已知目标的凌星信号，并检查结论的边界；出现候选周期、保存成功或个人自检完成，都不等于发现了新行星。</p>
  </main>
}

export function SpaceTransitDossier() {
  return <section id="mission-dossier" className={s.dossier}><p className={s.eyebrow}>EVIDENCE / REPRODUCTION</p><h2>同一份研究，留下六次交接。</h2><p>在原课堂保存回答、实验产物和作业版本；在任务中心记录自检、阻碍与用时。这里的入口回到原记录，不创建另一份作业。</p><ol>{stations.map(station => <li key={station.id}><strong>{station.place}</strong><span>{station.handoff}</span><Link href={missionLessonHref(station.steps.at(-1)!)}>复查本阶段产物<ArrowRight size={14}/></Link></li>)}</ol><Link className={s.primary} href={missionLessonHref("lightkurve-transit-detective:M32")}>打开最终交付与历史作业<ArrowRight size={16}/></Link><Link href="/library/lightkurve-transit-detective">原课程目录与正式资料<ArrowRight size={16}/></Link></section>
}
