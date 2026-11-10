"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ChevronRight, Maximize2, Pause, Play, RotateCcw } from "lucide-react"
import { ASSET, DURATION, PARTS, STAGES, stageAt, type Part } from "./content"
import type { SceneController } from "./scene"
import styles from "./viewer.module.css"

export function MarsLandingViewer() {
  const [time, setTime] = useState(25), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1)
  const [ready, setReady] = useState(false), [fallback, setFallback] = useState(false), [retry, setRetry] = useState(0)
  const [hidden, setHidden] = useState(false), [selected, setSelected] = useState<Part | null>(null), [answer, setAnswer] = useState(false)
  const [inView, setInView] = useState(true)
  const host = useRef<HTMLDivElement>(null), stageElement = useRef<HTMLDivElement>(null), controller = useRef<SceneController | null>(null)
  const timeRef = useRef(time), phase = stageAt(time), stage = STAGES[phase]
  const choosePart = useCallback((part: Part) => { setSelected(part); setPlaying(false) }, [])
  useEffect(() => {
    if (fallback || !host.current) return
    const target = host.current, abort = new AbortController()
    void import("./scene").then(({ createLandingScene }) => createLandingScene(target, choosePart, () => { setPlaying(false); setFallback(true) }, abort.signal)).then(scene => {
      if (abort.signal.aborted) { scene.dispose(); return }
      controller.current = scene; scene.seek(timeRef.current); setReady(true)
    }).catch(error => { if (!abort.signal.aborted && error.name !== "AbortError") { setPlaying(false); setFallback(true) } })
    return () => { abort.abort(); controller.current?.dispose(); controller.current = null }
  }, [fallback, retry, choosePart])
  useEffect(() => { timeRef.current = time; controller.current?.seek(time) }, [time])
  useEffect(() => { controller.current?.select(selected) }, [selected, ready, retry])
  useEffect(() => { controller.current?.shell(hidden) }, [hidden, ready, retry])
  useEffect(() => {
    if (!stageElement.current) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting)); observer.observe(stageElement.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!playing || !ready || fallback || !inView) return
    let frame = 0, last = 0
    const tick = (now: number) => {
      if (!document.hidden) {
        const dt = last ? Math.min((now - last) / 1000, .05) : 0
        const next = Math.min(DURATION, timeRef.current + dt * speed)
        timeRef.current = next; setTime(next)
        if (next === DURATION) { setPlaying(false); return }
      }
      last = now; frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, ready, fallback, speed, inView])
  function jump(value: number) { setPlaying(false); setTime(value); setAnswer(false); controller.current?.view("follow") }
  function partButton(part: Part) {
    choosePart(part)
    const at: Record<Part, number> = { rover: 34, descent: 14, parachute: 1, backshell: 2, heatshield: 6, bridle: 25 }
    setTime(at[part]); setAnswer(false); controller.current?.view("follow")
  }
  function restart() { setTime(0); timeRef.current = 0; setSelected(null); setHidden(false); setAnswer(false); setPlaying(true); controller.current?.view("follow") }
  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/mission/space" className={styles.back}><ArrowLeft size={15}/> 星际远航</a>
      <span className={styles.wordmark}>SYSTEMEDU <span>OBJECT STUDIES / 01</span></span>
      <span className={styles.edition}>MARS 2020 · 结构与过程</span>
    </header>
    <div className={styles.titleRow}>
      <div><p className={styles.eyebrow}>从空中，到六个轮子着地</p><h1>最后一段，怎样着陆<span>？</span></h1></div>
      <p className={styles.intro}>跟随毅力号的下降过程，<br/>看清每个部件何时工作、为何分离。</p>
    </div>
    <section className={styles.workbench} aria-label="火星车着陆交互演示">
      <div className={styles.visualColumn}>
        <div className={styles.viewport} ref={stageElement}>
          <div className={styles.scene} ref={host} hidden={fallback}/>
          {fallback && <div className={styles.fallback} data-mars-fallback>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mars-landing/poster.png" alt="Blender 渲染的天空吊车结构示意：动力下降级在上，缆绳连接下方六轮火星车"/>
            <div><strong>当前显示静态结构图</strong><p>三维暂时无法使用。仍可选择下方阶段，阅读过程说明。</p><button onClick={() => { setReady(false); setFallback(false); setRetry(v => v + 1) }}>重新加载三维模型</button></div>
          </div>}
          {!ready && !fallback && <div className={styles.loading} role="status"><span/>正在装配着陆模型…</div>}
          <div className={styles.sceneTop}><span><i/> {fallback ? "静态结构图" : "可旋转的三维模型"}</span><span>PERSEVERANCE / EDL</span></div>
          <div className={styles.stageBadge}><span>0{phase + 1} / 05</span><strong>{stage.title}</strong><p>时间与空间经过压缩的过程示意</p></div>
          <div className={styles.viewButtons} aria-label="观察角度">
            <button disabled={!ready || fallback} onClick={() => controller.current?.view("follow")}><Maximize2 size={14}/>整体</button>
            <button disabled={!ready || fallback} onClick={() => controller.current?.view("side")}>侧面</button>
            <button disabled={!ready || fallback} onClick={() => controller.current?.view("top")}>俯视</button>
          </div>
          <div className={styles.sceneBottom}><span>拖动旋转 · 滚轮缩放 · 点击部件</span><label><input type="checkbox" checked={hidden} disabled={!ready || fallback} onChange={event => setHidden(event.target.checked)}/>隐藏外壳，看内部</label></div>
        </div>
        <div className={styles.transport}>
          <div className={styles.playRow}>
            <button className={styles.play} disabled={!ready || fallback} onClick={() => { if (time >= DURATION) { setTime(0); timeRef.current = 0 }; setPlaying(v => !v) }} aria-label={playing ? "暂停演示" : "播放演示"}>{playing ? <Pause size={18}/> : <Play size={18}/>}<span>{playing ? "暂停" : "播放"}</span></button>
            <button className={styles.restart} onClick={restart} disabled={!ready || fallback}><RotateCcw size={15}/>从头开始</button>
            <span className={styles.time}>{time.toFixed(1)} <small>/ 42.0 s · 演示时间</small></span>
            <label className={styles.speed}>速度<select aria-label="播放速度" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
          </div>
          <input className={styles.timeline} type="range" aria-label="着陆演示时间轴" min={0} max={DURATION} step={.05} value={time} disabled={!ready || fallback} onChange={event => jump(Number(event.target.value))} style={{ "--progress": `${time / DURATION * 100}%` } as React.CSSProperties}/>
          <div className={styles.stages}>{STAGES.map((item, index) => <button key={item.id} aria-current={index === phase ? "step" : undefined} onClick={() => jump(item.seek)}><span>{index < phase ? <Check size={12}/> : `0${index + 1}`}</span><b>{item.title}</b></button>)}</div>
        </div>
      </div>
      <aside className={styles.panel}>
        <div className={styles.panelHeading}><span>此刻正在发生</span><span>PHASE 0{phase + 1}</span></div>
        <h2>{stage.verb}</h2><p className={styles.description}>{stage.body}</p>
        <div className={styles.fact}><span>真实任务参考</span><p>{stage.fact}</p></div>
        <div className={styles.question}>
          <button aria-expanded={answer} onClick={() => setAnswer(v => !v)}><span><small>想一想</small>{stage.question}</span><ChevronRight size={19} style={{ transform: answer ? "rotate(90deg)" : undefined }}/></button>
          {answer && <p>{stage.answer}</p>}
        </div>
        <div className={styles.partHeading}><h3>观察一个部件</h3><span>选择后定位到对应阶段</span></div>
        <div className={styles.parts}>{(Object.entries(PARTS) as [Part, typeof PARTS[Part]][]).map(([id, part]) => <button key={id} aria-pressed={selected === id} onClick={() => partButton(id)}><span/>{part.name}<ArrowUpRight size={12}/></button>)}</div>
        <div className={styles.partDetail} aria-live="polite">{selected ? <><span>{PARTS[selected].english}</span><h3>{PARTS[selected].name}</h3><p>{PARTS[selected].detail}</p></> : <><span>结构观察</span><p>选择部件名称，或直接点击模型。选中部件会被高亮，其余结构保留作对照。</p></>}</div>
      </aside>
    </section>
    <section className={styles.notes}>
      <div><span className={styles.noteNumber}>01</span><h3>这是一段结构示意</h3><p>模型和动作由 Blender 制作，浏览器实时呈现。它依据真实着陆顺序编排；几何、伞的尺寸、飞行距离和时长均有简化，不是飞行仿真或实际遥测。火星车的桅杆在着陆时保持收起。</p></div>
      <div><span className={styles.noteNumber}>02</span><h3>对照真实着陆</h3><p><a href="https://www.youtube.com/watch?v=4czjS9h4Fpg" target="_blank" rel="noreferrer">NASA 着陆实拍 <ArrowUpRight size={12}/></a> · <a href="https://science.nasa.gov/resource/powered-descent-for-perseverance-illustration/" target="_blank" rel="noreferrer">动力下降说明</a> · <a href="https://science.nasa.gov/resource/perseverance-heat-shield-separation-illustration/" target="_blank" rel="noreferrer">隔热罩分离</a> · <a href="https://science.nasa.gov/resource/perseverance-touching-down-on-mars-illustration/" target="_blank" rel="noreferrer">触地与飞离</a></p><p>任务资料：NASA / JPL-Caltech。三维几何为本项目原创教学模型。</p></div>
      <div><span className={styles.noteNumber}>03</span><h3>打开模型继续研究</h3><p><a href="/mars-landing/mars-landing.blend" download>Blender 源文件 <ArrowDown size={12}/></a><br/><a href={ASSET} download>GLB 模型与动画 <ArrowDown size={12}/></a><br/><button className={styles.fallbackLink} onClick={() => { setPlaying(false); setFallback(true) }}>切换静态结构图</button></p></div>
    </section>
    <footer className={styles.footer}>SYSTEMEDU / 火星着陆研究 <span>一个部件，一次动作，一个原因。</span></footer>
  </main>
}
