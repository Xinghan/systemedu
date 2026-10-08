"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { SlideTechnicalVisual } from '@/lib/types/api'

const Presentation = createContext({ paused: false, revision: 0, reduced: false, toggle: () => {}, replay: () => {} })

/** Playback belongs to the player, never to the teaching content or student work. */
export function ReadonlyPresentation({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false), [revision, setRevision] = useState(0), [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return <Presentation.Provider value={{ paused, revision, reduced, toggle: () => setPaused(p => !p), replay: () => { setRevision(r => r + 1); setPaused(false) } }}>{children}</Presentation.Provider>
}

export function hasReadonlyAnimation(visual?: SlideTechnicalVisual) {
  return visual?.renderer === 'code-trace' && visual.aria_label?.startsWith('M08 ·') ||
    visual?.renderer === 'discovery-brief' && ['funnel', 'budget', 'honesty'].includes(visual.scene) ||
    visual?.renderer === 'rdkit-runtime' && visual.scene === 'trace' ||
    visual?.renderer === 'molecule-skeleton-evidence' && ['overview', 'vocabulary', 'aromatic', 'scan'].includes(visual.scene) ||
    visual?.renderer === 'functional-group' && ['groups', 'trace'].includes(visual.scene) ||
    visual?.renderer === 'smiles-reading' && ['hydrogens', 'trace'].includes(visual.scene)
}

export function PresentationPlaybackControls() {
  const p = useContext(Presentation)
  return <div data-presentation-controls className="mb-2 flex flex-wrap items-center gap-3 text-xs text-[var(--sub)]">
    <span>只读讲解 · {p.reduced ? '已按系统设置关闭动画，完整证据仍可阅读' : '预设过程自动演示'}</span>
    {!p.reduced && <><button type="button" className="underline" onClick={p.toggle}>{p.paused ? '继续演示' : '暂停演示'}</button><button type="button" className="underline" onClick={p.replay}>重播演示</button></>}
  </div>
}

/** One pass, no mutation/download side effects, pause offscreen and when hidden. */
export function useReadonlySteps(count: number, interval = 2800) {
  const p = useContext(Presentation), root = useRef<HTMLElement>(null)
  const [frame, setFrame] = useState({ revision: p.revision, step: 0 })
  const [visible, setVisible] = useState(false), [tabVisible, setTabVisible] = useState(true)
  const step = p.reduced ? Math.max(0, count - 1) : frame.revision === p.revision ? frame.step : 0
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (root.current) observer.observe(root.current)
    const update = () => setTabVisible(!document.hidden)
    update(); document.addEventListener('visibilitychange', update)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [])
  useEffect(() => {
    if (p.paused || p.reduced || !visible || !tabVisible || step >= count - 1) return
    const timer = window.setTimeout(() => setFrame({ revision: p.revision, step: step + 1 }), interval)
    return () => window.clearTimeout(timer)
  }, [p.paused, p.reduced, p.revision, visible, tabVisible, step, count, interval])
  return { root, step }
}
