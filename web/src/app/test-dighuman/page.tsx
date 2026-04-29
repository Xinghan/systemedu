"use client"

import { useState } from "react"
import { LizardScene } from "@/components/dighuman/LizardScene"
import { useDighumanSession } from "@/components/dighuman/use-dighuman-session"

export default function TestDighumanPage() {
  const { connected, speak, stop } = useDighumanSession()
  const [text, setText] = useState("你好，我是蜥蜴老师。今天我们一起来学习什么是力。")
  const [lang, setLang] = useState<"zh" | "en">("zh")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSpeak = async () => {
    setError(null)
    setBusy(true)
    try {
      await speak(text, lang)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col gap-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Dighuman Test Page</h1>

      <div className="flex items-center gap-3 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
        />
        <span>{connected ? "WS connected to dighuman" : "connecting..."}</span>
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-800" style={{ height: 480 }}>
        <LizardScene />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="dh-text" className="text-sm font-medium opacity-80">
          What should the lizard say?
        </label>
        <textarea
          id="dh-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as "zh" | "en")}
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
        >
          <option value="zh">中文 (zh)</option>
          <option value="en">English (en)</option>
        </select>
        <button
          type="button"
          onClick={handleSpeak}
          disabled={!connected || busy}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-sm font-medium"
        >
          {busy ? "speaking..." : "Speak"}
        </button>
        <button
          type="button"
          onClick={stop}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium"
        >
          Stop
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm">
          Error: {error}
        </div>
      )}

      <details className="text-xs opacity-60 mt-4">
        <summary className="cursor-pointer">debug info</summary>
        <pre className="mt-2 bg-slate-900 p-3 rounded overflow-auto">
{`server: ${process.env.NEXT_PUBLIC_DIGHUMAN_URL ?? "http://localhost:8787"}
ws:     ${(process.env.NEXT_PUBLIC_DIGHUMAN_URL ?? "http://localhost:8787").replace(/^http/, "ws")}/ws?session_id=...

curl health:
  curl http://localhost:8787/api/health
`}
        </pre>
      </details>
    </div>
  )
}
