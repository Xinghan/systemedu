"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, FileCheck2, Map } from "lucide-react"
import { missionContext, missionLessonHref, missionMapHref, missionModule, missionSupport, sourceLessonHref, type MissionStation } from "@/lib/project-lines/space-curriculum"
import { SpaceStageBriefing } from "./space-stage-briefing"
import { useLearningRecord } from "@/lib/hooks/use-learning-record"
import { INITIAL_MISSION_BODY, MISSION_DOSSIER_SCOPE, dossierFrom } from "@/lib/project-lines/space-mission-dossier"
import { JOURNEY_DELIVERIES } from "@/lib/project-lines/space-journey"
import s from "./space-mission-curriculum.module.css"

type Context = NonNullable<ReturnType<typeof missionContext>>
export function MissionLessonBrief({ context }: { context: Context }) {
  const { station, node } = context
  const delivery = JOURNEY_DELIVERIES[node.project]
  return <section className={s.lessonBrief} data-mission-context={station.id}>
    <nav><Link href={missionMapHref(station.id)}><Map size={15}/>任务地图 / {station.code} {station.place}</Link>{delivery && <Link href={`${missionLessonHref(`${node.project}:${delivery.module}`)}#project-delivery`}>查看我的最终作品</Link>}<Link href="/mission/space#mission-dossier"><FileCheck2 size={15}/>我的远征档案</Link></nav>
    <p className={s.kicker}>火星地形观察远征 · 当前任务</p><h2>{station.message}</h2>
    <div className={s.handoffPair}><p><small>带着什么来</small>{station.input}</p><p><small>这一站带走什么</small>{station.handoff}</p></div>
    <MyMissionGoal station={station.id}/>
    <details className={s.mobileOutline}><summary>查看本站任务步骤</summary><MissionLessonOutline station={station} current={context.primary}/></details>
    {node.note && <p className={s.contextNote}>{node.note}</p>}
    {station.id === "autonomy" && <p className={s.contextNote}>本任务使用同一辆打印车升级。Pi↔Pico、供电、安装件及到点闭环尚需样机验证；旧车型操作只作参考，不据此认定新系统已通过。</p>}
    {station.id === "expedition" && <p className={s.contextNote}>先用现有五步远征流程收集实地证据。人工逐段操作是演练；自主任务另需路线、到点与停止证据，不能将旧演练记录改称自主完成。</p>}
    {station.film && <SpaceStageBriefing level={station.film}/>}
    <details className={s.sourceDetails}><summary>课程来源与原有记录</summary><p>当前材料来自 {node.project} / {node.module}。原课堂回答、作业和实验保存位置不变；任务地图只改变学习次序。</p><Link href={sourceLessonHref(node)}>按原课程顺序查看本节与历史记录 <ArrowRight size={14}/></Link></details>
  </section>
}
function MyMissionGoal({ station }: { station: string }) {
  const record = useLearningRecord(MISSION_DOSSIER_SCOPE, INITIAL_MISSION_BODY)
  const goal = record.body.answers.find(a => a.question_id === "goal")?.answer
  const dossier = dossierFrom(record.body)
  const expected: Record<string, string[]> = {
    mechanics: ["pick-an-observation-site", "plan-a-payload"], build: ["tune-a-chassis", "write-driving-rules"],
    perception: ["label-the-terrain"], autonomy: ["assemble-a-rover", "label-the-terrain", "write-driving-rules"],
    expedition: ["pick-an-observation-site", "plan-a-payload", "assemble-a-rover"], delivery: ["run-an-expedition"],
  }
  const linked = [...new Set((dossier?.links || []).filter(e => expected[station]?.includes(e.scope.library_slug)).map(e => e.scope.library_slug))]
  return <>{goal ? <p className={s.myGoal}>我的任务：{goal}</p> : <p className={s.hint}>还没有写下自己的观察目标？可以随时在<Link href="/mission/space#mission-dossier">远征档案</Link>中补充，不影响先学习。</p>}{linked.length > 0 && <details className={s.sourceDetails}><summary>已带来的任务材料 · {linked.length} 类</summary>{linked.map(project => { const evidence = dossier!.links.filter(e => e.scope.library_slug === project).at(-1)!; return <div key={project}><p>{evidence.summary}</p><small>{evidence.scope.module_id} · 版本 {evidence.scope.content_version} · {dossier?.checks?.[project]?.message || "已关联，需复核"}</small><Link href="/mission/space#mission-dossier">核对来源与版本</Link></div> })}</details>}</>
}
export function MissionLessonOutline({ station, current }: { station: MissionStation; current: string }) {
  return <nav className={s.outline} data-mission-outline aria-label="本站任务步骤"><p>{station.code} / {station.place}</p>{station.steps.map((ref, index) => { const node = missionModule(ref)!; return <Link key={ref} href={missionLessonHref(ref)} aria-current={ref === current ? "step" : undefined}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{node.title}</strong><small>{node.kind === "full" ? "工程课程" : "引导课程"} · {node.module}</small></div></Link> })}<Link href={missionMapHref(station.id)}><Map size={14}/>返回地图选择其他任务站</Link></nav>
}
export function MissionSupportingLessons({ context }: { context: Context }) {
  const nodes = missionSupport(context.primary)
  if (!nodes.length) return null
  return <aside className={s.support} data-mission-support><h3>为这一步调用的课程材料</h3><p>继续使用同一份数据与作品。复查、分析和工程说明汇入当前任务，不重新做一套相同交付。</p>{nodes.map(node => <Link key={node.ref} href={missionLessonHref(node.ref)}><span>{node.module} · {node.title}<small>{node.mode === "replaced" ? "旧方案对照；制造以打印车课程为准" : node.note || "在本任务中学习和使用"}</small></span><ArrowRight size={14}/></Link>)}</aside>
}
export function MissionReferenceAssignment({ context }: { context: Context }) {
  const target = context.node.anchor && missionModule(context.node.anchor)
  return <section className={s.support} data-mission-merged-assignment><h3>{context.node.mode === "replaced" ? "制造沿用当前打印车" : "把这部分证据汇入当前任务"}</h3><p>{context.node.note || "使用当前远征的计划、日志和观察完成这部分分析。保留首次失败和修订，不再提交第二套相同的远征作品。"}</p>{target && <Link href={missionLessonHref(target.ref)}>回到任务步骤：{target.title}<ArrowRight size={14}/></Link>}<Link href="/mission/space#mission-dossier">整理到我的远征档案<ArrowRight size={14}/></Link><Link href={sourceLessonHref(context.node)}>查看原课作业与历史记录<ArrowRight size={14}/></Link></section>
}
export function MissionLessonFooter({ context }: { context: Context }) {
  if (context.node.mode !== "lesson") return <nav className={s.lessonFooter} data-mission-footer aria-label="回到远征任务"><Link href={missionMapHref(context.station.id)}><ArrowLeft size={16}/>任务地图</Link><Link href={context.primary ? missionLessonHref(context.primary) : "/mission/space?station=first-contact#journey-map"}>回到当前任务<ArrowRight size={16}/></Link></nav>
  return <nav className={s.lessonFooter} data-mission-footer aria-label="按远征任务继续学习">{context.previous ? <Link href={missionLessonHref(context.previous)}><ArrowLeft size={16}/>上一步</Link> : <Link href={missionMapHref("first-contact")}><ArrowLeft size={16}/>启程观测港</Link>}{context.next ? <Link href={missionLessonHref(context.next)}>下一步：{missionModule(context.next)!.title}<ArrowRight size={16}/></Link> : <Link href="/mission/space?station=delivery#mission-dossier">整理我的任务档案<ArrowRight size={16}/></Link>}</nav>
}

/** Explicitly adopt the student's brief into an empty field plan; never overwrite trials. */
export function MissionBriefImport({ canApply, apply }: { canApply: boolean; apply: (goal: string, site: string) => void }) {
  const record = useLearningRecord(MISSION_DOSSIER_SCOPE, INITIAL_MISSION_BODY)
  const goal = record.body.answers.find(a => a.question_id === "goal")?.answer || ""
  const site = record.body.answers.find(a => a.question_id === "site")?.answer || ""
  return <div className={s.support}><h3>沿用我的远征简报</h3><p>{goal || "先在远征档案写下观察目标，再带到这里。"}</p>{site && <p>计划场地：{site}</p>}<button type="button" disabled={!record.ready || !goal.trim() || !canApply} onClick={() => apply(goal, site)}>将简报带入这个空白任务</button>{!canApply && <p>当前已有任务内容，保留原方案；可对照上方简报自行修订。</p>}<Link href="/mission/space#mission-dossier">查看并修订任务简报</Link></div>
}
