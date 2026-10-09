"use client"

/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, ChevronRight, Circle, Compass, FileCheck2, Flag, LoaderCircle, Map, Play, Radio, RotateCcw, Wrench, X } from "lucide-react"
import type { GuidedModule } from "@/lib/project-lines/guided-course"
import { learningRecords, type LearningBody, type LearningScope } from "@/lib/api/learning-records"
import { learningCacheKey } from "@/lib/learning-record-session"
import { MISSION_STATUS_LABEL, ROVER_BRIEFS, ROVER_COURSE_PATH, ROVER_DELIVERY_SCOPE, ROVER_WORK_SCOPE, missionNodeHref, missionNodeStatus, roverEvidenceSummary } from "@/lib/project-lines/rover-mission"
import s from "./rover-mission-center.module.css"
import { RoverCampusMap, type RoverMapProps } from "./rover-campus-map"

type MapProps = RoverMapProps

export function RoverMissionMap(props: MapProps) {
  return <RoverCampusMap {...props}><RoverMissionDirectory {...props} /></RoverCampusMap>
}

function RoverMissionDirectory({ course, record, loaded, failed, current }: MapProps) {
  return <div className={s.map} aria-label="探测车任务简洁目录">
    {course.stages.map((stage, i) => <section key={stage.stage_id} className={s.stage}>
      <header><span>0{i + 1}</span><div><small>{["MISSION CONTROL", "PROTOTYPE LAB", "FABRICATION & FIELD"][i]}</small><h3>{stage.title}</h3></div></header>
      <ol>{course.modules.filter(node => node.stage_id === stage.stage_id).map(node => {
        const status = missionNodeStatus(record.nodes[node.module_id], loaded, failed.includes(node.module_id))
        return <li key={node.module_id} data-status={status}>
          <Link href={missionNodeHref(node.module_id)} aria-current={current === node.module_id ? "step" : undefined} data-directory-node={node.module_id}>
            <span className={s.pin}>{status === "submitted" ? <Check size={15} /> : current === node.module_id ? <Compass size={16} /> : <Circle size={12} />}</span>
            <div><span className={s.nodeMeta}>{node.module_id} <i>·</i> {node.estimated_minutes} 分钟目标</span><strong>{node.title}</strong><small>{MISSION_STATUS_LABEL[status]}</small></div><ChevronRight size={15} />
          </Link>
        </li>
      })}</ol>
    </section>)}
  </div>
}

// Read-only observers: never create a second writable workbench session.
async function readEvidence(token: string | null, owner: string, scope: LearningScope) {
  let raw: string | null = null
  try { raw = localStorage.getItem(learningCacheKey(owner, scope)) } catch { if (!token) throw new Error("Storage unavailable") }
  let cache: { body: LearningBody; dirty: boolean; submittedAt?: string } | null = null
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed.version !== 1 || typeof parsed.dirty !== "boolean" || !Array.isArray(parsed.body?.answers) || !parsed.body.answers.every((a: { answer?: unknown }) => typeof a?.answer === "string")) throw new Error("Invalid record")
      cache = parsed
    } catch { if (!token) throw new Error("Local record unreadable") }
  }
  if (!token) return { body: cache?.body ?? null, submittedAt: cache?.dirty ? undefined : cache?.submittedAt }
  const remote = await learningRecords.read(token, scope)
  if (cache?.dirty && scope.kind !== "assignment") return { body: cache.body, submittedAt: undefined }
  if (scope.kind === "assignment") return { body: remote.submissions[0]?.body ?? null, submittedAt: remote.submissions[0]?.created_at }
  return { body: remote.draft?.body ?? null, submittedAt: undefined }
}

