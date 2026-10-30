"use client"

/* eslint-disable @next/next/no-img-element -- Shared, precompressed mission imagery. */
import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { ArrowLeft, ArrowRight, ClipboardList, Compass, FileCheck2, Flag, Layers, Map, Wrench } from "lucide-react"
import { missionLessonHref, missionModule, type MissionStation, type SpaceRoute } from "@/lib/project-lines/space-curriculum"
import { nodeHasRecord, nodeProgressLabel, type MissionProgress } from "@/lib/project-lines/space-mission-progress"
import { SpaceRouteNavigation } from "./space-route-navigation"
import s from "./space-journey.module.css"
import c from "./space-mission-curriculum.module.css"

/** Both research routes use these same page sections, typography and interactions. */
export function SpaceJourneyTopbar({ route, title, controlHref, dossierLabel }: { route: SpaceRoute; title: string; controlHref: string; dossierLabel: string }) {
  return <><header className={s.topbar}><Link href="/library?view=lines"><ArrowLeft size={16}/>所有项目线</Link><span>星际远航 / {title}</span><Link href={controlHref} data-mission-center-entry><ClipboardList size={15}/>任务中心</Link><a href="#mission-dossier"><FileCheck2 size={15}/>{dossierLabel}</a></header><SpaceRouteNavigation route={route}/></>
}

export function SpaceJourneyHero({ image, alt, kicker, title, description, nextHref, nextLabel, action, summary }: {
  image: string; alt: string; kicker: string; title: ReactNode; description: ReactNode; nextHref: string; nextLabel: string; action: ReactNode; summary: string
}) {
  return <section className={s.hero} data-journey-section="hero"><img src={image} alt={alt} fetchPriority="high"/><div className={s.heroCopy}><p className={s.kicker}>{kicker}</p><h1>{title}</h1><p>{description}</p><div className={s.heroActions}><Link href={nextHref} data-journey-start><Compass size={18}/>{nextLabel}<ArrowRight size={17}/></Link>{action}</div><a className={s.heroMap} href="#journey-map">展开我的任务地图<Map size={14}/></a><small>{summary}</small></div><div className={s.heroNote}>任务搭档 / 林岚<small>AI 生成的虚构场景与角色</small></div></section>
}

export function SpaceJourneyRoles({ title, subtitle, items, selected, onSelect }: {
  title: string; subtitle: string; items: { id: string; role: string; task: string }[]; selected: string; onSelect: (id: string) => void
}) {
  return <section className={s.roleSection} aria-label={title} data-journey-section="stages"><header><span>{title}</span><small>{subtitle}</small></header><div className={s.roles} style={{ "--journey-act-count": items.length } as CSSProperties}>{items.map((item, i) => <button key={item.id} data-journey-level={item.id} aria-pressed={item.id === selected} onClick={() => { onSelect(item.id); document.getElementById("journey-map")?.scrollIntoView({ behavior: "smooth" }) }}><small>{String(i + 1).padStart(2, "0")}</small><strong>{item.role}</strong><span>{item.task}</span></button>)}</div></section>
}

export function SpaceJourneyNext({ ready, place, title, description, href }: { ready: boolean; place: string; title: string; description: string; href: string }) {
  return <section className={s.next} aria-label="建议下一步" data-journey-section="next"><Flag size={23}/><div><p>{ready ? "从已有记录继续" : "正在读取记录，也可以直接开始"} / {place}</p><h2>{title}</h2><span>{description}</span></div><Link href={href}>进入这一步<ArrowRight size={17}/></Link></section>
}

export function SpaceJourneyStationIntro({ station, role, nodes, briefing, portrait = "/mission/rover/engineer-960.webp", children }: {
  station: MissionStation; role: string; nodes: MissionProgress; briefing?: ReactNode; portrait?: string; children?: ReactNode
}) {
  return <div className={s.stationIntro}><div className={s.operator}><img src={portrait} alt="任务搭档林岚"/><div><p>{station.code} / {role}</p><h3>{station.place}</h3></div></div>{briefing}<p className={s.message}>{station.message}</p><div className={s.handoff}><Layers size={17}/><div><strong>接着已有作品，带回新的证据</strong><p>{station.handoff}</p></div></div><p className={s.preparation}><Wrench size={15}/>{station.input}</p><p className={s.note}>{station.gate}</p>{station.steps.length > 0 && <Link className={c.stageAction} href={missionLessonHref(station.steps.find(ref => !nodeHasRecord(nodes[ref])) || station.steps[0])}>进入本站下一步<ArrowRight size={16}/></Link>}{children}</div>
}

export function SpaceJourneyTaskSteps({ steps, nodes, courseLabel }: { steps: string[]; nodes: MissionProgress; courseLabel?: string }) {
  return <ol className={c.taskSteps} aria-label="本站课程步骤">{steps.map((ref, i) => { const node = missionModule(ref)!; return <li key={ref}><Link href={missionLessonHref(ref)} data-mission-step={ref} data-recorded={nodeHasRecord(nodes[ref])}><span>{String(i + 1).padStart(2, "0")}</span><div><strong>{node.title}</strong><small>{courseLabel || (node.kind === "full" ? "工程课程" : "引导课程")} · {node.module} · <em>{nodeProgressLabel(nodes[ref])}</em></small></div><ArrowRight size={16}/></Link></li> })}</ol>
}
