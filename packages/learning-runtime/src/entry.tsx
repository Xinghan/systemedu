import { useCallback, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { activityFrom, browserHost, nativeHost, type Snapshot, type LearningHost } from "./host"
import { MobileHand } from "./mobile/hand"
import { MobileLanding } from "./mobile/landing"
import { MobileReader } from "./mobile/reader"
import "./shell.css"

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
  useEffect(() => {
    const viewport = window.visualViewport
    const resize = () => document.documentElement.style.setProperty("--visible-height", `${viewport?.height ?? innerHeight}px`)
    resize(); viewport?.addEventListener("resize", resize)
    return () => viewport?.removeEventListener("resize", resize)
  }, [])
  return <div className="classroom-shell">
    <header className="session-bar"><span role="status"><i/>{status}</span><button onClick={() => { void save().then(() => host.exportState()).catch(() => setStatus("导出失败，请重试")) }}>导出记录 ↗</button></header>
    {activity === "mechanical-hand" ? <MobileHand initial={initial} onChange={change} assetBase={assetBase}/> :
      activity === "mars-landing" ? <MobileLanding initial={initial} onChange={change} assetBase={assetBase}/> : <MobileReader initial={initial} onChange={change}/>}
  </div>
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
