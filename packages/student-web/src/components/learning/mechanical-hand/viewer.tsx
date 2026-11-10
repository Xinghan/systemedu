"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowUpRight, Pause, Play, RotateCcw } from "lucide-react"
import { OPEN, rig, solveHand, type Commands, type FingerId, type Pose } from "./kinematics"
import type { HandController, HandState } from "./scene"
import s from "./viewer.module.css"

const ALL_CLOSED: Commands = { thumb: 1, index: 1, middle: 1, ring: 1, little: 1 }
function FingerPlot({ pose }: { pose: Pose }) {
  const pts = pose.points.map(point => [point[2], point[1]])
  const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]))
  const minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]))
  const scale = Math.min(190 / Math.max(2, maxX - minX), 106 / Math.max(2, maxY - minY))
  const points = pts.map(([x, y]) => [40 + (x - minX) * scale, 135 - (y - minY) * scale])
  return <svg viewBox="0 0 260 160" role="img" aria-label="所选手指的侧面投影，圆点代表关节，线段代表指节">
    <path d="M25 140H240" stroke="#cdd5ce" strokeDasharray="3 5"/>
    <polyline points={points.map(p => p.join(",")).join(" ")} fill="none" stroke="#244f49" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
    {points.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={i < points.length - 1 ? 7 : 5} fill={i < points.length - 1 ? "#cf6130" : "#e7b96d"} stroke="#faf8ef" strokeWidth="2"/>{i < points.length - 1 && <text x={x + 12} y={y - 9} fill="#816b54" fontSize="11">θ{i + 1}</text>}</g>)}
  </svg>
}

