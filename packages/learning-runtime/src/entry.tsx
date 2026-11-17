import { useCallback, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { activityFrom, browserHost, nativeHost, type Snapshot, type LearningHost } from "./host"
import { MechanicalHandViewer } from "./experiments/mechanical-hand/viewer"
import { MarsLandingViewer } from "./experiments/mars-landing/viewer"
import { LessonMarkdown } from "./lesson-markdown"
import fixture from "../../learning-contracts/fixtures/driving-intro.json"
import "./shell.css"

function Reader({ initial, onChange }: { initial: Snapshot; onChange: (state: Snapshot) => void }) {
  const [note, setNote] = useState(typeof initial.note === "string" ? initial.note : "")
  return <article className="reader">
    <p className="eyebrow">星际远航 · 课文预览</p>
    <h1>{fixture.module.title}</h1>
    <p className="lead">{fixture.module.core_question}</p>
    <div className="course-meta"><span>M01</span><span>{fixture.module.estimated_minutes} 分钟</span><span>离线可读</span></div>
    <LessonMarkdown>{fixture.module.lesson}</LessonMarkdown>
    <section className="notebook"><p className="eyebrow">留下一点想法</p><h2>我的阅读笔记</h2><p>这里的笔记保存在本机，当前预览不会提交课程作业。</p>
      <label htmlFor="reading-note">看不清路面时，你还需要什么信息？</label>
      <textarea id="reading-note" value={note} maxLength={20000} placeholder="写下你的观察，稍后回来还能继续。" onChange={event => { setNote(event.target.value); onChange({ note: event.target.value }) }}/>
    </section>
    <section className="references"><h2>本节资料</h2>{fixture.module.resources.map(item => <p key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a><small>{item.purpose}</small></p>)}</section>
  </article>
}

function Classroom({ host, initial, activity }: { host: LearningHost; initial: Snapshot; activity: ReturnType<typeof activityFrom> }) {
  const [status, setStatus] = useState("记录保存在本机")
  const latest = useRef<Snapshot | null>(null), saving = useRef<Promise<void> | null>(null), mounted = useRef(true)
  const save = useCallback(async () => {
    if (saving.current) await saving.current
    if (!latest.current) return
    const value = latest.current; latest.current = null
    const operation = host.save({ ...value, schema_version: 1 }).then(() => {
      if (mounted.current) setStatus(latest.current ? "正在保存…" : "已保存到本机")
    }).catch(error => {
      latest.current ??= value
      if (mounted.current) setStatus("保存失败，内容仍在当前页面，请稍后重试")
      throw error
    })
    saving.current = operation
    try { await operation } finally { if (saving.current === operation) saving.current = null }
  }, [host])
  const change = useCallback((state: Snapshot) => { latest.current = state; setStatus("正在保存…") }, [])
  useEffect(() => {
    mounted.current = true
    const flush = () => { void save().catch(() => {}) }
    const timer = setInterval(flush, 400)
    window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", flush)
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", flush); flush() }
  }, [save])
  const assetBase = location.protocol === "systemedu:" ? "systemedu://bundle" : ""
  return <>
    {activity === "mechanical-hand" ? <MechanicalHandViewer embedded initialState={initial} onStateChange={change} assetBase={assetBase}/> :
      activity === "mars-landing" ? <MarsLandingViewer embedded initialState={initial} onStateChange={change} assetBase={assetBase}/> : <Reader initial={initial} onChange={change}/>}
    <div className="save-bar" role="status"><span className="save-dot"/>{status}<button onClick={() => { void save().then(() => host.exportState()).catch(() => setStatus("导出失败，请重试")) }}>导出记录</button></div>
  </>
}

async function main() {
  const target = document.getElementById("root")!
  try {
    const params = new URLSearchParams(location.search), activity = activityFrom(params.get("activity"))
    const host = location.protocol === "systemedu:" ? nativeHost(activity, params.get("session") ?? "") : browserHost(activity)
    const snapshot = await host.load()
    createRoot(target).render(<Classroom host={host} initial={snapshot ?? {}} activity={activity}/> )
  } catch (error) {
    target.className = "load-error"; target.textContent = error instanceof Error ? error.message : "课堂暂时无法打开，请返回后重试。"
  }
}
void main()