function EvidenceBoard({ token, owner }: { token: string | null; owner: string }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ ready: boolean; error: boolean; work: LearningBody | null; delivery: LearningBody | null; submittedAt?: string }>({ ready: false, error: false, work: null, delivery: null })
  useEffect(() => {
    let active = true
    void Promise.all([readEvidence(token, owner, ROVER_WORK_SCOPE), readEvidence(token, owner, ROVER_DELIVERY_SCOPE)]).then(([work, delivery]) => {
      if (active) setState({ ready: true, error: false, work: work.body, delivery: delivery.body, submittedAt: delivery.submittedAt })
    }).catch(() => { if (active) setState({ ready: true, error: true, work: null, delivery: null }) })
    return () => { active = false }
  }, [token, owner, attempt])
  const summary = roverEvidenceSummary(state.work, state.delivery, state.submittedAt)
  const unknown = state.error || summary.invalid
  return <section className={s.evidence} aria-label="作品真实进展">
    <div className={s.sectionTitle}><div><p>YOUR EVIDENCE</p><h2>每一步，留下能检查的作品。</h2></div><Link href={missionNodeHref("M08", "#project-delivery")}>查看交付要求 <ArrowRight size={16} /></Link></div>
    <div className={s.evidenceGrid}>
      <Link href={missionNodeHref("M05", "#lesson-practice")}><Compass size={22} /><span>数字原型检查</span><strong data-digital-progress>{!state.ready ? "读取中" : unknown ? "待读取" : `${summary.digital} / ${summary.digitalTotal}`}</strong><small>接口、设计比较、诊断与新路线</small></Link>
      <Link href={missionNodeHref("M06", "#lesson-practice")}><Wrench size={22} /><span>实物材料检查</span><strong data-physical-progress>{!state.ready ? "读取中" : unknown ? "待读取" : `${summary.physical} / ${summary.physicalTotal}`}</strong><small>打印、程序、实测与照片</small></Link>
      <Link href={missionNodeHref("M08", "#project-delivery")}><FileCheck2 size={22} /><span>作品交付</span><strong className={s.deliveryText} data-mission-delivery>{!state.ready ? "读取中" : unknown ? "待读取" : summary.submitted ? "已交付 · 待评阅" : "尚未交付"}</strong><small>实物作品与测试档案的提交版本</small></Link>
    </div>
    <p className={s.note}>数字检查通过后，仍需完成实物制作与自测；材料齐备不代表已评定掌握。{token ? "记录与当前账号关联。" : "当前为访客，记录仅保存在本机。"}</p>
    {unknown && <p className={s.warning} role="status">作品进度暂未完整读取，原记录没有改动。<button onClick={() => { setState(s => ({ ...s, ready: false, error: false })); setAttempt(a => a + 1) }}><RotateCcw size={14} />重新读取作品进度</button></p>}
  </section>
}

export function IntroFilm({ close, description, returnLabel = "回到制造任务" }: { close: () => void; description?: string; returnLabel?: string }) {
  const dialog = useRef<HTMLDialogElement>(null), video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const d = dialog.current, v = video.current
    d?.showModal()
    const hide = () => { if (document.hidden) v?.pause() }
    document.addEventListener("visibilitychange", hide)
    return () => { v?.pause(); d?.close(); document.removeEventListener("visibilitychange", hide) }
  }, [])
  return <dialog ref={dialog} className={s.dialog} aria-label="前导任务短片" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close() }}>
    <div className={s.filmHeader}><span>前导任务 / 和林岚坐进控制席</span><button autoFocus onClick={close} aria-label="关闭任务短片"><X size={20} /></button></div>
    <video ref={video} src="/mission/rover/video/rover-briefing-v1.mp4" poster="/mission/rover/engineer-1920.webp" controls playsInline preload="metadata" onError={() => setError(true)}>
      <track default kind="captions" src="/mission/rover/video/rover-briefing-zh.vtt" srcLang="zh" label="中文字幕" />
    </video>
    <p>{description || "这是一次火星地形观察的模拟任务。本课程会进一步带你设计、3D 打印并测试桌面实物车。"}</p>
    {error && <p role="alert">短片未加载成功，可以直接开始课程。<button onClick={() => { setError(false); video.current?.load() }}>重新加载短片</button></p>}
    <div className={s.filmLinks}><Link href="/mission/rover">先体验 3 分钟前导任务 <ArrowRight size={15} /></Link><button onClick={close}>{returnLabel}</button></div>
  </dialog>
}