export function MechanicalHandViewer() {
  const [commands, setCommands] = useState<Commands>({ thumb: .12, index: .2, middle: .12, ring: .08, little: .05 })
  const [opposition, setOpposition] = useState(.15), [ball, setBall] = useState(false)
  const [shells, setShells] = useState(true), [tendons, setTendons] = useState(true), [selected, setSelected] = useState<FingerId>("index")
  const [ready, setReady] = useState(false), [fallback, setFallback] = useState(false), [retry, setRetry] = useState(0)
  const [playing, setPlaying] = useState(false), [demoTime, setDemoTime] = useState(0), [inView, setInView] = useState(true)
  const host = useRef<HTMLDivElement>(null), area = useRef<HTMLDivElement>(null), controller = useRef<HandController | null>(null)
  const state = useMemo<HandState>(() => ({ commands, opposition, ball, shells, tendons, selected }), [commands, opposition, ball, shells, tendons, selected])
  const stateRef = useRef(state), timeRef = useRef(0)
  const poses = useMemo(() => solveHand(commands, opposition, ball), [commands, opposition, ball])
  const finger = rig.fingers.find(f => f.id === selected)!, pose = poses[selected]
  const contacts = Object.values(poses).filter(p => p.contact).length
  useEffect(() => { stateRef.current = state; controller.current?.update(state) }, [state])
  useEffect(() => {
    if (fallback || !host.current) return
    const abort = new AbortController(), target = host.current
    void import("./scene").then(({ createHandScene }) => createHandScene(target, id => setSelected(id), () => { setPlaying(false); setFallback(true) }, abort.signal)).then(scene => {
      if (abort.signal.aborted) { scene.dispose(); return }
      controller.current = scene; scene.update(stateRef.current); setReady(true)
    }).catch(error => { if (!abort.signal.aborted && error.name !== "AbortError") { setPlaying(false); setFallback(true) } })
    return () => { abort.abort(); controller.current?.dispose(); controller.current = null }
  }, [fallback, retry])
  useEffect(() => {
    if (!area.current) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting)); observer.observe(area.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!playing || !ready || fallback || !inView) return
    let frame = 0, last = 0
    const tick = (now: number) => {
      if (!document.hidden) {
        timeRef.current = Math.min(9, timeRef.current + (last ? Math.min((now - last) / 1000, .05) : 0))
        const t = timeRef.current; setDemoTime(t)
        setCommands(Object.fromEntries(rig.fingers.map((f, i) => {
          const phase = Math.max(0, Math.min(1, (t - i * 1.35) / 2.6)); return [f.id, (1 - Math.cos(phase * Math.PI * 2)) / 2]
        })) as Commands)
        if (t >= 9) { setPlaying(false); return }
      }
      last = now; frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame)
  }, [playing, ready, fallback, inView])
  function preset(kind: "open" | "close" | "ball") {
    setPlaying(false); setBall(kind === "ball"); setCommands(kind === "open" ? { ...OPEN } : { ...ALL_CLOSED }); setOpposition(kind === "ball" ? .7 : kind === "close" ? .5 : 0)
  }
  function demo() {
    if (playing) { setPlaying(false); return }
    setBall(false); setOpposition(.2); timeRef.current = 0; setDemoTime(0); setCommands({ ...OPEN }); setPlaying(true)
  }
  function reset() { preset("open"); setShells(true); setTendons(true); setSelected("index"); timeRef.current = 0; setDemoTime(0); controller.current?.view("perspective") }
  const disabled = !ready || fallback
  return <main className={s.page}>
    <header className={s.header}><a href="/standalone/mars-landing"><ArrowLeft size={14}/> 火星车着陆</a><span className={s.brand}>SYSTEMEDU <small>OBJECT STUDIES / 02</small></span><span className={s.edition}>结构研究 · 机械手</span></header>
    <div className={s.title}><div><p className={s.eyebrow}>从卷线轮，到指尖</p><h1>五指机械手<span>，</span><br className={s.mobileBreak}/>拆开动作看结构。</h1></div><p>弯一根手指，看看关节怎样跟随。<br/>再移开外壳，沿着橙色牵引绳找到驱动端。</p></div>
    <section className={s.workbench} aria-label="五指机械手交互工作台">
      <div className={s.visual}>
        <div className={s.viewport} ref={area}>
          <div ref={host} className={s.scene} hidden={fallback}/>
          {!ready && !fallback && <div className={s.loading} role="status">正在加载机械手模型…</div>}
          {fallback && <div className={s.fallback} data-hand-fallback>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mechanical-hand/poster.png" alt="Blender 渲染的五指机械手张开姿态，指节、转轴和腕部驱动机构清晰可见"/>
            <div><strong>张开姿态 · 静态结构图</strong><p>下方公式保留当前参数。重新加载后可以继续操作三维模型。</p><button onClick={() => { setReady(false); setFallback(false); setRetry(n => n + 1) }}>重新加载三维模型</button></div>
          </div>}
          <div className={s.canvasTop}><span><i/> {fallback ? "静态结构图" : "原创三维装配模型"}</span><span>5 FINGERS / 15 JOINT AXES</span></div>
          <div className={s.canvasLabel}><span>当前观察</span><strong>{finger.name}</strong><p>{ball ? "参考球 · 近似包络接触限位" : shells ? "完整装配" : "外壳已隐藏 · 观察传动结构"}</p></div>
          <div className={s.views} aria-label="模型观察角度">{([['perspective','立体'],['palm','掌面'],['side','侧面']] as const).map(([id,label]) => <button key={id} disabled={disabled} onClick={() => controller.current?.view(id)}>{label}</button>)}</div>
          <div className={s.canvasBottom}><span>拖动旋转 · 滚轮缩放 · 点击手指</span><button disabled={disabled} onClick={reset}><RotateCcw size={13}/>复位</button></div>
        </div>
        <div className={s.inspection}>
          <label><input type="checkbox" checked={!shells} disabled={disabled} onChange={e => setShells(!e.target.checked)}/>隐藏外壳，看内部</label>
          <label><input type="checkbox" checked={tendons} disabled={disabled} onChange={e => setTendons(e.target.checked)}/><i/>显示牵引绳</label>
          <button disabled={disabled} onClick={demo} aria-label={playing ? "暂停逐指演示" : "播放逐指演示"}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? "暂停演示" : "逐指演示"}<small>{demoTime.toFixed(1)} / 9 s</small></button>
        </div>
        <div className={s.presets} aria-label="姿态预设">
          <button disabled={disabled} onClick={() => preset("open")}><span>01</span><b>张开手掌</b><small>观察关节排列</small></button>
          <button disabled={disabled} onClick={() => preset("close")}><span>02</span><b>五指合拢</b><small>比较各指的运动</small></button>
          <button disabled={disabled} onClick={() => preset("ball")}><span>03</span><b>包握参考球</b><small>观察接触限位</small></button>
        </div>
      </div>
      <aside className={s.controls}>
        <div className={s.sectionHeading}><span>动作控制</span><span>01 — 05</span></div>
        <h2>先动一根手指。</h2><p className={s.hint}>拖动滑杆改变弯曲指令。点击名称，可以查看该手指的关节和收绳量。</p>
        <div className={s.fingers}>{rig.fingers.map(f => {
          const id = f.id as FingerId, p = poses[id]
          return <div key={id} className={selected === id ? s.activeFinger : undefined}>
            <div className={s.fingerLabel}><button aria-pressed={selected === id} onClick={() => setSelected(id)}>{f.name}<ArrowUpRight size={11}/></button><span>{Math.round(commands[id] * 100)}<small>%</small></span></div>
            <input aria-label={`${f.name}弯曲指令`} type="range" min="0" max="100" value={Math.round(commands[id] * 100)} disabled={disabled} onChange={e => { setPlaying(false); setSelected(id); setCommands(prev => ({ ...prev, [id]: Number(e.target.value) / 100 })) }}/>
            {ball && <small className={s.contactLabel}>{p.contact ? `接触限位 · 实际弯曲 ${Math.round(p.amount * 100)}%` : "尚未碰到参考球"}</small>}
          </div>
        })}</div>
        <div className={s.opposition}><label htmlFor="hand-opposition">拇指对掌 <span>{Math.round(opposition * 100)}%</span></label><input id="hand-opposition" aria-label="拇指对掌" type="range" min="0" max="100" value={Math.round(opposition * 100)} disabled={disabled} onChange={e => { setPlaying(false); setSelected("thumb"); setOpposition(Number(e.target.value) / 100) }}/><p>让拇指朝向其他手指；这与指节弯曲是两种不同的转动。</p></div>
        <div className={s.modelState} data-contact-status><span className={ball ? s.ballDot : s.freeDot}/><div><strong>{ball ? `${contacts} 根手指达到几何接触限位` : "自由屈伸 · 无接触物体"}</strong><p>{ball ? "用包住指节的近似圆头柱体检测接触，因此表面可能留有小间隙。碰到球后，该手指停止；这里不计算抓力或提起物体。" : "各关节按预设比例弯曲。你可以把它看作一个可检查的运动学模型。"}</p></div></div>
      </aside>
    </section>
    <section className={s.readout} aria-label="所选手指传动计算">
      <div className={s.projection}><span className={s.miniTitle}>{finger.name} / 侧面投影</span><FingerPlot pose={pose}/><p>每个圆点是一根转轴，线段是一节指骨。</p></div>
      <div className={s.joints}><span className={s.miniTitle}>关节角度</span><div>{pose.angles.map((angle, i) => <div key={i}><span>θ<sub>{i + 1}</sub> · {['根部','中间','末端'][i]}</span><strong data-angle={i}>{angle.toFixed(1)}<small>°</small></strong></div>)}</div><p>上游关节转动时，下游指节会一起移动。这里的角度是各关节相对于前一节的转角。</p></div>
      <div className={s.formula}><span className={s.miniTitle}>理想收绳量</span><div className={s.pull}><strong data-pull>{pose.pull.toFixed(2)}</strong><span>mm</span></div><p className={s.equation}>Δl = r₁θ₁ + r₂θ₂{pose.angles.length === 3 ? " + r₃θ₃" : ""}</p><p>Δl 是收回的绳长；r 是绳相对转轴的力臂，本例为 {finger.arms_mm.join(" / ")} mm。θ 代入公式时须换成弧度。</p><div className={s.drum}>卷线轮半径 {rig.drum_radius_mm} mm → 转角 <b>{pose.drumAngle.toFixed(1)}°</b></div></div>
    </section>
    <section className={s.notes}>
      <div><span>01 / 如何理解</span><h3>看结构，也看模型的边界。</h3><p>橙色线表示牵引绳的走向。卷线轮收绳，关节弯曲；松开后的复位在这里用预设姿态表示。关节比例、尺寸和恒定力臂都是教学设定，不包含绳索弹性、摩擦、复位弹簧受力或真实肌电控制。</p></div>
      <div><span>02 / 参考原理</span><h3>从真实机构出发。</h3><p>参考 <a href="https://www.eng.yale.edu/grablab/openhand/" target="_blank" rel="noreferrer">Yale OpenHand <ArrowUpRight size={12}/></a> 的绳驱动设计，以及 <a href="https://www.eng.yale.edu/grablab/openhand/model_t.html" target="_blank" rel="noreferrer">Model T 的欠驱动机构</a>。本模型为原创五指结构，没有复制它的 CAD，也没有实现它的自适应差动传动。</p></div>
      <div><span>03 / 编辑与复用</span><h3>模型可以继续修改。</h3><p><a href="/mechanical-hand/mechanical-hand.blend" download>Blender 源文件 <ArrowDown size={12}/></a><br/><a href="/mechanical-hand/mechanical-hand.glb" download>GLB 模型与示例动画 <ArrowDown size={12}/></a><br/><button onClick={() => { setPlaying(false); setFallback(true) }}>查看静态结构图</button></p></div>
    </section>
    <footer className={s.footer}><span>SYSTEMEDU / MECHANISM STUDIES</span><span>Blender 建模 · Three.js 交互 · 运动学示意</span></footer>
  </main>
}
