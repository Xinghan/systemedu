"use client"
import { useEffect, useRef, useState } from "react"
import type { TestCase } from "./math"
import { runtimeDocument } from "./runtime"
export type PythonResult = { raw: unknown; stdout: string; error?: string }
export function usePython() {
  const [status, setStatus] = useState<"idle" | "loading" | "running">("idle")
  const dispose = useRef<(() => void) | null>(null)
  useEffect(() => () => dispose.current?.(), [])
  function cancel() { dispose.current?.(); dispose.current = null; setStatus("idle") }
  function run(code: string, cases: TestCase[], done: (result: PythonResult) => void, failure: (message: string) => void, script = false) {
    cancel()
    if (code.length > 20000) { failure("代码超过 20,000 字符限制。"); return }
    const channel = crypto.randomUUID(), frame = document.createElement("iframe")
    frame.hidden = true; frame.title = "隔离的 Python 运行区"; frame.setAttribute("sandbox", "allow-scripts")
    frame.referrerPolicy = "no-referrer"
    frame.srcdoc = runtimeDocument(channel, location.origin)
    let timer: ReturnType<typeof setTimeout>, closed = false
    const cleanup = () => {
      if (closed) return
      closed = true; clearTimeout(timer); window.removeEventListener("message", receive)
      frame.contentWindow?.postMessage({ channel, type: "stop" }, "*"); frame.remove()
    }
    const fail = (message: string) => { cleanup(); setStatus("idle"); failure(message) }
    function receive(e: MessageEvent) {
      if (closed || e.source !== frame.contentWindow || e.data?.channel !== channel) return
      const data = e.data
      if (data.type === "ready") {
        clearTimeout(timer); setStatus("running")
        timer = setTimeout(() => fail("运行超过 5 秒，已停止并清理环境。检查循环或大数组后重试。"), 5000)
        frame.contentWindow?.postMessage({ channel, type: "run", code, cases, mode: script ? "script" : "attention" }, "*")
      } else if (data.type === "load-error") {
        fail("Python 环境加载失败。请检查网络后重试；草稿已保留，也可下载课后项目。\n" + (typeof data.error === "string" ? data.error.slice(0, 700) : ""))
      } else if (data.type === "result") {
        try {
          if (typeof data.result !== "string" || data.result.length > 100000) throw new Error("invalid")
          const raw: unknown = JSON.parse(data.result)
          cleanup(); setStatus("idle")
          done({ raw, stdout: typeof data.stdout === "string" ? data.stdout.slice(0, 5000) : "", error: typeof data.error === "string" ? data.error.slice(0, 5000) : undefined })
        } catch { fail("运行结果格式无效，未生成成绩。") }
      }
    }
    setStatus("loading"); window.addEventListener("message", receive)
    timer = setTimeout(() => fail("运行时下载超时，未生成成绩。请重试或使用下载项目。"), 60000)
    dispose.current = cleanup; document.body.appendChild(frame)
  }
  return { status, run, cancel, runScript: (code: string, done: (result: PythonResult) => void, failure: (message: string) => void) => run(code, [], done, failure, true) }
}
