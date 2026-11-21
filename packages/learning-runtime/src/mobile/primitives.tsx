import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

/** Native dialog supplies focus containment, Escape and an inert background in WKWebView. */
export function Sheet({ title, children, onClose, footer, immersive = false, docked = false }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; immersive?: boolean; docked?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), heading = useId()
  useEffect(() => { const node = dialog.current; if (!node) return; node.showModal(); return () => node.close() }, [docked])
  if (docked) return <aside className="tablet-inspector" aria-labelledby={heading}><header><h2 id={heading}>{title}</h2><button className="icon-button" aria-label="关闭面板" onClick={onClose}><X size={21}/></button></header><div className="inspector-body">{children}</div>{footer && <footer>{footer}</footer>}</aside>
  return <dialog ref={dialog} className={immersive ? 'sheet immersive-sheet' : 'sheet'} aria-labelledby={heading} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="sheet-layout">
      <header><h2 id={heading}>{title}</h2><button className="icon-button" aria-label="关闭面板" autoFocus onClick={onClose}><X size={21}/></button></header>
      <div className="sheet-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  </dialog>
}

export function Pager({ index, count, onChange, label = "页" }: { index: number; count: number; onChange: (index: number) => void; label?: string }) {
  return <nav className="pager" aria-label={`${label}切换`}>
    <button aria-label="上一页" disabled={index === 0} onClick={() => onChange(index - 1)}><ChevronLeft size={19}/>上一页</button>
    <span aria-live="polite">{index + 1} / {count}</span>
    <button aria-label="下一页" disabled={index === count - 1} onClick={() => onChange(index + 1)}>下一页<ChevronRight size={19}/></button>
  </nav>
}

export function SceneFrame({ host, ready, failed, retry, poster, children }: { host: RefObject<HTMLDivElement | null>; ready: boolean; failed: boolean; retry: () => void; poster: string; children: ReactNode }) {
  return <section className="model-frame" aria-label="三维模型观察区">
    <div className="model-canvas" ref={host} hidden={failed}/>
    {!ready && !failed && <div className="model-loading" role="status">正在加载本地模型…</div>}
    {failed && <div className="model-fallback"><img src={poster} alt="模型的静态结构参考图"/><div><span>当前为静态参考图</span><button onClick={retry}>重新加载模型</button></div></div>}
    {children}
  </section>
}