export function RoverMissionCenter({ course, record, loaded, failed, token, owner, retry }: MapProps & { token: string | null; owner: string; retry: () => void }) {
  const [film, setFilm] = useState(false)
  const next = course.modules.find(n => !record.nodes[n.module_id]?.submitted_at) ?? course.modules.at(-1)!
  const count = course.modules.filter(n => record.nodes[n.module_id]?.submitted_at).length
  return <main className={s.center} data-mission-center>
    <header className={s.header}><Link href="/mission/space?station=build#journey-map"><ArrowLeft size={16} />返回星际远航任务中心</Link><span><Radio size={15} /> 03 系统建造 / 本项目任务中心</span></header>
    <section className={s.hero}>
      <img className={s.heroImage} src="/mission/rover/pointing-1920.webp" alt="虚构任务搭档林岚在控制室等你加入" fetchPriority="high" />
      <div className={s.heroCopy}><p className={s.kicker}>你的角色 / 探测车系统设计师</p><h1>{course.title}</h1><p>从控制席走进制造间。让你设计的系统，<br />变成一辆能接受真实测试的探测车。</p><div className={s.heroActions}><Link className={s.primary} href={missionNodeHref(next.module_id)}>{loaded ? `${count ? "建议继续" : "开始任务"} · ${next.title}` : "查看第一个任务"}<ArrowRight size={17} /></Link><button onClick={() => setFilm(true)}><Play size={16} />前导任务短片 · 29 秒</button></div><small>8 个节点 · 保留原课程结构 · 可分次完成</small></div>
      <div className={s.operator}><span>任务搭档 / 林岚</span><small>AI 生成的虚构角色与场景</small></div>
    </section>
    <div className={s.centerBody}>
      <section className={s.dispatch}><div className={s.dispatchLabel}><Flag size={21} /><span>当前任务建议</span></div><div><p>{next.module_id} / {ROVER_BRIEFS[next.module_id].place}</p><h2>{next.title}</h2><span>{ROVER_BRIEFS[next.module_id].action}</span></div><Link href={missionNodeHref(next.module_id)}>进入任务 <ArrowRight size={18} /></Link></section>
      <section className={s.mapSection} id="mission-map"><div className={s.sectionTitle}><div><p>YOUR MISSION MAP</p><h2>造实物车的 8 个课程节点。</h2></div><span className={s.count} data-mission-record-progress>{loaded ? `${count} / ${course.modules.length} 节记录已提交` : <><LoaderCircle size={15} className={s.spin} />正在读取进度</>}</span></div>
        <p className={s.note}>沿着基地路线，从控制室走到作品交付现场。选择一个地点，查看任务和要带回的作品。</p>
        {failed.length > 0 && <p className={s.warning} role="status">部分节点进度尚未读取，不会按未完成计入。<button onClick={retry}>重新读取节点进度</button></p>}
        <RoverMissionMap course={course} record={record} loaded={loaded} failed={failed} current={next.module_id} />
      </section>
      <EvidenceBoard token={token} owner={owner} />
      <section className={s.preparation}><div><p>BEFORE FABRICATION</p><h2>先做数字原型，再准备实物。</h2><p>前五节可在浏览器内开始。制造阶段需要 3D 打印机或代打服务、简单低压器件和成人协助；不要求学生加工金属。</p><Link href="/project-lines/space-exploration/assemble-a-rover/hardware/build-guide.md" target="_blank">查看材料与制造说明 <ArrowRight size={15} /></Link></div><details><summary>课程安排与适用说明</summary><p>{course.audience}</p><p>{course.estimated_minutes} 分钟为累计设计目标。打印、采购等待可穿插安排。</p><Link href={`${ROVER_COURSE_PATH}?edition=1`}>查看旧版课程与原记录</Link></details></section>
    </div>
    {film && <IntroFilm close={() => setFilm(false)} />}
  </main>
}

export function RoverNodeBrief({ course, node, record, loaded, failed }: MapProps & { node: GuidedModule }) {
  const brief = ROVER_BRIEFS[node.module_id]
  return <section className={s.nodeBrief} data-scene={node.stage_id} aria-label="本节任务简报">
    <div className={s.nodeBar}><Link href={ROVER_COURSE_PATH}><Map size={16} />返回本项目任务中心</Link><span>{course.stages.find(stage => stage.stage_id === node.stage_id)?.title} / {node.module_id}</span></div>
    <div className={s.briefBody}><img src="/mission/rover/engineer-960.webp" alt="任务搭档林岚" /><div><p className={s.kicker}>{brief.place} / 林岚的简报</p><h2>{brief.message}</h2><div className={s.briefOutcome}><span>这次带回</span><strong>{node.output}</strong></div><p className={s.nodeHint}>{brief.action}</p><div className={s.briefLinks}><a href="#lesson-reading">先获取线索 <ArrowRight size={14} /></a><a href="#lesson-practice">进入任务工作台 <Wrench size={14} /></a><a href="#lesson-notebook">留下本节证据 <FileCheck2 size={14} /></a></div></div></div>
    <details className={s.inlineMap}><summary><Map size={15} />展开任务地图，查看我的进展</summary><RoverMissionMap course={course} record={record} loaded={loaded} failed={failed} current={node.module_id} /></details>
  </section>
}
