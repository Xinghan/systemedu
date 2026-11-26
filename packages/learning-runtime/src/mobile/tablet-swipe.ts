import { useEffect, useRef, type RefObject } from 'react'

export function swipeDirection(dx: number, dy: number, width: number, elapsed: number): -1 | 0 | 1 {
  if (elapsed > 1500 || Math.abs(dx) < Math.min(120, Math.max(64, width * .12)) || Math.abs(dx) < Math.abs(dy) * 1.7) return 0
  return dx < 0 ? 1 : -1
}

// A gesture belongs to the surface on which it started. Tables, controls, selection,
// experiments and vertical scrolling keep their own gestures throughout the touch.
const ownGesture = 'button,a,input,textarea,select,label,summary,video,audio,iframe,[contenteditable],[role=slider],.tablet-table,.katex-display,pre,[data-no-page-swipe]'
export function useTabletSwipe(surface: RefObject<HTMLElement | null>, enabled: boolean, bookmark: string | undefined, turn: (direction: -1 | 1) => void) {
  const callback = useRef(turn); callback.current = turn
  useEffect(() => {
    const node = surface.current
    if (!node || !enabled) return
    let start: { x: number; y: number; time: number; axis: 'pending' | 'horizontal' | 'vertical' } | undefined
    const clear = () => { start = undefined; node.style.removeProperty('--page-drag') }
    const begin = (e: TouchEvent) => {
      clear()
      if (e.touches.length !== 1 || !(e.target instanceof Element) || e.target.closest(ownGesture) || window.getSelection()?.toString()) return
      const t = e.touches[0], rect = node.getBoundingClientRect()
      if (t.clientX - rect.left < 24 || rect.right - t.clientX < 24) return
      start = { x: t.clientX, y: t.clientY, time: performance.now(), axis: 'pending' }
    }
    const move = (e: TouchEvent) => {
      if (!start) return
      if (e.touches.length !== 1 || window.getSelection()?.toString()) { clear(); return }
      const dx = e.touches[0].clientX - start.x, dy = e.touches[0].clientY - start.y
      if (start.axis === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) > 12) start.axis = Math.abs(dx) > Math.abs(dy) * 1.7 ? 'horizontal' : 'vertical'
      if (start.axis !== 'horizontal') return
      e.preventDefault()
      node.style.setProperty('--page-drag', `${Math.max(-90, Math.min(90, dx * .3))}px`)
    }
    const end = (e: TouchEvent) => {
      if (start && start.axis !== 'vertical' && e.changedTouches.length === 1 && !window.getSelection()?.toString()) {
        const t = e.changedTouches[0], direction = swipeDirection(t.clientX - start.x, t.clientY - start.y, node.clientWidth, performance.now() - start.time)
        if (direction) callback.current(direction)
      }
      clear()
    }
    node.addEventListener('touchstart', begin, { passive: true })
    node.addEventListener('touchmove', move, { passive: false })
    node.addEventListener('touchend', end)
    node.addEventListener('touchcancel', clear)
    return () => { clear(); node.removeEventListener('touchstart', begin); node.removeEventListener('touchmove', move); node.removeEventListener('touchend', end); node.removeEventListener('touchcancel', clear) }
  }, [surface, enabled, bookmark])
}
