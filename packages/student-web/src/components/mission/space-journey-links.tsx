import Link from "next/link"
import { ArrowLeft, Map } from "lucide-react"
import { JOURNEY_LEVELS, journeyHref, journeyStationFor } from "@/lib/project-lines/space-journey"
import { SpaceStageBriefing } from "./space-stage-briefing"
import s from "./space-journey.module.css"

/** The original classroom continues to own its records and deliverables. */
export function SpaceJourneyProjectBanner({ projectId }: { projectId: string }) {
  const station = journeyStationFor(projectId)
  if (!station) return null
  const level = JOURNEY_LEVELS.find(item => item.level === station.level)!
  return <nav className={s.projectBanner} data-journey-return aria-label="项目在成长路线中的位置">
    <Link href={journeyHref(projectId)}><Map size={16} />星际远航 · 返回全线任务地图</Link>
    {station.film && <SpaceStageBriefing level={station.film} />}
    <div>0{station.level} / {level.role} · {station.place}<small>完成本项目后，回任务中心查看作品记录与下一站。</small></div>
  </nav>
}

export function SpaceMicroMission({ projectId, title }: { projectId: string; title: string }) {
  return <main className={s.microShell}>
    <nav className={s.microBar} data-journey-return aria-label="返回项目线">
      <Link href={journeyHref(projectId)}><ArrowLeft size={14} />星际远航 · 任务地图</Link><Link href="/explore/space-exploration/pick-an-observation-site?node=M01&mission=space">已有观察，去设计任务 →</Link>
      <SpaceStageBriefing level={1} />
    </nav>
    <iframe src={`/project-lines/space-exploration/${projectId}/index.html`} title={title} />
  </main>
}
