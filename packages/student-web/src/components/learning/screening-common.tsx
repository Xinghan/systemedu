"use client"

import { useEffect, useMemo, useState } from "react"
import katex from "katex"
import "katex/contrib/mhchem"
import "katex/dist/katex.min.css"
import "./screening-evidence.css"

export function ExactEquation({ source }: { source: string }) {
  const html = useMemo(() => { try { return katex.renderToString(source, { displayMode: true, output: "htmlAndMathml", throwOnError: true, trust: false }) } catch { return null } }, [source])
  return html ? <div className="se-equation" role="math" aria-label={source} dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="se-equation" data-formula-error>{source}</pre>
}

/** Playback changes teaching state, stops at the end and while the tab is hidden. */
export function useTeachingSteps(count: number, initial = 0) {
  const [step, setStep] = useState(initial), [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => { if (document.hidden) return; setStep(n => Math.min(n + 1, count - 1)) }, 1000)
    const stop = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener("visibilitychange", stop)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", stop) }
  }, [playing, count])
  useEffect(() => { if (step === count - 1 && playing) { const id = window.setTimeout(() => setPlaying(false), 0); return () => window.clearTimeout(id) } }, [step, count, playing])
  const jump = (n: number) => { setPlaying(false); setStep(Math.max(0, Math.min(n, count - 1))) }
  return { step, jump, playing, toggle: () => { if (step === count - 1) setStep(0); setPlaying(v => !v) }, reset: () => jump(0) }
}

export function StepControls({ steps, count, label = "逐步演示" }: { steps: ReturnType<typeof useTeachingSteps>; count: number; label?: string }) {
  return <div className="se-controls"><button type="button" onClick={steps.toggle}>{steps.playing ? "暂停演示" : `播放${label}`}</button><button type="button" className="secondary" disabled={steps.step === count - 1} onClick={() => steps.jump(steps.step + 1)}>下一步</button><button type="button" className="secondary" onClick={steps.reset}>重置</button><span aria-live="polite">步骤 {steps.step + 1} / {count}</span></div>
}

export function downloadEvidence(name: string, evidence: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, (_, v) => v === Infinity ? "+Infinity" : v, 2)], { type: "application/json" }))
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function EvidenceNote({ children }: { children: React.ReactNode }) { return <aside className="se-note">{children}</aside> }
